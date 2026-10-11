export function getExpiryStatus(dateStr) {
  if (!dateStr) return null;

  const targetDate = new Date(dateStr);
  const now = new Date();
  const diffTime = targetDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: "expired", label: "Expired", color: "bg-rose-50 text-rose-700 border-rose-200" };
  }
  if (diffDays <= 7) {
    return { status: "urgent", label: `Expires in ${diffDays}d`, color: "bg-amber-50 text-amber-800 border-amber-300 font-semibold" };
  }
  if (diffDays <= 30) {
    return { status: "soon", label: `${diffDays} days left`, color: "bg-amber-50/80 text-amber-700 border-amber-200" };
  }
  return { status: "active", label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}