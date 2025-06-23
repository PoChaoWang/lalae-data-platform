// frontend/src/app/(main)/queries/loading.tsx
import React from 'react';

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)] bg-gray-900 text-white">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        <p className="text-lg text-orange-400">Loading...</p>
      </div>
    </div>
  );
}