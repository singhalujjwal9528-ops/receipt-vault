const { ReceiptExtractionSchema } = require("../src/schemas/receiptSchema");

describe("ReceiptExtractionSchema (Zod Validation & Sanitization)", () => {
  test("should provide sensible defaults for empty or missing inputs", () => {
    const result = ReceiptExtractionSchema.parse({});
    expect(result.vendor).toBe("Unknown Vendor");
    expect(result.amount).toBe(0);
    expect(result.currency).toBe("USD");
    expect(result.category).toBe("Other");
    expect(result.purchaseDate instanceof Date).toBe(true);
    expect(result.itemDescription).toBeNull();
    expect(result.warrantyMonths).toBeNull();
    expect(result.returnWindowDays).toBeNull();
  });

  test("should sanitize string amounts containing currency symbols like '$149.99'", () => {
    const result = ReceiptExtractionSchema.parse({
      vendor: " Best Buy ",
      amount: " $149.99 ",
      currency: "usd",
      category: "electronics",
    });

    expect(result.vendor).toBe("Best Buy");
    expect(result.amount).toBe(149.99);
    expect(result.currency).toBe("USD");
    expect(result.category).toBe("Electronics");
  });

  test("should parse numeric warranty and return windows accurately", () => {
    const result = ReceiptExtractionSchema.parse({
      warrantyMonths: "24",
      returnWindowDays: 14,
    });

    expect(result.warrantyMonths).toBe(24);
    expect(result.returnWindowDays).toBe(14);
  });

  test("should fallback unrecognized categories to 'Other'", () => {
    const result = ReceiptExtractionSchema.parse({
      category: "Space Exploration Equipment",
    });

    expect(result.category).toBe("Other");
  });
});
