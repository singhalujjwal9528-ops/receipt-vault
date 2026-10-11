import React, { useEffect } from "react";
import {
  X,
  Receipt,
  ShieldCheck,
  Clock,
  Tag,
  DollarSign,
  FileText,
} from "lucide-react";

export default function ReceiptDetailModal({ receipt, isOpen, onClose, getExpiryStatus }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !receipt) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? "N/A"
      : d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
  };

  const getDaysDiff = (dateStr) => {
    if (!dateStr) return null;
    const now = new Date();
    const target = new Date(dateStr);
    return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  };

  const warrantyDays = getDaysDiff(receipt.warrantyExpiresAt);
  const returnDays = getDaysDiff(receipt.returnExpiresAt);
  const warrantyBadge = getExpiryStatus ? getExpiryStatus(receipt.warrantyExpiresAt) : null;
  const returnBadge = getExpiryStatus ? getExpiryStatus(receipt.returnExpiresAt) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                {receipt.vendor || "Receipt Details"}
              </h3>
              <p className="text-xs text-slate-500">
                Purchased on {formatDate(receipt.purchaseDate)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Total Amount</span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                {receipt.currency || "₹"}{" "}
                {Number(receipt.amount || 0).toLocaleString()}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                <span>Category</span>
              </div>
              <p className="text-base font-bold text-indigo-600">
                {receipt.category || "General"}
              </p>
            </div>
          </div>

          {/* Item Description */}
          {receipt.itemDescription && (
            <div className="p-4 rounded-xl bg-slate-50/50 border border-slate-200/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Item Summary</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {receipt.itemDescription}
              </p>
            </div>
          )}

          {/* Policy & Protection Section */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Protection & Deadlines
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Warranty Card */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      Warranty
                    </span>
                    {warrantyBadge && (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${warrantyBadge.color}`}
                      >
                        {warrantyBadge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {formatDate(receipt.warrantyExpiresAt)}
                  </p>
                </div>
                {receipt.warrantyExpiresAt ? (
                  <p className="text-xs text-slate-500 mt-2">
                    {warrantyDays !== null && warrantyDays >= 0
                      ? `${warrantyDays} days remaining`
                      : "Warranty has expired"}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-2">No warranty tracked</p>
                )}
              </div>

              {/* Return Window Card */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <Clock className="w-4 h-4 text-amber-600" />
                      Return Window
                    </span>
                    {returnBadge && (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${returnBadge.color}`}
                      >
                        {returnBadge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {formatDate(receipt.returnExpiresAt)}
                  </p>
                </div>
                {receipt.returnExpiresAt ? (
                  <p className="text-xs text-slate-500 mt-2">
                    {returnDays !== null && returnDays >= 0
                      ? `${returnDays} days remaining`
                      : "Return window has closed"}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-2">No return window</p>
                )}
              </div>
            </div>
          </div>

          {/* Meta Info */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>Record ID: #{receipt.id || "N/A"}</span>
            <span>Recorded via OCR & Gemini Vision</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
