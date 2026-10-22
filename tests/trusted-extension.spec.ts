import { test, expect, chromium } from "@playwright/test";
import { build, type Plugin } from "vite";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("trusted AI generation and editing render correctly in an isolated extension build", async () => {
  const roots =
    readFileSync(
      resolve("tests/fixtures/test-only-signing-chain.pem"),
      "utf8",
    ) +
    "\n" +
    readFileSync(resolve("tests/fixtures/test-only-edit-chain.pem"), "utf8");
  const replaceTrust: Plugin = {
    name: "isolated-test-trust",
    enforce: "pre",
    load(id) {
      if (id.endsWith("/public/trust/anchors.pem?raw"))
        return `export default ${JSON.stringify(roots)};`;
    },
  };
  const extension = resolve("test-results/trusted-extension");
  // Test roots enter only this separate output, never dist or application source.
  await build({
    configFile: resolve("vite.config.ts"),
    logLevel: "silent",
    build: { outDir: extension, emptyOutDir: true },
    worker: { plugins: () => [replaceTrust] },
  });
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const server = createServer((request, response) => {
    const image =
      request.url === "/generated.png"
        ? "ai-declared.png"
        : request.url === "/edited.png"
          ? "ai-edited.png"
          : undefined;
    if (image) {
      response.writeHead(200, { "Content-Type": "image/png" });
      response.end(readFileSync(resolve("tests/fixtures", image)));
    } else {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(
        `<img src="/generated.png" alt="A generated image"><img src="/edited.png" alt="${"Long image title ".repeat(40)}">`,
      );
    }
  }).listen(0, "127.0.0.1");
  try {
    await new Promise<void>((done) => server.once("listening", done));
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing fixture server");
    const worker =
      context.serviceWorkers()[0] ||
      (await context.waitForEvent("serviceworker"));
    const target = await context.newPage();
    await target.goto(`http://127.0.0.1:${address.port}`);
    const popup = await context.newPage();
    await popup.goto(
      `chrome-extension://${new URL(worker.url()).host}/index.html`,
    );
    await target.bringToFront();
    await popup.setViewportSize({ width: 400, height: 600 });
    await expect(popup.getByText("RevealAI", { exact: true })).toBeVisible();
    await popup.bringToFront();
    await popup.screenshot({ path: "test-results/popup-ready.png" });
    await target.bringToFront();
    await popup.getByRole("button", { name: "Scan page", exact: true }).click();
    await expect(
      popup.getByText("2 images checked", { exact: true }),
    ).toBeVisible();
    await expect(popup.locator(".status-ai")).toHaveCount(2);
    await expect(
      popup.getByText("AI generation declared", { exact: true }),
    ).toBeVisible();
    await expect(
      popup.getByText("AI editing declared", { exact: true }),
    ).toBeVisible();
    await popup.bringToFront();
    await popup.screenshot({ path: "test-results/popup-trusted.png" });
    await popup.getByRole("button", { name: /Unknown/ }).click();
    await expect(
      popup.getByRole("heading", { name: "No matching images" }),
    ).toBeVisible();
    await popup.getByRole("button", { name: /AI indicated/ }).click();
    await expect(popup.locator(".image-result")).toHaveCount(2);
    await popup.getByText("Why this result").first().focus();
    await popup.keyboard.press("Enter");
    await expect(popup.locator("details[open]")).toHaveCount(1);
    await expect(
      popup.getByText("Signature, image binding and signer verified").first(),
    ).toBeVisible();
    await popup.getByText("Why this result").nth(1).click();
    await expect(
      popup.getByText("Source" + "x".repeat(600), { exact: true }),
    ).toBeVisible();
    expect(
      await popup.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(400);
    const evidenceBounds = await popup
      .locator(".evidence")
      .nth(1)
      .boundingBox();
    expect(evidenceBounds!.x + evidenceBounds!.width).toBeLessThanOrEqual(400);
    await popup.screenshot({ path: "test-results/popup-long-evidence.png" });
  } finally {
    await context.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
});
