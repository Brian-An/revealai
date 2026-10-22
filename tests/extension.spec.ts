import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { png } from "./fixtures";

let context: BrowserContext;
let popup: Page;
let target: Page;
let server: Server;
let origin: string;
let failureFetches = 0;
let slowFetches = 0;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    if (request.url?.startsWith("/fixture/")) {
      const name = request.url.slice("/fixture/".length);
      const files = [
        "signed-test.jpg",
        "history-test.jpg",
        "signed-test.webp",
        "ai-declared.png",
      ];
      if (!files.includes(name)) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": name.endsWith("webp")
          ? "image/webp"
          : name.endsWith("png")
            ? "image/png"
            : "image/jpeg",
      });
      response.end(readFileSync(resolve("tests/fixtures", name)));
      return;
    }
    if (request.url?.endsWith(".png")) {
      if (request.url === "/slow.png" && slowFetches++ > 0) return;
      if (request.url === "/failure.png" && failureFetches++ > 0) {
        response.writeHead(503).end();
        return;
      }
      response.writeHead(200, { "Content-Type": "image/png" });
      response.end(
        png(request.url.includes("spoof") ? "c2pa camera provenance" : ""),
      );
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html" });
    if (request.url === "/many") {
      response.end(
        Array.from(
          { length: 101 },
          (_, index) => `<img src="/many-${index}.png" alt="Image ${index}">`,
        ).join(""),
      );
      return;
    }
    if (request.url === "/network") {
      failureFetches = 0;
      response.end(
        '<img src="/failure.png" alt="Unavailable image"><img src="/plain.png" alt="Ordinary image">',
      );
      return;
    }
    if (request.url === "/slow") {
      slowFetches = 0;
      response.end('<img src="/slow.png" alt="Slow image">');
      return;
    }
    if (request.url === "/responsive") {
      response.end(
        '<img src="/fallback.png" srcset="/selected.png 1x" alt="Responsive image"><img src="/selected.png" alt="Duplicate current source">',
      );
      return;
    }
    response.end(
      request.url === "/empty"
        ? "<h1>No images</h1>"
        : request.url === "/signed"
          ? '<img src="/fixture/signed-test.jpg" alt="Signed JPEG"><img src="/fixture/history-test.jpg" alt="Second signed JPEG"><img src="/fixture/signed-test.webp" alt="Signed WebP"><img src="/fixture/ai-declared.png" alt="Untrusted AI declaration">'
          : '<h1>Image checks</h1><img src="/spoof.png" alt="Unsigned image with a misleading comment"><img src="/plain.png" alt="Ordinary image"><img src="/plain.png" alt="Duplicate">',
    );
  }).listen(0, "127.0.0.1");
  await new Promise<void>((done) => server.once("listening", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture server");
  origin = `http://127.0.0.1:${address.port}`;
  const extension = resolve("dist");
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  target = await context.newPage();
  await target.goto(origin);
  popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/index.html`);
  await target.bringToFront();
});

test.afterAll(async () => {
  await context?.close();
  await new Promise<void>((done) => server?.close(() => done()));
});

test("unsigned images never become authentic because a comment mentions C2PA", async () => {
  await expect(
    popup.getByRole("heading", { name: "A closer look. A clearer picture." }),
  ).toBeVisible();
  await popup.getByRole("button", { name: /scan (current )?page/i }).click();
  await expect(popup.getByText("Authentic", { exact: true })).toHaveCount(0);
  await expect(
    popup.getByText("2 images checked", { exact: true }),
  ).toBeVisible();
  await expect(popup.getByText("Unknown", { exact: true })).toHaveCount(2);
  await popup.getByRole("button", { name: /AI indicated/ }).click();
  await expect(
    popup.getByRole("heading", { name: "No matching images" }),
  ).toBeVisible();
  await popup.getByRole("button", { name: /^All/ }).click();
  await popup.getByText("Why this result").first().click();
  await expect(
    popup.getByText(/No embedded Content Credentials were found/).first(),
  ).toBeVisible();
  await expect(
    popup.locator('a[href="https://synthid.com/"]').first(),
  ).toBeVisible();
  await popup.getByRole("button", { name: "Scan again" }).click();
  await expect(
    popup.getByText("2 images checked", { exact: true }),
  ).toBeVisible();
  await popup.setViewportSize({ width: 400, height: 600 });
  await popup.screenshot({ path: "test-results/popup-results.png" });
  expect(
    await popup.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(400);
});

test("the packaged validator reads signed JPEG and WebP without inventing trust", async () => {
  await target.goto(origin + "/signed");
  await target.bringToFront();
  await popup.reload();
  await popup.getByRole("button", { name: "Scan page", exact: true }).click();
  await expect(
    popup.getByText("4 images checked", { exact: true }),
  ).toBeVisible();
  await expect(popup.locator(".status-error")).toHaveCount(0);
  await expect(popup.locator(".status-ai")).toHaveCount(0);
  await expect(popup.locator(".status-unknown")).toHaveCount(4);
  await popup.getByText("Why this result").first().click();
  await expect(popup.getByText(/Offline validation/).first()).toBeVisible();
});

test("network failures preserve successful results and show their reason", async () => {
  await target.goto(origin + "/network");
  await target.bringToFront();
  await popup.reload();
  await popup.getByRole("button", { name: "Scan page", exact: true }).click();
  await expect(
    popup.getByText("2 images checked", { exact: true }),
  ).toBeVisible();
  await expect(popup.locator(".status-error")).toHaveCount(1);
  await expect(popup.locator(".status-unknown")).toHaveCount(1);
  await popup.getByText("Why this result").first().click();
  await expect(
    popup.getByText("The image server returned HTTP 503."),
  ).toBeVisible();
});

test("responsive sources are deduplicated by the displayed image", async () => {
  await target.goto(origin + "/responsive");
  await target.bringToFront();
  await popup.reload();
  await popup.getByRole("button", { name: "Scan page", exact: true }).click();
  await expect(
    popup.getByText("1 image checked", { exact: true }),
  ).toBeVisible();
  await expect(popup.locator(".thumbnail img")).toHaveAttribute(
    "src",
    origin + "/selected.png",
  );
});

test("large pages disclose the scan cap", async () => {
  await target.goto(origin + "/many");
  await target.bringToFront();
  await popup.reload();
  await popup.getByRole("button", { name: "Scan page", exact: true }).click();
  await expect(
    popup.getByText("100 images checked", { exact: true }),
  ).toBeVisible();
  await expect(
    popup.getByText("Showing the first 100 unique images on this page."),
  ).toBeVisible();
  await expect(popup.locator(".status-error")).toHaveCount(0);
});

test("an empty page has its own completed state", async () => {
  await target.goto(origin + "/empty");
  await target.bringToFront();
  await popup.reload();
  await popup.getByRole("button", { name: "Scan page", exact: true }).click();
  await expect(
    popup.getByRole("heading", { name: "No eligible images", exact: true }),
  ).toBeVisible();
});

test("restricted pages have a visible error", async () => {
  await target.goto("chrome://version");
  await target.bringToFront();
  await popup.reload();
  await popup.getByRole("button", { name: /scan (current )?page/i }).click();
  await expect(
    popup.getByRole("heading", {
      name: "This page can’t be scanned",
      exact: true,
    }),
  ).toBeVisible();
});

test("a timed-out download ends with an actionable result", async () => {
  await target.goto(origin + "/slow");
  await target.bringToFront();
  await popup.reload();
  await popup.getByRole("button", { name: "Scan page", exact: true }).click();
  await expect(popup.getByText("1 image checked", { exact: true })).toBeVisible(
    { timeout: 20_000 },
  );
  await expect(popup.locator(".status-error")).toHaveCount(1);
  await popup.getByText("Why this result").click();
  await expect(
    popup.getByText(
      "The image server took too long. Try opening the original image.",
    ),
  ).toBeVisible();
});
