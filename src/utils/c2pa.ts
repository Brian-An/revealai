/**
 * C2PA (Coalition for Content Provenance and Authenticity) utilities
 */

export interface C2PAManifest {
  claim_generator?: string;
  title?: string;
  signature?: {
    issuer?: string;
    time?: string;
  };
  assertions?: Array<{
    label: string;
    data: any;
  }>;
  thumbnail?: string;
}

export async function hasC2PAMetadata(imageUrl: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (isJPEG(bytes)) {
      return await checkJPEGForC2PA(bytes);
    } else if (isPNG(bytes)) {
      return await checkPNGForC2PA(bytes);
    }

    return false;
  } catch (error) {
    console.error("Error checking C2PA metadata:", error);
    return false;
  }
}

export async function extractC2PAManifest(
  _imageUrl: string
): Promise<C2PAManifest | null> {
  try {
    return null;
  } catch (error) {
    console.error("Error extracting C2PA manifest:", error);
    return null;
  }
}

function isJPEG(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isPNG(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

async function checkJPEGForC2PA(bytes: Uint8Array): Promise<boolean> {
  for (let i = 0; i < bytes.length - 10; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xeb) {
      const segmentLength = (bytes[i + 2] << 8) | bytes[i + 3];
      const segmentData = bytes.slice(i + 4, i + 4 + segmentLength);
      const text = new TextDecoder("utf-8", { fatal: false }).decode(
        segmentData
      );
      if (
        text.includes("c2pa") ||
        text.includes("jumbf") ||
        text.includes("cai")
      ) {
        return true;
      }
    }
  }
  return false;
}

async function checkPNGForC2PA(bytes: Uint8Array): Promise<boolean> {
  let offset = 8;

  while (offset < bytes.length - 8) {
    const chunkLength =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];
    const chunkType = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );

    // Check for C2PA JUMBF chunk (caBX) - used by ChatGPT and other AI generators
    if (chunkType === "caBX") {
      return true;
    }

    // Check text chunks for C2PA metadata
    if (chunkType === "tEXt" || chunkType === "iTXt" || chunkType === "zTXt") {
      const chunkData = bytes.slice(offset + 8, offset + 8 + chunkLength);
      const text = new TextDecoder("utf-8", { fatal: false }).decode(chunkData);

      if (
        text.includes("c2pa") ||
        text.includes("cai") ||
        text.includes("contentauth")
      ) {
        return true;
      }
    }

    offset += 12 + chunkLength;
    if (chunkLength > bytes.length) break;
  }

  return false;
}

export async function validateC2PASignature(
  _imageUrl: string
): Promise<boolean> {
  return false;
}
