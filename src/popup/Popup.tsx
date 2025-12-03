import React, { useState } from "react";
import type { ImageAnalysisResult, AnalysisStatus } from "../types";
import { ImageResult } from "../components/ImageResult";
import { EmptyState } from "../components/EmptyState";

export const Popup: React.FC = () => {
  const [status, setStatus] = useState<AnalysisStatus>({
    scanning: false,
    totalImages: 0,
    analyzedImages: 0,
  });
  const [results, setResults] = useState<ImageAnalysisResult[]>([]);
  const [filter, setFilter] = useState<"all" | "ai" | "authentic">("all");

  const startScan = async () => {
    setStatus({ scanning: true, totalImages: 0, analyzedImages: 0 });
    setResults([]);

    try {
      const { scanCurrentPage } = await import("../utils/imageAnalyzer");
      const analysisResults = await scanCurrentPage();

      setResults(analysisResults);
      setStatus({
        scanning: false,
        totalImages: analysisResults.length,
        analyzedImages: analysisResults.length,
      });
    } catch (error) {
      console.error("Error scanning:", error);
      setStatus({ scanning: false, totalImages: 0, analyzedImages: 0 });
    }
  };

  const filteredResults = results.filter((result) => {
    if (filter === "ai") return result.isAIGenerated === true;
    if (filter === "authentic") return result.hasC2PA && !result.isAIGenerated;
    return true;
  });

  const aiCount = results.filter((r) => r.isAIGenerated === true).length;
  const authenticCount = results.filter(
    (r) => r.hasC2PA && !r.isAIGenerated
  ).length;

  return (
    <div className="w-[400px] h-[600px] bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <h1 className="text-xl font-bold text-gray-900 mb-1">C2PA Finder</h1>
        <p className="text-sm text-gray-600">Detect AI-generated images</p>
      </div>

      {/* Scan Button */}
      <div className="p-4 bg-white border-b border-gray-200">
        <button
          onClick={startScan}
          disabled={status.scanning}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {status.scanning ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Scanning page...</span>
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span>Scan Current Page</span>
            </>
          )}
        </button>
      </div>

      {/* Stats */}
      {results.length > 0 && (
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-lg p-2">
              <div className="text-2xl font-bold text-gray-900">
                {results.length}
              </div>
              <div className="text-xs text-gray-600">Total</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-2">
              <div className="text-2xl font-bold text-purple-700">
                {aiCount}
              </div>
              <div className="text-xs text-purple-600">AI Generated</div>
            </div>
            <div className="bg-green-50 rounded-lg p-2">
              <div className="text-2xl font-bold text-green-700">
                {authenticCount}
              </div>
              <div className="text-xs text-green-600">Authentic</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {results.length > 0 && (
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${
                filter === "all"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("ai")}
              className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${
                filter === "ai"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              AI Only
            </button>
            <button
              onClick={() => setFilter("authentic")}
              className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${
                filter === "authentic"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Authentic
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredResults.length === 0 && !status.scanning && (
          <EmptyState
            title="No images found"
            description="Click 'Scan Current Page' to analyze images on this webpage"
          />
        )}

        <div className="grid gap-3">
          {filteredResults.map((result, index) => (
            <ImageResult key={index} result={result} />
          ))}
        </div>
      </div>
    </div>
  );
};
