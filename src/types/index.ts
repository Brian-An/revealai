export interface PageImage {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface CredentialEvidence {
  verdict: "ai" | "unknown" | "error";
  summary: string;
  explanation: string;
  validation: "trusted" | "untrusted" | "invalid" | "missing" | "unavailable";
  software?: string;
  issuer?: string;
}

export interface ImageAnalysisResult extends PageImage, CredentialEvidence {}

export interface PageScan {
  hostname: string;
  limited: boolean;
  results: ImageAnalysisResult[];
}

export interface ScanProgress extends PageScan {
  total: number;
}
