"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function DirectorySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 p-2 hover:bg-gray-900/50 pr-4 animate-pulse"
        >
          <div className="w-4 h-4 ml-2 bg-gray-700 rounded" />
          <div className="w-4 h-4 bg-gray-700 rounded shrink-0" />
          <div className="flex-1 h-4 bg-gray-700 rounded" />
          <div className="flex gap-1 shrink-0">
            <div className="w-8 h-8 bg-gray-700 rounded" />
            <div className="w-8 h-8 bg-gray-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
