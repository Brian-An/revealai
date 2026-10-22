export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export async function fetchImage(
  url: string,
  signal: AbortSignal,
): Promise<{ base64: string; type: string }> {
  if (
    url.length > 8192 ||
    !["https:", "http:"].includes(new URL(url).protocol)
  ) {
    throw new Error(
      "This image URL is not supported. Open the original image on a website.",
    );
  }
  const timeout = AbortSignal.timeout(15_000);
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, timeout]),
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok)
    throw new Error(`The image server returned HTTP ${response.status}.`);
  if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) {
    await response.body?.cancel();
    throw new Error("This image exceeds the 12 MiB limit.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The image response was empty.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES)
        throw new Error("This image exceeds the 12 MiB limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let binary = "";
  for (let start = 0; start < size; start += 32768)
    binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
  return {
    base64: btoa(binary),
    type: response.headers.get("content-type")?.split(";")[0].trim() || "",
  };
}
