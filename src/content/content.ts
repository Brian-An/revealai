// Content script - runs in the context of web pages
console.log('C2PA Finder content script loaded');

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'scanImages') {
    scanPageImages().then(sendResponse);
    return true; // Will respond asynchronously
  }
});

async function scanPageImages() {
  console.log('Starting image scan...');
  
  // Find all images on the page
  const images = Array.from(document.querySelectorAll('img'));
  const imageData: Array<{url: string, element: HTMLImageElement}> = [];
  
  // Filter out tiny images (icons, thumbnails, etc.)
  const MIN_SIZE = 50;
  for (const img of images) {
    if (img.naturalWidth >= MIN_SIZE && img.naturalHeight >= MIN_SIZE) {
      imageData.push({
        url: img.src,
        element: img
      });
    }
  }
  
  console.log(`Found ${imageData.length} images to analyze`);
  
  // Send images back to be analyzed
  return {
    images: imageData.map(img => ({
      url: img.url,
      width: img.element.naturalWidth,
      height: img.element.naturalHeight,
      alt: img.element.alt || ''
    })),
    count: imageData.length
  };
}
