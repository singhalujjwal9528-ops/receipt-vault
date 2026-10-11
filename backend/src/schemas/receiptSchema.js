const { z } = require("zod");

const VALID_CATEGORIES = [
  "Electronics",
  "Groceries",
  "Apparel",
  "Home & Furniture",
  "Health & Beauty",
  "Travel",
  "Dining",
  "Utilities",
  "Other",
];

/**
 * Zod schema to validate, sanitize, and provide safe fallbacks
 * for LLM-extracted receipt metadata.
 */
const ReceiptExtractionSchema = z.object({
  vendor: z
    .string()
    .nullish()
    .transform((val) => (val && val.trim() ? val.trim() : "Unknown Vendor")),
  amount: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((val) => {
      if (typeof val === "number" && !isNaN(val)) return Math.max(0, val);
      if (typeof val === "string") {
        const cleaned = parseFloat(val.replace(/[^0-9.-]+/g, ""));
        return isNaN(cleaned) ? 0 : Math.max(0, cleaned);
      }
      return 0;
    }),
  currency: z
    .string()
    .nullish()
    .transform((val) => (val && val.trim().length === 3 ? val.trim().toUpperCase() : "USD")),
  purchaseDate: z
    .union([z.string(), z.date()])
    .nullish()
    .transform((val) => {
      if (!val) return new Date();
      const parsed = new Date(val);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    }),
  category: z
    .string()
    .nullish()
    .transform((val) => {
      if (!val) return "Other";
      const match = VALID_CATEGORIES.find(
        (c) => c.toLowerCase() === val.trim().toLowerCase()
      );
      return match || "Other";
    }),
  itemDescription: z
    .string()
    .nullish()
    .transform((val) => (val && val.trim() ? val.trim() : null)),
  warrantyMonths: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0 ? Math.round(num) : null;
    }),
  returnWindowDays: z
    .union([z.number(), z.string()])
    .nullish()
    .transform((val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0 ? Math.round(num) : null;
    }),
});

module.exports = {
  ReceiptExtractionSchema,
  VALID_CATEGORIES,
};
