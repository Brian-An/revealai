import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import initialize, { WasmReader } from "@contentauth/c2pa-wasm";
import { resolveSettings } from "@contentauth/c2pa-utilities";
import type { ManifestStore } from "@contentauth/c2pa-types";
import { summarizeCredentials } from "../src/utils/provenance.ts";
import { png } from "./fixtures.ts";

let settings: string;
let signed: Uint8Array;
let certificate: string;
before(async () => {
  const wasm = await readFile(
    new URL(
      "../node_modules/@contentauth/c2pa-wasm/pkg/c2pa_bg.wasm",
      import.meta.url,
    ),
  );
  await initialize({ module_or_path: wasm });
  certificate = await readFile(
    new URL("./fixtures/test-only-signing-chain.pem", import.meta.url),
    "utf8",
  );
  settings = await resolveSettings({
    trust: { userAnchors: certificate },
    verify: {
      verifyTrust: true,
      verifyAfterReading: true,
      remoteManifestFetch: false,
      ocspFetch: false,
    },
  });
  signed = await readFile(
    new URL("./fixtures/ai-declared.png", import.meta.url),
  );
});

test("an actual signed and trusted AI fixture has an AI verdict", async () => {
  const reader = await WasmReader.fromBytes("image/png", signed, settings);
  try {
    const store = reader.manifestStore() as ManifestStore;
    assert.equal(store.validation_state, "Trusted");
    assert.equal(summarizeCredentials(store).verdict, "ai");
  } finally {
    reader.free();
  }
});

test("the same signature is unknown under the production trust list", async () => {
  const anchors = await readFile(
    new URL("../public/trust/anchors.pem", import.meta.url),
    "utf8",
  );
  const production = await resolveSettings({
    trust: { trustAnchors: anchors },
    verify: { verifyTrust: true, remoteManifestFetch: false, ocspFetch: false },
  });
  const reader = await WasmReader.fromBytes("image/png", signed, production);
  try {
    assert.equal(
      summarizeCredentials(reader.manifestStore() as ManifestStore).verdict,
      "unknown",
    );
  } finally {
    reader.free();
  }
});

test("tampered signed content never receives an AI verdict", async () => {
  const bytes = signed.slice();
  const imageData = Buffer.from(bytes).indexOf("IDAT");
  assert.ok(imageData > 0);
  bytes[imageData + 5] ^= 1;
  const reader = await WasmReader.fromBytes("image/png", bytes, settings);
  try {
    assert.equal(
      summarizeCredentials(reader.manifestStore() as ManifestStore).verdict,
      "unknown",
    );
  } finally {
    reader.free();
  }
});

test("unsigned PNG comments do not become credentials", async () => {
  await assert.rejects(
    WasmReader.fromBytes("image/png", png("c2pa camera provenance"), settings),
    /JumbfNotFound/,
  );
});

test("a signed camera image with an AI editing action is labeled as an edit", async () => {
  const bytes = await readFile(
    new URL("./fixtures/ai-edited.png", import.meta.url),
  );
  const roots = await readFile(
    new URL("./fixtures/test-only-edit-chain.pem", import.meta.url),
    "utf8",
  );
  const editSettings = await resolveSettings({
    trust: { userAnchors: roots },
    verify: { verifyTrust: true, remoteManifestFetch: false, ocspFetch: false },
  });
  const reader = await WasmReader.fromBytes("image/png", bytes, editSettings);
  try {
    const store = reader.manifestStore() as ManifestStore;
    assert.equal(store.validation_state, "Trusted");
    assert.equal(summarizeCredentials(store).summary, "AI editing declared");
  } finally {
    reader.free();
  }
});
