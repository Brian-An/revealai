// Background service worker
console.log("C2PA Finder background service worker loaded");

// Handle installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("C2PA Finder extension installed");
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "analyzeImage") {
    analyzeImageMetadata(request.url)
      .then(sendResponse)
      .catch((error) => {
        console.error("Error analyzing image:", error);
        sendResponse({ error: error.message });
      });
    return true; // Will respond asynchronously
  }
});

async function analyzeImageMetadata(imageUrl: string) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    const bytes = new Uint8Array(arrayBuffer);
    const hasC2PA = await checkC2PAMetadata(arrayBuffer);
    const metadata = hasC2PA ? extractBasicMetadata(bytes) : undefined;
    const isAIGenerated = hasC2PA ? await checkIfAIGenerated(bytes) : false;

    return {
      url: imageUrl,
      hasC2PA,
      isAIGenerated,
      confidence: null, // Confidence requires full C2PA manifest parsing
      metadata,
    };
  } catch (error) {
    console.error("Error fetching image:", error);
    throw error;
  }
}

async function checkC2PAMetadata(arrayBuffer: ArrayBuffer): Promise<boolean> {
  const bytes = new Uint8Array(arrayBuffer);

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return checkJPEGForC2PA(bytes);
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return checkPNGForC2PA(bytes);
  }

  return false;
}

function checkJPEGForC2PA(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xff) {
      const marker = bytes[i + 1];

      if (marker === 0xeb) {
        const segmentLength = (bytes[i + 2] << 8) | bytes[i + 3];
        const segmentData = bytes.slice(i + 4, i + 4 + segmentLength);
        const segmentString = new TextDecoder().decode(segmentData);

        if (
          segmentString.includes("c2pa") ||
          segmentString.includes("C2PA") ||
          segmentString.includes("contentauth") ||
          segmentString.includes("cai")
        ) {
          return true;
        }
      }

      if (marker === 0xe1) {
        const segmentLength = (bytes[i + 2] << 8) | bytes[i + 3];
        const segmentData = bytes.slice(i + 4, i + 4 + segmentLength);
        const segmentString = new TextDecoder().decode(segmentData);

        if (
          segmentString.includes("c2pa") ||
          segmentString.includes("provenance")
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function checkPNGForC2PA(bytes: Uint8Array): boolean {
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

    if (chunkType === "caBX") {
      return true;
    }

    // Check text chunks for C2PA metadata
    if (chunkType === "tEXt" || chunkType === "zTXt" || chunkType === "iTXt") {
      const chunkData = bytes.slice(offset + 8, offset + 8 + chunkLength);
      const chunkString = new TextDecoder().decode(chunkData);

      if (
        chunkString.includes("c2pa") ||
        chunkString.includes("C2PA") ||
        chunkString.includes("contentauth") ||
        chunkString.includes("cai")
      ) {
        return true;
      }
    }

    offset += 12 + chunkLength;
    if (chunkLength > bytes.length) break;
  }
  return false;
}

async function checkIfAIGenerated(bytes: Uint8Array): Promise<boolean> {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const text = decoder.decode(bytes);

  // C2PA spec: Check digitalSourceType field for trainedAlgorithmicMedia
  // http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia
  // http://c2pa.org/digitalsourcetype/trainedAlgorithmicMedia

  // AI generator indicators in C2PA metadata
  const aiIndicators = [
    // IPTC digital source types
    "trainedAlgorithmicMedia",
    "algorithmicMedia",
    "compositeSynthetic",

    // AI model/software names
    "ChatGPT",
    "GPT-4",
    "GPT-3",
    "DALL-E",
    "DALL·E",
    "Midjourney",
    "Stable Diffusion",
    "StableDiffusion",
    "Adobe Firefly",
    "Firefly",
    "Google Imagen",
    "Imagen",
    "generativeAi",
    "ai-generated",
    "synthetic",
  ];

  return aiIndicators.some((indicator) =>
    text.toLowerCase().includes(indicator.toLowerCase())
  );
}

function extractBasicMetadata(bytes: Uint8Array): {
  software?: string;
  creator?: string;
} {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const text = decoder.decode(bytes);

  const metadata: { software?: string; creator?: string } = {};

  // C2PA metadata extraction patterns
  // Looking for: "Claim_Generator_InfoName":"ChatGPT" or similar
  const softwarePatterns = [
    // Direct field patterns from CBOR/binary data (no quotes around values)
    /Claim_Generator_InfoName['":\s]*([A-Za-z0-9\s\-.]+?)(?:["',\n]|$)/i,
    /ActionsSoftwareAgentName['":\s]*([A-Za-z0-9\s\-.]+?)(?:["',\n]|$)/i,

    // Standard JSON patterns with quotes
    /"Claim_Generator_InfoName"[:\s]*"([^"]+)"/i,
    /"claim_generator"[:\s]*"([^"]+)"/i,
    /claim_generator_info[:\s]*{[^}]*"name"[:\s]*"([^"]+)"/i,
    /"softwareAgent"[:\s]*"([^"]+)"/i,

    // More permissive patterns for binary data
    /ChatGPT/i,
    /GPT-4o/i,
    /DALL-E/i,
    /Midjourney/i,
    /Stable Diffusion/i,
  ];

  for (const pattern of softwarePatterns) {
    const match = text.match(pattern);
    if (match) {
      // If pattern has a capture group, use it, otherwise use the whole match
      const value = (match[1] || match[0]).trim();

      // Filter out null bytes, binary data, and very short matches
      if (
        value.length >= 3 &&
        !value.includes("\x00") &&
        /^[A-Za-z0-9\s\-.]+$/.test(value)
      ) {
        metadata.software = value;
        break;
      }
    }
  }

  // Try to extract creator/author
  const creatorPatterns = [
    /"creator"[:\s]*"([^"]+)"/i,
    /"author"[:\s]*"([^"]+)"/i,
    /"dc:creator"[:\s]*"([^"]+)"/i,
  ];

  for (const pattern of creatorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const value = match[1].trim();
      if (value.length >= 2 && !value.includes("\x00")) {
        metadata.creator = value;
        break;
      }
    }
  }

  return metadata;
}

export {};
