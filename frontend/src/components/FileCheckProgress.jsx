// src/components/FileCheckProgress.jsx — v7.0
import React from "react";

export default function FileCheckProgress({ file, progress, status, message }) {
  const color =
    status === "ok"
      ? "bg-green-500"
      : status === "error"
      ? "bg-red-500"
      : "bg-blue-500";

  return (
    <div className="w-full bg-white border border-gray-200 rounded-xl p-3 shadow-sm mb-2">
      <div className="flex justify-between text-sm font-medium text-gray-700">
        <span>{file.name}</span>
        <span>
          {status === "checking"
            ? `${progress}%`
            : status === "ok"
            ? "✅ OK"
            : "❌ Error"}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
        <div
          className={`${color} h-full transition-all duration-300`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      {message && (
        <p className="text-xs text-gray-500 mt-1 italic">{message}</p>
      )}
    </div>
  );
}
