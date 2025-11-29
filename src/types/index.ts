export interface ImageAnalysisResult {
  url: string;
  hasC2PA: boolean;
  isAIGenerated: boolean | null;
  confidence?: number;
  metadata?: {
    creator?: string;
    created?: string;
    software?: string;
  };
}

export interface AnalysisStatus {
  scanning: boolean;
  totalImages: number;
  analyzedImages: number;
}
