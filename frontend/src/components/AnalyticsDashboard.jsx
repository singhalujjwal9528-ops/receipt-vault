import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import { TrendingUp, PieChart as PieIcon, ShieldCheck } from "lucide-react";

const PALETTE = ["#4f46e5", "#059669", "#d97706", "#7c3aed", "#e11d48", "#0891b2"];

const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl shadow-lg text-xs">
        <p className="text-slate-500 font-medium mb-1">{label}</p>
        <p className="text-slate-900 font-extrabold text-sm tabular-nums">
          ₹ {Number(payload[0].value).toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl shadow-lg text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: payload[0].payload.fill }}
          />
          <span className="text-slate-700 font-semibold">{payload[0].name}</span>
        </div>
        <p className="text-slate-900 font-extrabold text-sm tabular-nums">
          ₹ {Number(payload[0].value).toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export default function AnalyticsDashboard({ receipts }) {
  if (!receipts || receipts.length === 0) return null;

  // 1. Calculate Category Spending
  const categoryMap = receipts.reduce((acc, r) => {
    const cat = r.category || "Uncategorized";
    acc[cat] = (acc[cat] || 0) + Number(r.amount || 0);
    return acc;
  }, {});

  const categoryData = Object.keys(categoryMap)
    .map((cat) => ({
      name: cat,
      value: Math.round(categoryMap[cat]),
    }))
    .sort((a, b) => b.value - a.value);

  // 2. Calculate Monthly Spending Trends (chronologically sorted)
  const monthMap = {};
  receipts.forEach((r) => {
    if (!r.purchaseDate) return;
    const date = new Date(r.purchaseDate);
    if (isNaN(date.getTime())) return;
    const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const displayMonth = date.toLocaleString("default", { month: "short", year: "2-digit" });

    if (!monthMap[sortKey]) {
      monthMap[sortKey] = { month: displayMonth, total: 0, sortKey };
    }
    monthMap[sortKey].total += Number(r.amount || 0);
  });

  const monthlyData = Object.values(monthMap)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .slice(-6); // last 6 active months

  // 3. Calculate Warranty Health Stats
  const now = new Date();
  let activeWarranties = 0;
  let expiringSoon = 0;
  let expiredWarranties = 0;

  receipts.forEach((r) => {
    if (!r.warrantyExpiresAt) return;
    const diffDays = Math.ceil((new Date(r.warrantyExpiresAt) - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) expiredWarranties++;
    else if (diffDays <= 30) expiringSoon++;
    else activeWarranties++;
  });

  const totalTracked = activeWarranties + expiringSoon + expiredWarranties;
  const healthScore = totalTracked > 0 ? Math.round((activeWarranties / totalTracked) * 100) : 100;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Monthly Spending Trend Bar Chart */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span>Monthly Spending</span>
          </div>
          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
            Recent
          </span>
        </div>

        <div className="h-52 w-full mt-2">
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
                <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              No dated transactions yet
            </div>
          )}
        </div>
      </div>

      {/* Category Breakdown Pie Chart */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <div className="p-1.5 rounded-lg bg-pink-50 text-pink-600 border border-pink-100">
              <PieIcon className="w-4 h-4" />
            </div>
            <span>Category Breakdown</span>
          </div>
          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
            {categoryData.length} Categories
          </span>
        </div>

        <div className="h-52 w-full mt-2">
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={74}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  formatter={(value) => <span className="text-slate-600 font-medium">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              No categorized expenses
            </div>
          )}
        </div>
      </div>

      {/* Warranty Health Gauge Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span>Warranty Health</span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
            {totalTracked} Tracked
          </span>
        </div>

        <div className="text-center my-auto py-2">
          <div className="inline-flex items-baseline gap-1">
            <span className="text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              {healthScore}%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Protection Coverage Ratio</p>

          <div className="w-full bg-slate-100 h-2.5 rounded-full mt-4 overflow-hidden border border-slate-200/50">
            <div
              className={`h-full transition-all duration-700 rounded-full ${
                healthScore >= 75
                  ? "bg-emerald-500"
                  : healthScore >= 40
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
              style={{ width: `${Math.max(5, healthScore)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs pt-3.5 border-t border-slate-100 mt-2">
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="block text-emerald-600 font-extrabold tabular-nums text-sm">
              {activeWarranties}
            </span>
            <span className="text-slate-500 text-[10px] uppercase font-semibold">Active</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="block text-amber-600 font-extrabold tabular-nums text-sm">
              {expiringSoon}
            </span>
            <span className="text-slate-500 text-[10px] uppercase font-semibold">Expiring</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="block text-rose-600 font-extrabold tabular-nums text-sm">
              {expiredWarranties}
            </span>
            <span className="text-slate-500 text-[10px] uppercase font-semibold">Expired</span>
          </div>
        </div>
      </div>
    </div>
  );
}