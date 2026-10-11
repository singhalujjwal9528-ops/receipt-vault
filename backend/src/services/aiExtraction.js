const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CATEGORIES = [
  "Electronics",
  "Groceries",
  "Apparel",
  "Home & Furniture",
  "Health & Beauty",
  "Travel",
  "Dining",
  "Other",
];

const SYSTEM_PROMPT = `You extract structured purchase data from receipt text (which may come from OCR on a photo, so it can be messy or have OCR errors).

Return ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:

{
  "vendor": string,
  "purchaseDate": string in YYYY-MM-DD format,
  "amount": number (total amount paid, no currency symbol),
  "currency": string, 3-letter code, default "USD" if unclear,
  "category": one of ${JSON.stringify(CATEGORIES)},
  "itemDescription": short string describing what was bought,
  "warrantyMonths": number or null (typical warranty length for this product type, if inferable, else null),
  "returnWindowDays": number or null (typical return window if stated or inferable, else null)
}

Rules:
- If a field truly cannot be determined, use null (except vendor, amount, purchaseDate, category, currency — always make a best-effort guess for these).
- Never invent a vendor name or amount that doesn't appear in the text.
- If the date is ambiguous, prefer the most recent plausible date not in the future.`;

/**
 * Sends raw receipt text to Gemini and returns structured JSON.
 * @param {string} rawText
 * @returns {Promise<object>}
 */
async function extractReceiptData(rawText) {
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: `${SYSTEM_PROMPT}\n\nReceipt Text:\n${rawText}`,
  });

  const textBlock = response.text;
  if (!textBlock) {
    throw new Error("No text response from extraction model");
  }

  const cleaned = textBlock.replace(/```json|```/g, "").trim();

  let parsed;
  const { ReceiptExtractionSchema } = require("../schemas/receiptSchema");
  try {
    const rawJson = JSON.parse(cleaned);
    const validated = ReceiptExtractionSchema.safeParse(rawJson);
    parsed = validated.success ? validated.data : ReceiptExtractionSchema.parse(rawJson);
  } catch (err) {
    console.warn("⚠️ [aiExtraction] JSON parse failed, applying safe fallback schema:", err.message);
    parsed = ReceiptExtractionSchema.parse({});
  }

  return parsed;
}

module.exports = { extractReceiptData, CATEGORIES };