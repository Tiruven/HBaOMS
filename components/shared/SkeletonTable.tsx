// components/shared/SkeletonTable.tsx
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ rows = 5, columns = 6 }) => {
  return (
    <div className="w-full space-y-3">
      {/* Table Header Skeleton */}
      <div className="flex items-center justify-between p-4 bg-slate-100 rounded-t-lg border border-slate-200">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>
      {/* Table Rows Skeleton */}
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-white">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <Skeleton key={cIdx} className="h-4 w-20" />
          ))}
        </div>
      ))}
    </div>
  );
};
