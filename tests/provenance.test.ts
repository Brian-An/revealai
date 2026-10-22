import { test } from "node:test";
import assert from "node:assert/strict";
import type { ManifestStore } from "@contentauth/c2pa-types";
import { summarizeCredentials } from "../src/utils/provenance.ts";

const source = "http://cv.iptc.org/newscodes/digitalsourcetype/";
function store(sourceType: string, trusted = true): ManifestStore {
  return {
    active_manifest: "active",
    validation_state: trusted ? "Trusted" : "Valid",
    validation_results: {
      activeManifest: {
        success: [
          "claimSignature.validated",
          "assertion.dataHash.match",
          ...(trusted ? ["signingCredential.trusted"] : []),
        ].map((code) => ({ code })),
        informational: [],
        failure: [],
      },
    },
    manifests: {
      active: {
        assertions: [
          {
            label: "c2pa.actions.v2",
            data: {
              actions: [
                {
                  action: "c2pa.created",
                  digitalSourceType: source + sourceType,
                },
              ],
            },
          },
        ],
      },
    },
  };
}

test("a trusted bound generation declaration indicates AI", () => {
  const result = summarizeCredentials(store("trainedAlgorithmicMedia"));
  assert.equal(result.verdict, "ai");
  assert.equal(result.summary, "AI generation declared");
});
test("an AI edit is described separately from generation", () => {
  assert.equal(
    summarizeCredentials(store("compositeWithTrainedAlgorithmicMedia")).summary,
    "AI editing declared",
  );
});

test("AI source on an editing action does not claim full generation", () => {
  const input = store("digitalCapture");
  input.manifests!.active.assertions![0].data = {
    actions: [
      { action: "c2pa.created", digitalSourceType: source + "digitalCapture" },
      {
        action: "c2pa.edited",
        digitalSourceType: source + "trainedAlgorithmicMedia",
      },
    ],
  };
  const result = summarizeCredentials(input);
  assert.equal(result.verdict, "ai");
  assert.equal(result.summary, "AI editing declared");
});
test("camera capture remains unknown", () => {
  assert.equal(
    summarizeCredentials(store("digitalCapture")).verdict,
    "unknown",
  );
});
test("untrusted signatures cannot establish AI", () => {
  assert.equal(
    summarizeCredentials(store("trainedAlgorithmicMedia", false)).verdict,
    "unknown",
  );
});
test("missing metadata remains unknown", () => {
  assert.equal(summarizeCredentials(null).verdict, "unknown");
});
test("invalid bindings override AI declarations", () => {
  const input = store("trainedAlgorithmicMedia");
  input.validation_state = "Invalid";
  input.validation_results!.activeManifest!.failure.push({
    code: "assertion.dataHash.mismatch",
  });
  assert.equal(summarizeCredentials(input).verdict, "unknown");
});
test("missing validation evidence cannot establish AI", () => {
  const input = store("trainedAlgorithmicMedia");
  input.validation_results = null;
  assert.equal(summarizeCredentials(input).verdict, "unknown");
});
test("keywords in titles or unrelated assertions are not AI evidence", () => {
  const input = store("digitalArt");
  input.manifests!.active.title = "ChatGPT Midjourney synthetic AI-generated";
  input.manifests!.active.assertions!.push({
    label: "example.note",
    data: { digitalSourceType: source + "trainedAlgorithmicMedia" },
  });
  assert.equal(summarizeCredentials(input).verdict, "unknown");
});
test("unknown source authorities cannot establish AI", () => {
  const input = store("trainedAlgorithmicMedia");
  input.manifests!.active.assertions![0].data = {
    actions: [
      { digitalSourceType: "https://evil.example/trainedAlgorithmicMedia" },
    ],
  };
  assert.equal(summarizeCredentials(input).verdict, "unknown");
});
test("unrelated AI manifests cannot establish an AI verdict for the active image", () => {
  const input = store("digitalCapture");
  input.manifests!.unrelated = store(
    "trainedAlgorithmicMedia",
  ).manifests!.active;
  assert.equal(summarizeCredentials(input).verdict, "unknown");
});
test("a directly declared AI ingredient is described as an ingredient", () => {
  const input = store("digitalCapture");
  input.manifests!.active.ingredients = [
    {
      relationship: "componentOf",
      digital_source_type: source + "trainedAlgorithmicMedia",
    },
  ];
  assert.equal(summarizeCredentials(input).summary, "AI ingredient declared");
});
test("an input-only ingredient does not imply AI pixels in the output", () => {
  const input = store("digitalCapture");
  input.manifests!.active.ingredients = [
    {
      relationship: "inputTo",
      digital_source_type: source + "trainedAlgorithmicMedia",
    },
  ];
  assert.equal(summarizeCredentials(input).verdict, "unknown");
});
test("unverified ingredient manifests are not promoted to AI evidence", () => {
  const input = store("digitalCapture");
  input.manifests!.active.ingredients = [
    { relationship: "componentOf", active_manifest: "ingredient" },
  ];
  input.manifests!.ingredient = store(
    "trainedAlgorithmicMedia",
  ).manifests!.active;
  assert.equal(summarizeCredentials(input).verdict, "unknown");
});
