import initialize, { WasmReader } from "@contentauth/c2pa-wasm";
import { resolveSettings } from "@contentauth/c2pa-utilities";
import type { ManifestStore } from "@contentauth/c2pa-types";
import wasmSrc from "@contentauth/c2pa-wasm/c2pa.wasm?url";
import anchors from "../../public/trust/anchors.pem?raw";
import tsa from "../../public/trust/tsa.pem?raw";
import { summarizeCredentials } from "./provenance";

const ready = Promise.all([
  initialize({ module_or_path: wasmSrc }),
  resolveSettings({
    trust: { trustAnchors: anchors + "\n" + tsa },
    verify: {
      verifyTrust: true,
      verifyAfterReading: true,
      verifyTimestampTrust: true,
      remoteManifestFetch: false,
      ocspFetch: false,
    },
  }),
]);
let queue = Promise.resolve();

self.onmessage = (event: MessageEvent<{ id: string; blob: Blob }>) => {
  const { id, blob } = event.data;
  // Serialize native readers to bound WASM memory while image downloads run concurrently.
  queue = queue.then(async () => {
    let reader: WasmReader | undefined;
    try {
      const [, settings] = await ready;
      reader = await WasmReader.fromBlob(blob.type, blob, settings);
      const store: ManifestStore | null = reader
        ? (reader.manifestStore() as ManifestStore)
        : null;
      self.postMessage({ id, evidence: summarizeCredentials(store) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "C2pa(JumbfNotFound)")
        self.postMessage({ id, evidence: summarizeCredentials(null) });
      else
        self.postMessage({
          id,
          error:
            "Content Credentials could not be read or verified. Try opening the original image.",
        });
    } finally {
      reader?.free();
    }
  });
};
