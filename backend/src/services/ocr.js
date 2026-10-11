const { createWorker } = require("tesseract.js");

async function performOCR(imagePath) {
  let worker;
  try {
    worker = await createWorker("eng");
    const { data } = await worker.recognize(imagePath);
    await worker.terminate();
    return data.text || "";
  } catch (err) {
    if (worker) {
      await worker.terminate();
    }
    console.error("[OCR] Failed to extract text:", err);
    throw new Error("OCR text extraction failed: " + err.message);
  }
}

module.exports = { performOCR };