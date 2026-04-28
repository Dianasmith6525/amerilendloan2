import React from "react";

export const SkeletonCard = () => {
  return (
    <div className="animate-pulse border-l-4 border-l-gray-300 rounded-lg p-6 bg-white border border-gray-200">
      {/* Header skeleton */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-100 rounded w-1/2 mb-4"></div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-2"></div>
              <div className="h-5 bg-gray-200 rounded w-2/3"></div>
            </div>
            <div>
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-2"></div>
              <div className="h-5 bg-gray-200 rounded w-2/3"></div>
            </div>
            <div>
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-2"></div>
              <div className="h-5 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </div>
        <div className="h-10 bg-gray-200 rounded w-24 md:w-32"></div>
      </div>
    </div>
  );
};

export const SkeletonPaymentCard = () => {
  return (
    <div className="animate-pulse bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="h-5 bg-gray-200 rounded w-1/3"></div>
        <div className="h-6 bg-gray-200 rounded-full w-20"></div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="h-3 bg-gray-100 rounded w-2/3 mb-2"></div>
          <div className="h-5 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div>
          <div className="h-3 bg-gray-100 rounded w-2/3 mb-2"></div>
          <div className="h-5 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
      <div className="h-4 bg-gray-100 rounded w-full mb-2"></div>
      <div className="h-4 bg-gray-100 rounded w-5/6"></div>
    </div>
  );
};

export const SkeletonTimeline = () => {
  return (
    <div className="animate-pulse mt-6 p-4 border border-gray-200 rounded-lg">
      <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="flex justify-between mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center flex-1">
            <div className="h-10 w-10 rounded-full bg-gray-200 mb-3"></div>
            <div className="h-3 bg-gray-100 rounded w-2/3 mb-2"></div>
            <div className="h-2 bg-gray-100 rounded w-1/2"></div>
          </div>
        ))}
      </div>
      <div className="h-16 bg-gray-100 rounded mt-4"></div>
    </div>
  );
};

export const SkeletonDetailSection = () => {
  return (
    <div className="animate-pulse mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <div className="h-5 bg-gray-300 rounded w-1/3 mb-4"></div>
      <div className="space-y-3">
        <div className="flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    </div>
  );
};

export const SkeletonAdminTable = () => {
  return (
    <div className="animate-pulse border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-100 p-4 flex gap-4">
        <div className="h-4 bg-gray-200 rounded flex-1"></div>
        <div className="h-4 bg-gray-200 rounded flex-1"></div>
        <div className="h-4 bg-gray-200 rounded flex-1"></div>
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </div>
      {/* Rows */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="border-t p-4 flex gap-4">
          <div className="h-4 bg-gray-100 rounded flex-1"></div>
          <div className="h-4 bg-gray-100 rounded flex-1"></div>
          <div className="h-4 bg-gray-100 rounded flex-1"></div>
          <div className="h-4 bg-gray-100 rounded w-20"></div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonApplyForm = () => {
  return (
    <div className="animate-pulse space-y-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i}>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-10 bg-gray-100 rounded"></div>
        </div>
      ))}
      <div className="h-12 bg-gray-200 rounded mt-6"></div>
    </div>
  );
};

export const SkeletonStats = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse bg-white p-6 rounded-lg border border-gray-200">
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
          <div className="h-8 bg-gray-300 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
};
