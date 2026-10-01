import { createWorker } from "tesseract.js";

export interface ParsedReceiptItem {
  part_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category: string;
}

export interface ParsedReceiptResult {
  vendor_name: string;
  transaction_date: string;
  receipt_number: string;
  subtotal: number;
  tax: number;
  total_amount: number;
  notes?: string;
  items: ParsedReceiptItem[];
  ocr_engine?: string;
  raw_text?: string;
}

// Category keyword matching rule-set for motorcycle repair shops
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Electrical": [
    "spark plug", "spark", "plug", "battery", "yuasa", "ngk", "stator", "regulator", "rectifier", "fuse", "relay", "bulb", "led", "cr9e"
  ],
  "Braking": [
    "brake", "pad", "rotor", "disc", "caliper", "brembo", "ebc", "galfer", "master cylinder", "bleeder", "sintered"
  ],
  "Tires": [
    "tire", "tyre", "michelin", "pirelli", "bridgestone", "dunlop", "metzeler", "tube", "valve stem", "road 6", "diablo"
  ],
  "Oils & Fluids": [
    "oil", "fluid", "motul", "castrol", "liqui", "coolant", "lube", "lubricant",
    "brake fluid", "dot 4", "dot 5.1", "fork oil", "10w40", "10w50", "15w50", "20w50", "gear oil", "antifreeze"
  ],
  "Drivetrain": [
    "chain", "sprocket", "clutch", "d.i.d", "525vx", "520vx", "530vx", "drive belt", "countershaft", "sunstar"
  ],
  "Hardware": [
    "bolt", "screw", "nut", "washer", "gasket", "o-ring", "crush washer", "clamp", "fastener", "pin", "stud"
  ],
  "Suspension": [
    "fork seal", "dust seal", "shock", "spring", "bushing", "ohlins", "showa", "wp", "damper"
  ],
  "Exhaust": [
    "exhaust", "muffler", "silencer", "pipe", "baffle", "akrapovic", "yoshimura", "fmf", "header"
  ],
};

function categorizePart(text: string): string {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      // Check word boundary or direct inclusion
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(lower) || lower.includes(kw)) {
        return category;
      }
    }
  }
  return "Other";
}

/**
 * Extracts text from SVG representations if SVG data URI or string is supplied
 */
function extractTextFromSvg(svgString: string): string {
  const textMatches = svgString.match(/<text[^>]*>([\s\S]*?)<\/text>/gi);
  if (!textMatches || textMatches.length === 0) return "";
  return textMatches
    .map((t) => t.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Parses raw OCR text into structured motorcycle repair shop receipt metadata
 */
export function parseReceiptText(rawText: string): ParsedReceiptResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. VENDOR NAME DETECTION
  let vendor_name = "Motorcycle Parts Supplier";
  const ignoredVendorHeaders = [
    "receipt", "invoice", "tax invoice", "cash sale", "packing slip",
    "bill", "sales slip", "customer copy", "store copy", "tel:", "phone:",
    "date", "total", "subtotal", "qty", "item", "description"
  ];

  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    const isIgnored = ignoredVendorHeaders.some(
      (ig) =>
        lower === ig ||
        lower.startsWith(ig + " ") ||
        lower.startsWith("tel") ||
        lower.startsWith("phone") ||
        lower.startsWith("address")
    );
    if (
      !isIgnored &&
      line.length > 2 &&
      !/^\d+[\s\w]*$/.test(line) &&
      !line.includes("===") &&
      !line.includes("---")
    ) {
      vendor_name = line.replace(/[^\w\s&.-]/g, "").trim();
      break;
    }
  }

  // 2. TRANSACTION DATE DETECTION
  let transaction_date = new Date().toISOString().split("T")[0];
  const dateRegexes = [
    /(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/, // 2026-03-15 or 2026/03/15
    /(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/, // 03/15/2026 or 15-03-2026
    /([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/, // March 15, 2026
    /(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/, // 15 March 2026
  ];

  for (const line of lines) {
    let matched = false;
    for (const r of dateRegexes) {
      const match = line.match(r);
      if (match) {
        const parsedTimestamp = Date.parse(match[1]);
        if (!isNaN(parsedTimestamp)) {
          transaction_date = new Date(parsedTimestamp).toISOString().split("T")[0];
          matched = true;
          break;
        }
      }
    }
    if (matched) break;
  }

  // 3. INVOICE / RECEIPT NUMBER DETECTION
  let receipt_number = "";
  for (const line of lines) {
    // Put full words like INVOICE, RECEIPT before abbreviations like INV
    const invMatch = line.match(
      /\b(?:INVOICE|RECEIPT|ORDER|INV|REF|BILL)\b\s*(?:#|NO|NUM|NUMBER)?[:\s.-]*([A-Z0-9-_]+)/i
    );
    if (invMatch && invMatch[1] && invMatch[1].length >= 2) {
      receipt_number = invMatch[1].trim();
      break;
    }
  }
  if (!receipt_number) {
    const standaloneMatch = rawText.match(/\b(INV-[A-Z0-9]{3,10}|#[A-Z0-9]{3,10})\b/i);
    if (standaloneMatch) {
      receipt_number = standaloneMatch[1];
    }
  }

  // 4. FINANCIAL AMOUNTS (Subtotal, Tax, Total)
  let subtotal = 0;
  let tax = 0;
  let total_amount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    const nextLine = i + 1 < lines.length ? lines[i + 1] : "";

    // Total detection
    if (
      (lower.includes("total") || lower.includes("amount due") || lower.includes("balance due")) &&
      !lower.includes("subtotal") &&
      !lower.includes("sub-total") &&
      !lower.includes("tax")
    ) {
      let moneyMatch =
        line.match(/(?:total|due)[:\s]*(?:NPR|rs\.?|\$)?\s*([0-9,]+\.\d{2})/i) ||
        line.match(/(?:NPR|rs\.?|\$)?\s*([0-9,]+\.\d{2})/i);

      if (!moneyMatch && /^(?:NPR|rs\.?|\$)?\s*[0-9,]+\.\d{2}$/i.test(nextLine.trim())) {
        moneyMatch = nextLine.match(/(?:NPR|rs\.?|\$)?\s*([0-9,]+\.\d{2})/i);
      }

      if (moneyMatch) {
        const val = parseFloat(moneyMatch[1].replace(/,/g, ""));
        if (!isNaN(val) && val > total_amount) {
          total_amount = val;
        }
      }
    }

    // Subtotal detection
    if (lower.includes("subtotal") || lower.includes("sub-total") || lower.includes("net amount")) {
      let moneyMatch =
        line.match(/(?:subtotal|sub-total|net)[:\s]*(?:NPR|rs\.?|\$)?\s*([0-9,]+\.\d{2})/i) ||
        line.match(/(?:NPR|rs\.?|\$)?\s*([0-9,]+\.\d{2})/i);

      if (!moneyMatch && /^(?:NPR|rs\.?|\$)?\s*[0-9,]+\.\d{2}$/i.test(nextLine.trim())) {
        moneyMatch = nextLine.match(/(?:NPR|rs\.?|\$)?\s*([0-9,]+\.\d{2})/i);
      }

      if (moneyMatch) {
        const val = parseFloat(moneyMatch[1].replace(/,/g, ""));
        if (!isNaN(val)) {
          subtotal = val;
        }
      }
    }

    // Tax detection
    if (lower.includes("tax") || lower.includes("gst") || lower.includes("vat")) {
      let moneyMatch =
        line.match(/(?:tax|gst|vat)[^0-9]*(?:NPR|rs\.?|\$)?\s*([0-9,]+\.\d{2})/i) ||
        line.match(/(?:NPR|rs\.?|\$)?\s*([0-9,]+\.\d{2})/i);

      if (!moneyMatch && /^(?:NPR|rs\.?|\$)?\s*[0-9,]+\.\d{2}$/i.test(nextLine.trim())) {
        moneyMatch = nextLine.match(/(?:NPR|rs\.?|\$)?\s*([0-9,]+\.\d{2})/i);
      }

      if (moneyMatch) {
        const val = parseFloat(moneyMatch[1].replace(/,/g, ""));
        if (!isNaN(val)) {
          tax = val;
        }
      }
    }
  }

  // 5. LINE ITEMS EXTRACTION
  const items: ParsedReceiptItem[] = [];

  // Check for multi-line item layout (e.g. Item Name, then SKU line, then Qty, Unit, Total)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Check if line looks like an item name followed by SKU / QTY / Prices in next lines
    if (
      i + 4 < lines.length &&
      lines[i + 1].toLowerCase().includes("sku:") &&
      /^\d+$/.test(lines[i + 2].trim()) &&
      /^(?:NPR|rs\.?|\$)?\s*\d+\.\d{2}$/i.test(lines[i + 3].trim()) &&
      /^(?:NPR|rs\.?|\$)?\s*\d+\.\d{2}$/i.test(lines[i + 4].trim())
    ) {
      const partName = line;
      const skuLine = lines[i + 1];
      const skuMatch = skuLine.match(/sku:\s*([A-Z0-9-_/]+)/i);
      const sku = skuMatch ? skuMatch[1] : "";
      const qty = parseInt(lines[i + 2].trim(), 10) || 1;
      const unitPrice = parseFloat(lines[i + 3].replace(/(?:NPR|rs\.?|[$,\s])/gi, "")) || 0;
      const totalPrice = parseFloat(lines[i + 4].replace(/(?:NPR|rs\.?|[$,\s])/gi, "")) || unitPrice * qty;
      const category = categorizePart(partName + " " + skuLine);

      items.push({
        part_name: partName,
        sku,
        quantity: qty,
        unit_price: Number(unitPrice.toFixed(2)),
        total_price: Number(totalPrice.toFixed(2)),
        category,
      });

      i += 4; // Skip the consumed lines
      continue;
    }

    // Skip non-item lines
    if (
      lower.includes("subtotal") ||
      lower.includes("sub-total") ||
      (lower.includes("total") && !lower.includes("motul") && !lower.includes("chain")) ||
      lower.includes("sales tax") ||
      lower.includes("tax (") ||
      lower.includes("thank you") ||
      lower.includes("authorized") ||
      lower.includes("item description") ||
      lower.includes("qty price total") ||
      lower.startsWith("terms:") ||
      lower.startsWith("customer:") ||
      lower.startsWith("tel:")
    ) {
      continue;
    }

    // Single-line item pattern: e.g. "Brembo Sintered Brake Pads 07BB  1  $42.00  $42.00" or NPR 42.00
    const moneyMatches = [...line.matchAll(/(?:NPR|rs\.?|\$)?\s*([0-9,]+\.\d{2})\b/gi)];
    if (moneyMatches.length >= 1) {
      const prices = moneyMatches.map((m) => parseFloat(m[1].replace(/,/g, "")));
      const totalPrice = prices[prices.length - 1];
      const unitPrice = prices.length >= 2 ? prices[prices.length - 2] : totalPrice;

      // Text before the money values
      const textBeforePrices = line.slice(0, moneyMatches[0].index).trim();
      if (!textBeforePrices || textBeforePrices.length < 2) continue;

      let qty = 1;
      let partName = textBeforePrices;

      // Extract trailing quantity integer if present
      const qtyMatch = textBeforePrices.match(/(?:^|\s+)([1-9]\d?)\s*$/);
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1], 10);
        partName = textBeforePrices.slice(0, qtyMatch.index).trim();
      }

      // Check for SKU in line or next line
      let sku = "";
      const skuInLine = partName.match(/(?:SKU|PART|CODE|#)[:\s]*([A-Z0-9-_/]+)/i);
      if (skuInLine) {
        sku = skuInLine[1];
        partName = partName.replace(skuInLine[0], "").trim();
      } else if (
        i + 1 < lines.length &&
        (lines[i + 1].includes("SKU:") || lines[i + 1].includes("Part #:"))
      ) {
        const nextMatch = lines[i + 1].match(/(?:SKU|Part #)[:\s]*([A-Z0-9-_/]+)/i);
        if (nextMatch) {
          sku = nextMatch[1].trim();
        }
      }

      partName = partName
        .replace(/^[-*•\s]+/, "")
        .replace(/[-*•\s]+$/, "")
        .trim();

      if (partName.length >= 2 && !partName.toLowerCase().includes("total")) {
        const category = categorizePart(partName + " " + sku + " " + (lines[i + 1] || ""));
        items.push({
          part_name: partName,
          sku,
          quantity: qty > 0 ? qty : 1,
          unit_price: Number(unitPrice.toFixed(2)),
          total_price: Number(totalPrice.toFixed(2)),
          category,
        });
      }
    }
  }

  // Fallback if no items extracted with strict regex
  if (items.length === 0) {
    for (const line of lines) {
      if (line.includes(" - ") && /\d/.test(line)) {
        const parts = line.split(" - ");
        if (parts.length >= 2) {
          items.push({
            part_name: parts[0].trim(),
            sku: "",
            quantity: 1,
            unit_price: total_amount || 25.0,
            total_price: total_amount || 25.0,
            category: categorizePart(parts[0]),
          });
        }
      }
    }
  }

  // Final fallback to provide at least one editable item for the verification screen
  if (items.length === 0) {
    items.push({
      part_name: "Motorcycle Workshop Part",
      sku: "",
      quantity: 1,
      unit_price: total_amount > 0 ? total_amount : 25.0,
      total_price: total_amount > 0 ? total_amount : 25.0,
      category: "Other",
    });
  }

  // Recalculate totals sanity
  if (!total_amount || total_amount === 0) {
    const sum = items.reduce((acc, it) => acc + it.total_price, 0);
    total_amount = Number((sum + tax).toFixed(2));
  }
  if (!subtotal || subtotal === 0) {
    subtotal = Number(items.reduce((acc, it) => acc + it.total_price, 0).toFixed(2));
  }

  return {
    vendor_name: vendor_name || "Motorcycle Parts Supplier",
    transaction_date: transaction_date,
    receipt_number: receipt_number || `INV-${Date.now().toString().slice(-4)}`,
    subtotal: subtotal,
    tax: tax,
    total_amount: total_amount,
    notes: "Scanned locally via Open-Source Tesseract OCR Engine",
    items: items,
    ocr_engine: "Tesseract.js (Open Source)",
    raw_text: rawText.slice(0, 500),
  };
}

/**
 * Main Open Source OCR Runner using Tesseract.js
 */
export async function parseReceiptWithOpenSourceOcr(
  base64Data: string,
  mimeType: string
): Promise<ParsedReceiptResult> {
  console.log("Initiating open-source OCR engine (Tesseract.js)...");

  let rawText = "";

  // Check if input is an SVG document or SVG Data URI
  if (
    mimeType?.includes("svg") ||
    base64Data.startsWith("data:image/svg") ||
    base64Data.includes("<svg")
  ) {
    try {
      let svgContent = base64Data;
      if (base64Data.startsWith("data:image/svg+xml;utf8,")) {
        svgContent = decodeURIComponent(base64Data.replace("data:image/svg+xml;utf8,", ""));
      } else if (base64Data.startsWith("data:image/svg+xml;base64,")) {
        const base64Part = base64Data.replace("data:image/svg+xml;base64,", "");
        svgContent = Buffer.from(base64Part, "base64").toString("utf-8");
      }
      rawText = extractTextFromSvg(svgContent);
      console.log(`Extracted ${rawText.length} characters from SVG invoice.`);
    } catch (e) {
      console.warn("SVG text extraction fallback to standard parser:", e);
    }
  }

  // If not SVG or SVG text was empty, run Tesseract OCR
  if (!rawText || rawText.trim().length === 0) {
    let cleanBase64 = base64Data;
    if (base64Data.startsWith("data:")) {
      const commaIdx = base64Data.indexOf(",");
      if (commaIdx !== -1) {
        cleanBase64 = base64Data.slice(commaIdx + 1);
      }
    }

    const imageBuffer = Buffer.from(cleanBase64, "base64");
    console.log(`Running Tesseract worker on image buffer (${imageBuffer.length} bytes)...`);

    const worker = await createWorker("eng");
    try {
      const ret = await worker.recognize(imageBuffer);
      rawText = ret.data.text;
      console.log(`Tesseract OCR completed with confidence: ${ret.data.confidence}%`);
    } finally {
      await worker.terminate();
    }
  }

  return parseReceiptText(rawText);
}
