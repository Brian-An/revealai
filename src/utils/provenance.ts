import type { Manifest, ManifestStore } from "@contentauth/c2pa-types";
import type { CredentialEvidence } from "../types";

const sourceRoot = "http://cv.iptc.org/newscodes/digitalsourcetype/";
const generated = sourceRoot + "trainedAlgorithmicMedia";
const edited = sourceRoot + "compositeWithTrainedAlgorithmicMedia";

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function actionSources(
  manifest: Manifest,
): Array<{ action: string; source: string }> {
  return (manifest.assertions ?? []).flatMap((assertion) => {
    if (!/^c2pa\.actions(?:\.v[12])?$/.test(assertion.label)) return [];
    const actions = record(assertion.data).actions;
    if (!Array.isArray(actions)) return [];
    return actions.flatMap((action: unknown) => {
      const data = record(action);
      return typeof data.digitalSourceType === "string"
        ? [
            {
              action: typeof data.action === "string" ? data.action : "",
              source: data.digitalSourceType,
            },
          ]
        : [];
    });
  });
}

export function summarizeCredentials(
  store: ManifestStore | null,
): CredentialEvidence {
  const manifest = store?.active_manifest
    ? store.manifests?.[store.active_manifest]
    : undefined;
  if (!store || !manifest)
    return {
      verdict: "unknown",
      validation: "missing",
      summary: "No origin information found",
      explanation:
        "No embedded Content Credentials were found. Metadata can disappear when an image is edited or shared, so this does not rule out AI.",
    };
  const statuses = store.validation_results?.activeManifest;
  const successes = new Set(statuses?.success.map((status) => status.code));
  const valid =
    successes.has("claimSignature.validated") &&
    [
      "assertion.dataHash.match",
      "assertion.bmffHash.match",
      "assertion.boxesHash.match",
    ].some((code) => successes.has(code));
  const failures =
    (statuses?.failure.length ?? 0) > 0 ||
    (store.validation_results?.ingredientDeltas?.some(
      (delta) => delta.validationDeltas.failure.length > 0,
    ) ??
      false);
  const software =
    manifest.claim_generator_info?.[0]?.name ||
    manifest.claim_generator ||
    undefined;
  const issuer = manifest.signature_info?.issuer || undefined;
  const base = { software, issuer };
  if (store.validation_state === "Invalid" || failures)
    return {
      ...base,
      verdict: "unknown",
      validation: "invalid",
      summary: "Credentials could not be verified",
      explanation:
        "The credential has a validation failure. Its declarations cannot establish how this image was made.",
    };
  if (
    !valid ||
    store.validation_state !== "Trusted" ||
    !successes.has("signingCredential.trusted")
  )
    return {
      ...base,
      verdict: "unknown",
      validation: "untrusted",
      summary: "Origin could not be verified",
      explanation:
        "A credential is present, but its image binding, signature, or signer trust could not be established using the bundled C2PA trust list.",
    };
  const actions = actionSources(manifest);
  const sources = actions.map((action) => action.source);
  if (sources.includes(generated) || sources.includes(edited)) {
    const aiEdit =
      actions.some(
        (action) =>
          action.source === edited ||
          (action.source === generated && action.action !== "c2pa.created"),
      ) ||
      (manifest.ingredients?.some(
        (ingredient) =>
          ingredient.relationship === "parentOf" ||
          ingredient.relationship === "componentOf",
      ) ??
        false);
    return {
      ...base,
      verdict: "ai",
      validation: "trusted",
      summary: aiEdit ? "AI editing declared" : "AI generation declared",
      explanation: aiEdit
        ? "Trusted Content Credentials declare AI involvement. This may describe an edit or part of the image, rather than an entirely generated image."
        : "The active, trusted Content Credentials declare AI generation. The signature and image binding were checked locally.",
    };
  }
  // A direct ingredient declaration is signed by the active image's trusted signer.
  const aiIngredient = manifest.ingredients?.some(
    (ingredient) =>
      (ingredient.relationship === "parentOf" ||
        ingredient.relationship === "componentOf") &&
      !ingredient.active_manifest &&
      [generated, edited].includes(ingredient.digital_source_type ?? ""),
  );
  if (aiIngredient)
    return {
      ...base,
      verdict: "ai",
      validation: "trusted",
      summary: "AI ingredient declared",
      explanation:
        "The trusted active credential declares an AI-generated ingredient in this image. This does not mean the entire image was generated.",
    };
  const camera =
    sources.includes(sourceRoot + "digitalCapture") ||
    sources.includes(sourceRoot + "computationalCapture");
  return {
    ...base,
    verdict: "unknown",
    validation: "trusted",
    summary: camera ? "Camera origin declared" : "Credentials found",
    explanation: camera
      ? "The credential declares camera capture. This cannot rule out AI edits or establish that the image depicts a real event."
      : "The credential is trusted, but its checked declarations do not establish whether AI was used. Ingredient history alone is not treated as verified AI evidence.",
  };
}
