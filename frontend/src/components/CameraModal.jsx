import React, { useRef, useState, useEffect } from "react";
import { Camera, X, RefreshCw, AlertCircle } from "lucide-react";

export default function CameraModal({ isOpen, onClose, onCapture }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    // Check if multiple video devices exist
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoInputs = devices.filter((d) => d.kind === "videoinput");
          setHasMultipleCameras(videoInputs.length > 1);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, facingMode]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const startCamera = async (mode) => {
    stopCamera();
    setError("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Unable to access camera. Please verify camera permissions in your browser.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const handleSnap = () => {
    if (!videoRef.current || isCapturing) return;

    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        setIsCapturing(false);
        if (blob) {
          const file = new File([blob], `receipt-snap-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          onCapture(file);
          stopCamera();
          onClose();
        }
      },
      "image/jpeg",
      0.95
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900">Receipt Scanner</span>
              <p className="text-[11px] text-slate-500 font-normal">AI-assisted edge detection</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasMultipleCameras && (
              <button
                type="button"
                onClick={toggleCamera}
                title="Switch Camera"
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Viewport */}
        <div className="relative bg-black flex items-center justify-center min-h-[340px] aspect-[4/3] overflow-hidden">
          {error ? (
            <div className="p-8 text-center max-w-xs space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-sm text-rose-300 font-medium">{error}</p>
              <button
                onClick={() => startCamera(facingMode)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition border border-slate-700"
              >
                Retry Access
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Overlay with Scanner Reticles */}
              <div className="absolute inset-8 pointer-events-none border border-indigo-400/40 rounded-2xl relative overflow-hidden">
                {/* Corner reticle markers */}
                <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-indigo-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-indigo-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-indigo-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-indigo-400 rounded-br-lg" />

                {/* Animated scanning laser */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_12px_rgba(99,102,241,0.8)] animate-scan-laser" />
              </div>

              {/* Guidance Badge */}
              <div className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none">
                <span className="text-[11px] font-semibold text-slate-800 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-md">
                  Align receipt inside the frame
                </span>
              </div>
            </>
          )}
        </div>

        {/* Shutter Controls */}
        <div className="p-5 bg-white border-t border-slate-100 flex items-center justify-center">
          <button
            type="button"
            onClick={handleSnap}
            disabled={!!error || isCapturing}
            className="group relative flex items-center justify-center p-1.5 rounded-full transition disabled:opacity-40"
          >
            <div className="w-16 h-16 rounded-full border-2 border-indigo-300 flex items-center justify-center p-1 group-hover:border-indigo-500 group-hover:scale-105 transition active:scale-95">
              <div className="w-full h-full rounded-full bg-indigo-600 group-hover:bg-indigo-700 shadow-md shadow-indigo-600/30 flex items-center justify-center text-white">
                <Camera className="w-6 h-6" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}