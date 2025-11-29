import React from "react";
import type { ImageAnalysisResult } from "../types";
import { StatusBadge } from "./StatusBadge";

interface ImageResultProps {
  result: ImageAnalysisResult;
}

export const ImageResult: React.FC<ImageResultProps> = ({ result }) => {
  return (
    <div className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-video bg-gray-100 relative overflow-hidden">
        <img
          src={result.url}
          alt="Analyzed image"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <StatusBadge
            isAIGenerated={result.isAIGenerated}
            hasC2PA={result.hasC2PA}
            confidence={result.confidence}
          />
        </div>

        {result.metadata && (
          <div className="text-xs text-gray-600 space-y-1">
            {result.metadata.creator && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Creator:</span>
                <span className="truncate">{result.metadata.creator}</span>
              </div>
            )}
            {result.metadata.software && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Software:</span>
                <span className="truncate">{result.metadata.software}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
