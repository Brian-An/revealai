import { analyzeBlob } from "./c2pa";
import type {
  ImageAnalysisResult,
  PageImage,
  PageScan,
  ScanProgress,
} from "../types";

export class ScanError extends Error {
  title: string;
  constructor(title: string, message: string) {
    super(message);
    this.title = title;
  }
}

function discoverImages() {
  const unique = new Map<
    string,
    { url: string; alt: string; width: number; height: number }
  >();
  for (const image of document.images) {
    if (image.naturalWidth < 50 || image.naturalHeight < 50) continue;
    const url = image.currentSrc || image.src;
    if (url && !unique.has(url))
      unique.set(url, {
        url,
        alt: image.alt.slice(0, 500),
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    if (unique.size > 100) break;
  }
  return {
    images: [...unique.values()].slice(0, 100),
    limited: unique.size > 100,
  };
}

async function analyzeImage(
  image: PageImage,
  signal: AbortSignal,
): Promise<ImageAnalysisResult> {
  const id = crypto.randomUUID();
  const cancel = () => {
    void chrome.runtime
      .sendMessage({ action: "cancelImage", id })
      .catch(() => undefined);
  };
  signal.throwIfAborted();
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const response: unknown = await chrome.runtime.sendMessage({
      action: "fetchImage",
      id,
      url: image.url,
    });
    signal.throwIfAborted();
    if (!response || typeof response !== "object")
      throw new Error("The extension could not read this image.");
    const data = response as Record<string, unknown>;
    if (typeof data.error === "string") throw new Error(data.error);
    if (typeof data.base64 !== "string" || typeof data.type !== "string")
      throw new Error("The image response was invalid.");
    if (
      data.type &&
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
        "image/heic",
        "image/heif",
      ].includes(data.type)
    ) {
      throw new Error(
        "This image format is not supported. Try a JPEG, PNG, WebP, or AVIF original.",
      );
    }
    const bytes = Uint8Array.from(atob(data.base64), (character) =>
      character.charCodeAt(0),
    );
    return {
      ...image,
      ...(await analyzeBlob(new Blob([bytes], { type: data.type }))),
    };
  } catch (error) {
    signal.throwIfAborted();
    return {
      ...image,
      verdict: "error",
      validation: "unavailable",
      summary: "Could not check",
      explanation:
        error instanceof Error ? error.message : "The image could not be read.",
    };
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}

export async function scanCurrentPage(
  onProgress: (progress: ScanProgress) => void,
  signal: AbortSignal,
): Promise<PageScan> {
  if (!globalThis.chrome?.tabs)
    throw new ScanError(
      "Open RevealAI in Chrome",
      "Load the extension in Chrome, open a website, and select Scan page.",
    );
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url)) {
    throw new ScanError(
      "This page can’t be scanned",
      "Open a regular website, then select Scan page. Chrome protects internal pages and some browser tabs.",
    );
  }
  let discovery;
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: discoverImages,
    });
    discovery = injection?.result;
    if (!discovery) throw new Error("No image discovery result.");
  } catch {
    throw new ScanError(
      "This page can’t be scanned",
      "Chrome could not access this page. Try reloading the page or opening a different website.",
    );
  }
  signal.throwIfAborted();
  const hostname = new URL(tab.url).hostname;
  const { images, limited } = discovery;
  const ordered: Array<ImageAnalysisResult | undefined> = new Array(
    images.length,
  );
  const snapshot = () => ({
    hostname,
    limited,
    results: ordered.filter(
      (result): result is ImageAnalysisResult => result !== undefined,
    ),
  });
  onProgress({ ...snapshot(), total: images.length });
  let cursor = 0;
  async function worker() {
    while (cursor < images.length && !signal.aborted) {
      const index = cursor++;
      ordered[index] = await analyzeImage(images[index], signal);
      signal.throwIfAborted();
      onProgress({ ...snapshot(), total: images.length });
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, images.length) }, worker));
  signal.throwIfAborted();
  return snapshot();
}
