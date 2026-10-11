import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import CameraModal from "./components/CameraModal";
import ReceiptDetailModal from "./components/ReceiptDetailModal";
import {
  UploadCloud,
  Search,
  Receipt,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  FileText,
  Clock,
  LogOut,
  Lock,
  Mail,
  User,
  Camera,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  DollarSign,
  X,
  ArrowUpDown,
  Sparkles,
  Tag,
  AlertCircle,
} from "lucide-react";

// NOTE: base URL centralized so upload + auth + SSE all hit the same server.
// In production, set VITE_API_URL in your deployment environment (e.g. Vercel).
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("vault_token") || "");
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("vault_user") || "null")
  );

  // Auth Form State
  const [isLogin, setIsLogin] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Receipt Dashboard State
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [dismissUrgentBanner, setDismissUrgentBanner] = useState(false);

  // Filtering & Sorting State
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");

  useEffect(() => {
    if (token) {
      fetchReceipts();
    }
  }, [token]);

  // --- Real-time SSE listener: picks up worker updates (queued -> processing -> completed/failed) ---
  useEffect(() => {
    if (!token || !user?.id) return;

    const eventSource = new EventSource(
      `${API_BASE}/api/receipts/events?token=${token}&userId=${user.id}`
    );

    eventSource.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error("Bad SSE payload", err);
        return;
      }

      if (data.status === "PROCESSING") {
        setUploadMessage({
          type: "loading",
          text: data.message || "Extracting receipt data with Gemini AI...",
        });
      } else if (data.status === "COMPLETED") {
        setUploadMessage({ type: "success", text: "Receipt processed & added to vault!" });
        setReceipts((prev) => [data.receipt, ...prev]);
        setUploading(false);
        setTimeout(() => setUploadMessage(null), 3500);
      } else if (data.status === "FAILED") {
        setUploadMessage({
          type: "error",
          text: data.message || "Failed to parse receipt. Please verify image clarity.",
        });
        setUploading(false);
        setTimeout(() => setUploadMessage(null), 5000);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error", err);
    };

    return () => {
      eventSource.close();
    };
  }, [token, user]);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/receipts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReceipts(res.data.receipts || res.data || []);
    } catch (err) {
      console.error("Failed to load receipts", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (eventOrFile) => {
    let file = null;
    if (eventOrFile?.target?.files) {
      file = eventOrFile.target.files[0];
    } else if (eventOrFile instanceof File) {
      file = eventOrFile;
    }

    if (!file) return;

    const formData = new FormData();
    formData.append("receipt", file);

    try {
      setUploading(true);
      setUploadMessage({ type: "loading", text: "Uploading receipt..." });

      await axios.post(`${API_BASE}/api/receipts/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setUploadMessage({
        type: "loading",
        text: "Receipt queued for OCR & AI analysis...",
      });
    } catch (err) {
      setUploading(false);
      setUploadMessage({
        type: "error",
        text: err.response?.data?.error || "Failed to queue receipt. Please try again.",
      });
      setTimeout(() => setUploadMessage(null), 5000);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("vault_token");
    localStorage.removeItem("vault_user");
    setToken("");
    setUser(null);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setIsAuthenticating(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const payload = isLogin
      ? { email: authEmail, password: authPassword }
      : { name: authName, email: authEmail, password: authPassword };

    try {
      const res = await axios.post(`${API_BASE}${endpoint}`, payload);
      localStorage.setItem("vault_token", res.data.token);
      localStorage.setItem("vault_user", JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (err) {
      setAuthError(err.response?.data?.error || "Authentication failed. Please check your credentials.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const getExpiryStatus = (dateString) => {
    if (!dateString) return null;
    const now = new Date();
    const target = new Date(dateString);
    if (isNaN(target.getTime())) return null;

    const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: "Expired",
        color: "bg-rose-50 text-rose-700 border-rose-200",
        status: "expired",
      };
    }
    if (diffDays <= 7) {
      return {
        label: `Expires in ${diffDays}d`,
        color: "bg-amber-50 text-amber-800 border-amber-300 font-semibold",
        status: "urgent",
      };
    }
    if (diffDays <= 30) {
      return {
        label: `${diffDays} days left`,
        color: "bg-amber-50/80 text-amber-700 border-amber-200",
        status: "soon",
      };
    }
    return {
      label: "Active",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      status: "active",
    };
  };

  // Urgent alerts for top notification banner
  const urgentAlerts = useMemo(() => {
    return receipts.flatMap((r) => {
      const alerts = [];
      const now = new Date();

      if (r.warrantyExpiresAt) {
        const target = new Date(r.warrantyExpiresAt);
        if (!isNaN(target.getTime())) {
          const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
          if (diff >= 0 && diff <= 7) {
            alerts.push({
              vendor: r.vendor,
              type: "Warranty",
              label: diff === 0 ? "Expires today" : `Expires in ${diff}d`,
              receipt: r,
            });
          }
        }
      }
      if (r.returnExpiresAt) {
        const target = new Date(r.returnExpiresAt);
        if (!isNaN(target.getTime())) {
          const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
          if (diff >= 0 && diff <= 7) {
            alerts.push({
              vendor: r.vendor,
              type: "Return Window",
              label: diff === 0 ? "Expires today" : `Expires in ${diff}d`,
              receipt: r,
            });
          }
        }
      }
      return alerts;
    });
  }, [receipts]);

  // Executive Metric Calculations
  const totalSpent = useMemo(() => {
    return receipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [receipts]);

  const activeWarrantiesCount = useMemo(() => {
    const now = new Date();
    return receipts.filter((r) => {
      if (!r.warrantyExpiresAt) return false;
      const target = new Date(r.warrantyExpiresAt);
      return !isNaN(target.getTime()) && target >= now;
    }).length;
  }, [receipts]);

  // Categories list
  const categoriesList = useMemo(() => {
    const set = new Set();
    receipts.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [receipts]);

  // Filtered & Sorted Receipts
  const filteredReceipts = useMemo(() => {
    return receipts
      .filter((r) => {
        // Search query
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchVendor = (r.vendor || "").toLowerCase().includes(q);
          const matchDesc = (r.itemDescription || "").toLowerCase().includes(q);
          const matchCat = (r.category || "").toLowerCase().includes(q);
          const matchAmount = String(r.amount || "").includes(q);
          if (!matchVendor && !matchDesc && !matchCat && !matchAmount) {
            return false;
          }
        }

        // Category filter
        if (selectedCategory !== "all") {
          if ((r.category || "").toLowerCase() !== selectedCategory.toLowerCase()) {
            return false;
          }
        }

        // Status filter
        if (selectedStatus !== "all") {
          const now = new Date();
          if (selectedStatus === "active-warranty") {
            if (!r.warrantyExpiresAt) return false;
            const diff = Math.ceil((new Date(r.warrantyExpiresAt) - now) / (1000 * 60 * 60 * 24));
            if (diff < 0) return false;
          } else if (selectedStatus === "expiring-soon") {
            let isExpiring = false;
            if (r.warrantyExpiresAt) {
              const diff = Math.ceil((new Date(r.warrantyExpiresAt) - now) / (1000 * 60 * 60 * 24));
              if (diff >= 0 && diff <= 30) isExpiring = true;
            }
            if (r.returnExpiresAt) {
              const diff = Math.ceil((new Date(r.returnExpiresAt) - now) / (1000 * 60 * 60 * 24));
              if (diff >= 0 && diff <= 30) isExpiring = true;
            }
            if (!isExpiring) return false;
          } else if (selectedStatus === "expired") {
            if (!r.warrantyExpiresAt) return false;
            const diff = Math.ceil((new Date(r.warrantyExpiresAt) - now) / (1000 * 60 * 60 * 24));
            if (diff >= 0) return false;
          } else if (selectedStatus === "return-window") {
            if (!r.returnExpiresAt) return false;
            const diff = Math.ceil((new Date(r.returnExpiresAt) - now) / (1000 * 60 * 60 * 24));
            if (diff < 0) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "date-desc") {
          return new Date(b.purchaseDate || 0) - new Date(a.purchaseDate || 0);
        }
        if (sortBy === "date-asc") {
          return new Date(a.purchaseDate || 0) - new Date(b.purchaseDate || 0);
        }
        if (sortBy === "amount-desc") {
          return Number(b.amount || 0) - Number(a.amount || 0);
        }
        if (sortBy === "amount-asc") {
          return Number(a.amount || 0) - Number(b.amount || 0);
        }
        if (sortBy === "vendor-asc") {
          return (a.vendor || "").localeCompare(b.vendor || "");
        }
        return 0;
      });
  }, [receipts, search, selectedCategory, selectedStatus, sortBy]);

  const handleOpenDetail = (receipt) => {
    setSelectedReceipt(receipt);
    setIsDetailModalOpen(true);
  };

  // -------------------------------------------------------------
  // Unauthenticated Auth Screen (Clean White Theme)
  // -------------------------------------------------------------
  if (!token) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-10 selection:bg-indigo-100 selection:text-indigo-800">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Brand / Features Panel */}
          <div className="lg:col-span-6 space-y-6 lg:pr-6">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold tracking-wide shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Intelligent Expense & Warranty Vault</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Manage receipts without the chaos.
            </h1>

            <p className="text-slate-600 text-base leading-relaxed">
              Capture or upload receipts in seconds. Automated OCR extracts dates, vendors,
              and amounts while actively monitoring warranties and return deadlines.
            </p>

            {/* Feature Highlights */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Automated OCR Extraction</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Extracts vendor, item descriptions, and totals automatically.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Warranty & Return Watchdog</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time alerts before your warranty coverage or return window expires.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Live Pipeline Sync</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Server-Sent Events update your dashboard in real-time as workers finish.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Auth Card */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="bg-white border border-slate-200/90 p-8 sm:p-10 rounded-3xl w-full max-w-md shadow-xl relative">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    {isLogin ? "Welcome Back" : "Create Account"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isLogin
                      ? "Enter your credentials to access your vault"
                      : "Start tracking warranties and expenses today"}
                  </p>
                </div>
              </div>

              {/* Error Notice */}
              {authError && (
                <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {!isLogin && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition"
                      placeholder="alex@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-11 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold text-sm rounded-xl transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {isAuthenticating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>{isLogin ? "Sign In" : "Create Account"}</span>
                  )}
                </button>
              </form>

              {/* Toggle Login/Register */}
              <div className="pt-6 mt-6 border-t border-slate-100 text-center text-xs text-slate-500">
                {isLogin ? "Don't have an account yet? " : "Already registered? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setAuthError("");
                  }}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                >
                  {isLogin ? "Sign Up" : "Log In"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Authenticated Main Dashboard (Clean White Aesthetic)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-indigo-100 selection:text-indigo-800">
      {/* 1. TOP HEADER / APP BAR */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-600/25">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-slate-900 tracking-tight">ReceiptVault</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block font-medium">
                Receipts & Warranty Lifecycle
              </p>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3">
            {/* Live SSE Status indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Sync</span>
            </div>

            {/* User Pill */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 pl-2 pr-3 py-1 rounded-xl">
              <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                {user?.name ? user.name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : "U"}
              </div>
              <span className="text-xs font-semibold text-slate-700 max-w-[120px] sm:max-w-[180px] truncate">
                {user?.name || user?.email}
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 shadow-2xs transition"
              title="Sign Out"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 2. URGENT EXPIRY BANNER */}
        {urgentAlerts.length > 0 && !dismissUrgentBanner && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 mt-0.5 shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-amber-900">
                    Attention Needed: {urgentAlerts.length} upcoming deadline
                    {urgentAlerts.length > 1 ? "s" : ""}
                  </h3>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {urgentAlerts.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleOpenDetail(item.receipt)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100/80 hover:bg-amber-100 text-amber-900 border border-amber-200 transition cursor-pointer"
                    >
                      <Clock className="w-3 h-3 text-amber-600" />
                      <strong>{item.vendor}</strong>: {item.type} ({item.label})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setDismissUrgentBanner(true)}
              className="self-end sm:self-center p-1.5 rounded-lg text-amber-700 hover:text-amber-950 hover:bg-amber-100 transition text-xs"
              title="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3. EXECUTIVE KPI METRICS ROW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Spend */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Spend
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight tabular-nums">
              ₹ {totalSpent?.toLocaleString() || 0}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">Across all logged receipts</p>
          </div>

          {/* Total Receipts */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Receipts Logged
              </span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight tabular-nums">
              {receipts.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              {filteredReceipts.length !== receipts.length
                ? `${filteredReceipts.length} matching filter`
                : "Active in database"}
            </p>
          </div>

          {/* Active Warranties */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Warranties
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-2 tracking-tight tabular-nums">
              {activeWarrantiesCount}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">Protected items currently valid</p>
          </div>

          {/* Urgent Deadlines */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Urgent Deadlines
              </span>
              <div
                className={`p-1.5 rounded-lg border ${
                  urgentAlerts.length > 0
                    ? "bg-amber-50 text-amber-600 border-amber-200"
                    : "bg-slate-50 text-slate-400 border-slate-200"
                }`}
              >
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p
              className={`text-2xl sm:text-3xl font-extrabold mt-2 tracking-tight tabular-nums ${
                urgentAlerts.length > 0 ? "text-amber-600" : "text-slate-900"
              }`}
            >
              {urgentAlerts.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">Expiring within 7 days</p>
          </div>
        </div>

        {/* 4. SMART UPLOAD & CAPTURE ZONE */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-6 sm:p-8 rounded-3xl border-2 border-dashed transition-all relative overflow-hidden text-center ${
            isDragOver
              ? "border-indigo-600 bg-indigo-50/40 shadow-sm"
              : "border-slate-300 bg-[#f8fafc]/70 hover:border-indigo-400 hover:bg-indigo-50/10"
          }`}
        >
          <input
            id="file-upload-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />

          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-2xs">
              <UploadCloud className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                {uploading
                  ? "Extracting receipt data with Gemini AI..."
                  : "Upload a receipt or capture live snapshot"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Drag and drop your file here, or select an option below
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                disabled={uploading}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer shadow-sm shadow-indigo-600/20 active:scale-[0.98] ${
                  uploading ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Take Photo</span>
              </button>

              <label
                htmlFor="file-upload-input"
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-2xs transition cursor-pointer active:scale-[0.98] ${
                  uploading ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>Browse Files</span>
              </label>
            </div>

            <p className="text-[11px] text-slate-400 font-medium">
              PDF, PNG, JPG, or WEBP up to 10MB • Auto-extracts item, amount & warranty
            </p>
          </div>
        </div>

        {/* Upload Feedback Banner / Status */}
        {uploadMessage && (
          <div
            className={`p-4 rounded-2xl border flex items-center gap-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-300 ${
              uploadMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : uploadMessage.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-indigo-50/70 border-indigo-200 text-indigo-900"
            }`}
          >
            {uploadMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            ) : uploadMessage.type === "error" ? (
              <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
            ) : (
              <RefreshCw className="w-5 h-5 animate-spin shrink-0 text-indigo-600" />
            )}
            <div className="flex-1">
              <span className="text-sm font-semibold">{uploadMessage.text}</span>
            </div>
          </div>
        )}

        {/* 5. VISUAL ANALYTICS DASHBOARD */}
        {receipts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Visual Insights
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="text-xs text-slate-500 hover:text-slate-900 transition flex items-center gap-1 font-semibold"
              >
                <span>{showAnalytics ? "Collapse" : "Expand"}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${showAnalytics ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            {showAnalytics && <AnalyticsDashboard receipts={receipts} />}
          </div>
        )}

        {/* 6. RECEIPTS LIST / DATA TABLE */}
        <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs">
          {/* Table Toolbar: Search, Filters, Sorting */}
          <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by vendor, item, category, or amount..."
                  className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-9 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Controls Row */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Category Selector */}
                <div className="relative">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-white border border-slate-300 text-slate-700 text-xs rounded-xl px-3 py-2 pr-7 focus:outline-none focus:border-indigo-600 appearance-none font-semibold cursor-pointer shadow-2xs"
                  >
                    <option value="all">All Categories</option>
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                </div>

                {/* Status Selector */}
                <div className="relative">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="bg-white border border-slate-300 text-slate-700 text-xs rounded-xl px-3 py-2 pr-7 focus:outline-none focus:border-indigo-600 appearance-none font-semibold cursor-pointer shadow-2xs"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active-warranty">Active Warranty</option>
                    <option value="expiring-soon">Expiring Soon (30d)</option>
                    <option value="expired">Expired</option>
                    <option value="return-window">Active Return Window</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                </div>

                {/* Sort Order Selector */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-white border border-slate-300 text-slate-700 text-xs rounded-xl px-3 py-2 pr-7 focus:outline-none focus:border-indigo-600 appearance-none font-semibold cursor-pointer shadow-2xs"
                  >
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="amount-desc">Amount: High to Low</option>
                    <option value="amount-asc">Amount: Low to High</option>
                    <option value="vendor-asc">Vendor: A to Z</option>
                  </select>
                  <ArrowUpDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                </div>

                {/* Reset Filters */}
                {(search || selectedCategory !== "all" || selectedStatus !== "all" || sortBy !== "date-desc") && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setSelectedCategory("all");
                      setSelectedStatus("all");
                      setSortBy("date-desc");
                    }}
                    className="text-xs text-indigo-700 hover:text-indigo-800 px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 font-semibold"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Receipts Content */}
          {loading ? (
            <div className="p-16 text-center text-slate-500 space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-indigo-600" />
              <p className="text-sm font-semibold">Fetching receipts from vault...</p>
            </div>
          ) : receipts.length === 0 ? (
            <div className="p-16 text-center text-slate-500 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                <FileText className="w-8 h-8 opacity-60" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">No receipts found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 font-medium">
                  Upload your first receipt using the camera or file picker above to start
                  tracking warranties and spending.
                </p>
              </div>
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="p-14 text-center text-slate-500 space-y-3">
              <Search className="w-10 h-10 mx-auto text-slate-400" />
              <div>
                <p className="text-sm font-bold text-slate-900">No matching receipts</p>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Try adjusting your search terms or filters to find what you're looking for.
                </p>
              </div>
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("all");
                  setSelectedStatus("all");
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs text-slate-800 font-semibold transition"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="px-6 py-4">Vendor & Item</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Purchased</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Warranty</th>
                      <th className="px-6 py-4">Return Window</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReceipts.map((r) => {
                      const warrantyBadge = getExpiryStatus(r.warrantyExpiresAt);
                      const returnBadge = getExpiryStatus(r.returnExpiresAt);
                      const vendorInitial = (r.vendor || "R")[0].toUpperCase();

                      return (
                        <tr
                          key={r.id}
                          onClick={() => handleOpenDetail(r)}
                          className="hover:bg-slate-50/80 transition cursor-pointer group"
                        >
                          {/* Vendor & Description */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-700 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0 transition">
                                {vendorInitial}
                              </div>
                              <div className="min-w-0 max-w-xs">
                                <p className="truncate font-bold text-slate-900 group-hover:text-indigo-600 transition">
                                  {r.vendor || "Unknown Vendor"}
                                </p>
                                {r.itemDescription ? (
                                  <p className="text-xs font-normal text-slate-500 truncate mt-0.5">
                                    {r.itemDescription}
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-slate-400">No description</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                              <Tag className="w-3 h-3" />
                              {r.category || "General"}
                            </span>
                          </td>

                          {/* Purchase Date */}
                          <td className="px-6 py-4 text-slate-600 text-xs font-medium">
                            {r.purchaseDate ? (
                              new Date(r.purchaseDate).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="px-6 py-4 font-bold text-slate-900 tabular-nums">
                            {r.currency || "₹"} {Number(r.amount || 0).toLocaleString()}
                          </td>

                          {/* Warranty */}
                          <td className="px-6 py-4">
                            {r.warrantyExpiresAt && warrantyBadge ? (
                              <div className="flex flex-col gap-0.5 items-start">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${warrantyBadge.color}`}
                                >
                                  <ShieldAlert className="w-3 h-3" />
                                  {warrantyBadge.label}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {new Date(r.warrantyExpiresAt).toLocaleDateString()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>

                          {/* Return Window */}
                          <td className="px-6 py-4">
                            {r.returnExpiresAt && returnBadge ? (
                              <div className="flex flex-col gap-0.5 items-start">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${returnBadge.color}`}
                                >
                                  <Clock className="w-3 h-3" />
                                  {returnBadge.label}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {new Date(r.returnExpiresAt).toLocaleDateString()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="px-6 py-4 text-right">
                            <span className="text-xs font-semibold text-slate-400 group-hover:text-indigo-600 flex items-center justify-end gap-1 transition">
                              Details
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View (Avoids awkward horizontal scrolling) */}
              <div className="block md:hidden divide-y divide-slate-100">
                {filteredReceipts.map((r) => {
                  const warrantyBadge = getExpiryStatus(r.warrantyExpiresAt);
                  const returnBadge = getExpiryStatus(r.returnExpiresAt);
                  const vendorInitial = (r.vendor || "R")[0].toUpperCase();

                  return (
                    <div
                      key={r.id}
                      onClick={() => handleOpenDetail(r)}
                      className="p-4 hover:bg-slate-50/80 transition active:bg-slate-100/70 cursor-pointer space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
                            {vendorInitial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate text-sm">
                              {r.vendor || "Unknown Vendor"}
                            </p>
                            <p className="text-xs text-slate-500 font-medium">
                              {r.purchaseDate
                                ? new Date(r.purchaseDate).toLocaleDateString()
                                : "No date"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="font-extrabold text-slate-900 tabular-nums text-base">
                            {r.currency || "₹"} {Number(r.amount || 0).toLocaleString()}
                          </p>
                          <span className="inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold">
                            {r.category || "General"}
                          </span>
                        </div>
                      </div>

                      {r.itemDescription && (
                        <p className="text-xs text-slate-600 line-clamp-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {r.itemDescription}
                        </p>
                      )}

                      {/* Status row on mobile */}
                      <div className="flex flex-wrap gap-2 text-xs pt-1">
                        {r.warrantyExpiresAt && warrantyBadge && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${warrantyBadge.color}`}
                          >
                            <ShieldAlert className="w-3 h-3" />
                            Warranty: {warrantyBadge.label}
                          </span>
                        )}
                        {r.returnExpiresAt && returnBadge && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${returnBadge.color}`}
                          >
                            <Clock className="w-3 h-3" />
                            Return: {returnBadge.label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Table Footer Count */}
              <div className="px-6 py-3.5 border-t border-slate-200 bg-[#f8fafc] flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>
                  Showing {filteredReceipts.length} of {receipts.length} receipt
                  {receipts.length === 1 ? "" : "s"}
                </span>
                {filteredReceipts.length !== receipts.length && (
                  <span className="text-indigo-600 font-semibold">Filtered results active</span>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* 7. Live Camera Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(file) => {
          handleFileUpload(file);
        }}
      />

      {/* 8. Receipt Detail Modal */}
      <ReceiptDetailModal
        receipt={selectedReceipt}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedReceipt(null);
        }}
        getExpiryStatus={getExpiryStatus}
      />
    </div>
  );
}
