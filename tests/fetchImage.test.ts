import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { fetchImage, MAX_IMAGE_BYTES } from "../src/utils/fetchImage.ts";

let server: Server;
let origin: string;
before(async () => {
  server = createServer((request, response) => {
    if (request.url === "/missing") {
      response.writeHead(404).end();
      return;
    }
    if (request.url === "/large") {
      response.writeHead(200, { "Content-Length": MAX_IMAGE_BYTES + 1 }).end();
      return;
    }
    if (request.url === "/stream") {
      response.writeHead(200, { "Content-Type": "image/png" });
      response.end(Buffer.alloc(MAX_IMAGE_BYTES + 1));
      return;
    }
    response.writeHead(200, { "Content-Type": "image/png; charset=binary" });
    response.end(Buffer.from([137, 80, 78, 71]));
  }).listen(0, "127.0.0.1");
  await new Promise<void>((done) => server.once("listening", done));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>((done) => server.close(() => done()));
});
test("returns bounded image bytes and normalized MIME type", async () => {
  const image = await fetchImage(origin, new AbortController().signal);
  assert.equal(image.type, "image/png");
  assert.equal(image.base64, "iVBORw==");
});
test("HTTP failures remain errors", async () => {
  await assert.rejects(
    fetchImage(origin + "/missing", new AbortController().signal),
    /HTTP 404/,
  );
});
test("oversized advertised responses are rejected", async () => {
  await assert.rejects(
    fetchImage(origin + "/large", new AbortController().signal),
    /12 MiB/,
  );
});
test("oversized streamed responses are rejected even without a content length", async () => {
  await assert.rejects(
    fetchImage(origin + "/stream", new AbortController().signal),
    /12 MiB/,
  );
});
test("local filesystem and script URLs are rejected", async () => {
  for (const url of [
    "file:///etc/hosts",
    "javascript:alert(1)",
    "data:image/png;base64,aA==",
  ]) {
    await assert.rejects(
      fetchImage(url, new AbortController().signal),
      /not supported/,
    );
  }
});
test("canceled work stops image fetching", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchImage(origin, controller.signal), {
    name: "AbortError",
  });
});
