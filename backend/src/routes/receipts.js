const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const prisma = require("../db");
const { receiptQueue } = require("../queue");
const { extractReceiptData } = require("../services/aiExtraction");
const { sendExpiryAlerts } = require("../services/scheduler");

const router = express.Router();

// Configure multer storage for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: JPG, PNG, WEBP, HEIC, PDF`));
    }
  },
});

// Helper functions for expiry date calculations
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + Number(months));
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days));
  return d;
}

/**
 * GET /api/receipts/analytics
 * Comprehensive spending & warranty analytics for charts and dashboards
 */
router.get("/analytics", async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized. Token missing." });
  }

  try {
    const receipts = await prisma.receipt.findMany({
      where: { userId },
      orderBy: { purchaseDate: "asc" },
    });

    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(now.getDate() + 30);
    const in7Days = new Date();
    in7Days.setDate(now.getDate() + 7);

    let totalSpent = 0;
    const categoryMap = {};
    const monthlyMap = {};

    let activeWarranties = 0;
    let warrantiesExpiringSoon = 0;
    let activeReturns = 0;
    let returnsExpiringSoon = 0;
    const upcomingExpirations = [];

    receipts.forEach((r) => {
      const amount = Number(r.amount) || 0;
      totalSpent += amount;

      // Category aggregation
      const cat = r.category || "Other";
      if (!categoryMap[cat]) {
        categoryMap[cat] = { category: cat, totalAmount: 0, count: 0 };
      }
      categoryMap[cat].totalAmount += amount;
      categoryMap[cat].count += 1;

      // Monthly spending trend (YYYY-MM)
      const pDate = new Date(r.purchaseDate);
      if (!isNaN(pDate.getTime())) {
        const monthKey = pDate.toISOString().slice(0, 7);
        const monthLabel = pDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { month: monthKey, label: monthLabel, totalAmount: 0, count: 0 };
        }
        monthlyMap[monthKey].totalAmount += amount;
        monthlyMap[monthKey].count += 1;
      }

      // Warranty & return deadlines
      if (r.warrantyExpiresAt) {
        const wDate = new Date(r.warrantyExpiresAt);
        if (wDate >= now) {
          activeWarranties++;
          if (wDate <= in30Days) {
            warrantiesExpiringSoon++;
            upcomingExpirations.push({
              id: r.id,
              vendor: r.vendor,
              type: "WARRANTY",
              expiresAt: r.warrantyExpiresAt,
              daysLeft: Math.ceil((wDate - now) / (1000 * 60 * 60 * 24)),
            });
          }
        }
      }

      if (r.returnExpiresAt) {
        const retDate = new Date(r.returnExpiresAt);
        if (retDate >= now) {
          activeReturns++;
          if (retDate <= in7Days) {
            returnsExpiringSoon++;
            upcomingExpirations.push({
              id: r.id,
              vendor: r.vendor,
              type: "RETURN",
              expiresAt: r.returnExpiresAt,
              daysLeft: Math.ceil((retDate - now) / (1000 * 60 * 60 * 24)),
            });
          }
        }
      }
    });

    const categoryBreakdown = Object.values(categoryMap)
      .map((item) => ({
        ...item,
        totalAmount: Number(item.totalAmount.toFixed(2)),
        percentage: totalSpent > 0 ? Number(((item.totalAmount / totalSpent) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const monthlyTrends = Object.values(monthlyMap)
      .map((item) => ({
        ...item,
        totalAmount: Number(item.totalAmount.toFixed(2)),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    upcomingExpirations.sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));

    return res.json({
      summary: {
        totalReceipts: receipts.length,
        totalSpent: Number(totalSpent.toFixed(2)),
        averageTransaction: receipts.length > 0 ? Number((totalSpent / receipts.length).toFixed(2)) : 0,
      },
      categoryBreakdown,
      monthlyTrends,
      deadlines: {
        activeWarranties,
        warrantiesExpiringSoon,
        activeReturns,
        returnsExpiringSoon,
        upcomingExpirations: upcomingExpirations.slice(0, 5),
      },
    });
  } catch (err) {
    console.error("[GET /api/receipts/analytics] Error:", err);
    res.status(500).json({ error: "Failed to generate analytics", details: err.message });
  }
});

/**
 * GET /api/receipts
 * Fetch all receipts for the authenticated user
 */
router.get("/", async (req, res) => {
  const { category, search } = req.query;

  try {
    const receipts = await prisma.receipt.findMany({
      where: {
        userId: req.userId,
        ...(category && { category }),
        ...(search && {
          OR: [
            { vendor: { contains: search } },
            { itemDescription: { contains: search } },
          ],
        }),
      },
      orderBy: { purchaseDate: "desc" },
    });

    res.json(receipts);
  } catch (err) {
    console.error("[GET /api/receipts] Error:", err);
    res.status(500).json({ error: "Failed to fetch receipts", details: err.message });
  }
});

/**
 * POST /api/receipts/upload
 * Non-blocking upload: Enqueues OCR & Gemini AI task to BullMQ / Redis
 */
router.post("/upload", upload.single("receipt"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided." });
  }

  try {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized. Authentication token required." });
    }

    // Enqueue job to Redis
    const job = await receiptQueue.add("process-receipt", {
      userId,
      filePath: req.file.path,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });

    console.log(`🚀 [BullMQ] Job #${job.id} enqueued for User #${userId}`);

    // Return instant 202 Accepted response
    return res.status(202).json({
      message: "Receipt queued for background OCR processing",
      jobId: job.id,
      userId,
    });
  } catch (err) {
    console.error("[POST /api/receipts/upload] Error:", err);
    res.status(500).json({ error: "Failed to queue receipt image", details: err.message });
  }
});

/**
 * POST /api/receipts/from-text
 * Direct synchronous parsing for email/pasted text
 */
router.post("/from-text", async (req, res) => {
  const { text } = req.body || {};
  if (!text || text.trim().length < 5) {
    return res.status(400).json({ error: "Request body must include non-empty 'text'." });
  }

  try {
    const extracted = await extractReceiptData(text);

    const parsedDate = new Date(extracted.purchaseDate);
    const purchaseDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    const warrantyExpiresAt = extracted.warrantyMonths
      ? addMonths(purchaseDate, extracted.warrantyMonths)
      : null;
    const returnExpiresAt = extracted.returnWindowDays
      ? addDays(purchaseDate, extracted.returnWindowDays)
      : null;

    const receipt = await prisma.receipt.create({
      data: {
        userId: req.userId,
        vendor: extracted.vendor || "Unknown Vendor",
        purchaseDate,
        amount: Number(extracted.amount) || 0,
        currency: extracted.currency || "INR",
        category: extracted.category || "Other",
        itemDescription: extracted.itemDescription || null,
        warrantyExpiresAt,
        returnExpiresAt,
        source: "email",
        rawText: text,
      },
    });

    res.status(201).json(receipt);
  } catch (err) {
    console.error("[POST /api/receipts/from-text] Error:", err);
    res.status(500).json({ error: "Failed to process receipt text", details: err.message });
  }
});

/**
 * DELETE /api/receipts/:id
 * Delete receipt owned by the user
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const receipt = await prisma.receipt.findFirst({
      where: { id: Number(id) || id, userId: req.userId },
    });

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found or access denied." });
    }

    // Safely remove associated file from uploads directory if exists
    if (receipt.originalFileUrl) {
      try {
        const filename = path.basename(receipt.originalFileUrl);
        const filePath = path.join(__dirname, "../../uploads", filename);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          console.log(`🗑️ [Storage] Cleaned up orphaned file: ${filePath}`);
        }
      } catch (fileErr) {
        console.warn("⚠️ [Storage] Could not delete physical file:", fileErr.message);
      }
    }

    await prisma.receipt.delete({ where: { id: Number(id) || id } });
    res.json({ message: "Receipt deleted successfully" });
  } catch (err) {
    console.error("[DELETE /api/receipts/:id] Error:", err);
    res.status(500).json({ error: "Failed to delete receipt", details: err.message });
  }
});

/**
 * POST /api/receipts/test-email
 * Manual trigger to test expiry notifications
 */
router.post("/test-email", async (req, res) => {
  try {
    await sendExpiryAlerts();
    res.json({ message: "Expiry scan triggered successfully!" });
  } catch (err) {
    console.error("[POST /api/receipts/test-email] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;