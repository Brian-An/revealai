import type { ImageAnalysisResult } from '../types';

export async function analyzeImage(url: string): Promise<ImageAnalysisResult> {
  try {
    const result = await chrome.runtime.sendMessage({
      action: 'analyzeImage',
      url: url
    });
    return result;
  } catch (error) {
    console.error('Error analyzing image:', error);
    return {
      url,
      hasC2PA: false,
      isAIGenerated: null,
      confidence: undefined,
      metadata: undefined
    };
  }
}

export async function scanCurrentPage(): Promise<ImageAnalysisResult[]> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.id) {
      throw new Error('No active tab found');
    }
    
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/content/content.js']
      });
    } catch (error) {
      console.log('Content script may already be injected');
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'scanImages' 
    });
    
    if (!response || !response.images) {
      return [];
    }
    
    const results: ImageAnalysisResult[] = [];
    for (const image of response.images) {
      const analysis = await analyzeImage(image.url);
      results.push(analysis);
    }
    
    return results;
  } catch (error) {
    console.error('Error scanning page:', error);
    return [];
  }
}
