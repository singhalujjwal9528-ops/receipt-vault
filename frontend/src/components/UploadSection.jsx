import React, { useRef } from "react";
import { Camera, UploadCloud } from "lucide-react";

export default function UploadSection({ onUpload, uploading }) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) onUpload(file);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-8 text-center shadow-xs">
      <h3 className="text-lg font-bold text-slate-900 mb-1">Add a New Receipt</h3>
      <p className="text-sm text-slate-500 mb-6">
        Scan with your camera or upload a file for instant OCR extraction.
      </p>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex flex-wrap items-center justify-center gap-4">
        {/* Camera Snapshot Button */}
        <button
          type="button"
          disabled={uploading}
          onClick={() => cameraInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition disabled:opacity-50"
        >
          <Camera className="w-5 h-5" />
          Take Photo
        </button>

        {/* File Picker Button */}
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-300 shadow-2xs transition disabled:opacity-50"
        >
          <UploadCloud className="w-5 h-5" />
          Choose File
        </button>
      </div>

      {uploading && (
        <p className="text-sm text-indigo-600 font-medium animate-pulse mt-4">
          Processing image with Tesseract OCR & Gemini AI...
        </p>
      )}
    </div>
  );
}