import { GoogleGenAI, Type } from "@google/genai";

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
}

export async function parseReceiptWithGemini(
  base64Data: string,
  mimeType: string
): Promise<ParsedReceiptResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is missing. Please configure it in Settings > Secrets."
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // Clean base64 prefix if present (e.g. data:image/jpeg;base64,...)
  let cleanBase64 = base64Data;
  let effectiveMime = mimeType || "image/jpeg";

  if (base64Data.startsWith("data:")) {
    const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      effectiveMime = matches[1];
      cleanBase64 = matches[2];
    } else {
      const commaIdx = base64Data.indexOf(",");
      if (commaIdx !== -1) {
        cleanBase64 = base64Data.slice(commaIdx + 1);
      }
    }
  }

  const prompt = `You are an expert motorbike garage parts specialist and accounting OCR analyst.
Carefully examine this receipt / purchase invoice from a motorcycle parts supplier, dealer, or hardware vendor.

Extract:
1. Vendor Name (e.g. Parts Unlimited, Motul, Brembo, Rocky Mountain ATV/MC, Dennis Kirk, Local Moto Supply).
2. Transaction Date (Format: YYYY-MM-DD. If year is missing or ambiguous, assume the current or recent year).
3. Receipt / Invoice Number (if visible, e.g. INV-2024-8192 or receipt #).
4. Financial breakdown: Subtotal, Tax amount, and Grand Total amount.
5. Line items:
   - part_name: Clean, descriptive motorcycle part or fluid name.
   - sku: Part number, OEM code, manufacturer SKU, or barcode if shown (e.g. KN-204, DID-525VX3, 10W40-4T). If absent, use an empty string.
   - quantity: Numeric quantity purchased (must be >= 1 integer or decimal).
   - unit_price: Price per single unit.
   - total_price: Line item total (quantity * unit_price).
   - category: Categorize strictly into one of:
     - "Tires" (tires, inner tubes, rim tape, valve stems)
     - "Oils & Fluids" (engine oil, gear oil, brake fluid, coolant, fork oil, chain lube)
     - "Braking" (brake pads, rotors, calipers, lines, master cylinders)
     - "Drivetrain" (chains, sprockets, clutches, belts)
     - "Electrical" (spark plugs, batteries, stators, relays, bulbs, fuses)
     - "Hardware" (bolts, washers, nuts, fasteners, brackets, gaskets, O-rings)
     - "Suspension" (fork seals, shock absorbers, bushings, bearings)
     - "Exhaust" (exhaust pipes, mufflers, silencer packing, clamps)
     - "Other" (filters, accessories, generic tools)

Be extremely accurate with quantities, unit costs, and decimal numbers. If anything is blurry, infer the most logical part name from the automotive context.`;

  const imagePart = {
    inlineData: {
      mimeType: effectiveMime,
      data: cleanBase64,
    },
  };

  const response = await ai.models.generateContent({
    model: "gemini-3.8-flash",
    contents: {
      parts: [imagePart, { text: prompt }],
    },
    config: {
      systemInstruction:
        "You are a specialized OCR parser for motorcycle repair shop invoices. Always return valid JSON matching the exact schema.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vendor_name: { type: Type.STRING, description: "Vendor or supplier business name" },
          transaction_date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
          receipt_number: { type: Type.STRING, description: "Invoice or receipt number" },
          subtotal: { type: Type.NUMBER, description: "Subtotal before taxes" },
          tax: { type: Type.NUMBER, description: "Tax charged on the purchase" },
          total_amount: { type: Type.NUMBER, description: "Final grand total amount" },
          notes: { type: Type.STRING, description: "Brief notes on supplier or payment terms" },
          items: {
            type: Type.ARRAY,
            description: "List of purchased parts or items",
            items: {
              type: Type.OBJECT,
              properties: {
                part_name: { type: Type.STRING, description: "Descriptive name of the motorcycle part" },
                sku: { type: Type.STRING, description: "Part number or SKU code if present" },
                quantity: { type: Type.NUMBER, description: "Quantity purchased" },
                unit_price: { type: Type.NUMBER, description: "Cost per single unit" },
                total_price: { type: Type.NUMBER, description: "Total cost for this item line" },
                category: {
                  type: Type.STRING,
                  description:
                    "Category: Tires, Oils & Fluids, Braking, Drivetrain, Electrical, Hardware, Suspension, Exhaust, or Other",
                },
              },
              required: ["part_name", "quantity", "unit_price", "total_price", "category"],
            },
          },
        },
        required: ["vendor_name", "transaction_date", "total_amount", "items"],
      },
    },
  });

  const rawText = response.text;
  if (!rawText) {
    throw new Error("No text response received from Gemini OCR model.");
  }

  const parsed = JSON.parse(rawText) as ParsedReceiptResult;

  // Fallback sanity checks and defaults
  if (!parsed.vendor_name) parsed.vendor_name = "Motorcycle Parts Supplier";
  if (!parsed.transaction_date) parsed.transaction_date = new Date().toISOString().split("T")[0];
  if (!parsed.total_amount && parsed.total_amount !== 0) {
    const itemsSum = (parsed.items || []).reduce((acc, i) => acc + (i.total_price || 0), 0);
    parsed.total_amount = Number((itemsSum + (parsed.tax || 0)).toFixed(2));
  }
  if (!parsed.items) parsed.items = [];

  // Normalize items
  parsed.items = parsed.items.map((item) => ({
    part_name: (item.part_name || "Uncategorized Part").trim(),
    sku: (item.sku || "").trim(),
    quantity: Math.max(1, Number(item.quantity) || 1),
    unit_price: Number((item.unit_price || 0).toFixed(2)),
    total_price: Number((item.total_price || (item.quantity * item.unit_price) || 0).toFixed(2)),
    category: item.category || "Other",
  }));

  return parsed;
}
