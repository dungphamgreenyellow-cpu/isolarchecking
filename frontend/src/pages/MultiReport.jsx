// src/pages/MultiReport.jsx — v7.0
import React from "react";
import { useLocation } from "react-router-dom";

export default function MultiReport() {
  const location = useLocation();
  const files = location.state?.files || [];

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-6 text-gray-800">
      <h1 className="text-2xl font-bold mb-4 text-blue-700">
        Multi-site Report Summary
      </h1>
      <p className="mb-6 text-gray-600">
        {files.length} file(s) uploaded — Each file will generate a site report.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-4xl">
        {files.map((f, i) => (
          <div key={i} className="p-4 border rounded-xl shadow-sm bg-[#F9FBFF]">
            <p className="font-medium">{f.name}</p>
            <p className="text-sm text-gray-500 mt-1">
              Pending parsing / analysis...
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
