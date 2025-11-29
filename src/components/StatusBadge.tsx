import React from "react";

interface StatusBadgeProps {
  isAIGenerated: boolean | null;
  hasC2PA: boolean;
  confidence?: number;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  isAIGenerated,
  hasC2PA,
  confidence,
}) => {
  if (isAIGenerated === null) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        Unknown
      </div>
    );
  }

  if (isAIGenerated) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
        AI Generated
        {confidence && (
          <span className="text-xs opacity-75">
            ({Math.round(confidence * 100)}%)
          </span>
        )}
      </div>
    );
  }

  if (hasC2PA) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        Authentic
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
      No C2PA Data
    </div>
  );
};
