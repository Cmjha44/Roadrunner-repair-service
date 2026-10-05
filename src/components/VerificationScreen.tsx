import React, { useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  AlertTriangle,
  FileCheck,
  CloudUpload,
  ArrowLeft,
  Sparkles,
  Layers,
} from "lucide-react";
import {
  ParsedReceiptData,
  ParsedItemPayload,
  GARAGE_CATEGORIES,
  GarageCategory,
} from "../types.ts";
import { formatNpr } from "../utils/currency.ts";

interface VerificationScreenProps {
  initialData: ParsedReceiptData;
  rawImage: string;
  filename: string;
  mimeType: string;
  onCancel: () => void;
  onCommitSuccess: (receiptId: string, driveLink: string) => void;
}

export const VerificationScreen: React.FC<VerificationScreenProps> = ({
  initialData,
  rawImage,
  filename,
  mimeType,
  onCancel,
  onCommitSuccess,
}) => {
  // Invoice general fields
  const [vendorName, setVendorName] = useState(initialData.vendor_name || "");
  const [transactionDate, setTransactionDate] = useState(
    initialData.transaction_date || new Date().toISOString().split("T")[0]
  );
  const [receiptNumber, setReceiptNumber] = useState(initialData.receipt_number || "");
  const [tax, setTax] = useState<number>(initialData.tax || 0);
  const [totalAmount, setTotalAmount] = useState<number>(initialData.total_amount || 0);
  const [notes, setNotes] = useState(initialData.notes || "");

  // Line items
  const [items, setItems] = useState<ParsedItemPayload[]>(initialData.items || []);

  // Raw receipt viewer states
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Recalculate computed line items sum
  const itemsSubtotal = items.reduce(
    (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  );
  const calculatedGrandTotal = Number((itemsSubtotal + (Number(tax) || 0)).toFixed(2));
  const hasDiscrepancy = Math.abs(calculatedGrandTotal - (Number(totalAmount) || 0)) > 0.05;

  const handleItemChange = (
    index: number,
    field: keyof ParsedItemPayload,
    value: any
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // Auto update line total if quantity or unit price changed
      if (field === "quantity" || field === "unit_price") {
        const q = field === "quantity" ? Number(value) : Number(item.quantity);
        const p = field === "unit_price" ? Number(value) : Number(item.unit_price);
        item.total_price = Number((q * p).toFixed(2));
      }

      updated[index] = item;
      return updated;
    });
  };

  const addItem = () => {
    const newItem: ParsedItemPayload = {
      part_name: "New Motorcycle Part",
      sku: "",
      quantity: 1,
      unit_price: 10.0,
      total_price: 10.0,
      category: "Other",
      isNewItem: true,
    };
    setItems([...items, newItem]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleCommit = async () => {
    if (!vendorName.trim()) {
      setErrorMessage("Please provide a supplier / vendor name.");
      return;
    }
    if (items.length === 0) {
      setErrorMessage("Please ensure at least one line item is present.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        vendor_name: vendorName.trim(),
        transaction_date: transactionDate,
        receipt_number: receiptNumber.trim(),
        subtotal: itemsSubtotal,
        tax: Number(tax) || 0,
        total_amount: Number(totalAmount) || calculatedGrandTotal,
        notes: notes.trim(),
        items,
        original_filename: filename,
        mime_type: mimeType,
        raw_image_data: rawImage,
      };

      const res = await fetch("/api/receipts/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to commit receipt and sync inventory.");
      }

      onCommitSuccess(json.receiptId, json.driveWebLink);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || "Failed to finalize receipt.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Top Banner & Quick Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-slate-100">
        <div className="flex items-center space-x-3">
          <button
            onClick={onCancel}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Back to Capture"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base sm:text-lg text-white font-mono">
                Verification Screen
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Split-View Audit
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Verify extracted quantities and prices against the original receipt before updating
              inventory and archiving to Google Drive.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
          >
            Discard
          </button>

          <button
            id="commit-receipt-btn"
            type="button"
            disabled={isSubmitting}
            onClick={handleCommit}
            className="inline-flex items-center px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs tracking-wide shadow-md transition-all disabled:bg-slate-700"
          >
            {isSubmitting ? (
              <span>Syncing with SQLite &amp; Drive...</span>
            ) : (
              <>
                <CloudUpload className="w-4 h-4 mr-1.5" />
                <span>Commit to Database &amp; Archive</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-red-950/70 border border-red-800 text-red-200 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Split-View Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Raw Receipt Photo Viewer */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow flex flex-col h-[650px]">
          <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <span className="font-mono font-bold flex items-center text-slate-200">
              <FileCheck className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              Raw Receipt Document
            </span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1">{Math.round(zoomLevel * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
                title="Rotate 90deg"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoomLevel(1);
                  setRotation(0);
                }}
                className="p-1 hover:bg-slate-800 rounded text-slate-300"
                title="Reset View"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Visual Container with scroll & zoom */}
          <div className="flex-1 overflow-auto bg-slate-950 p-4 flex items-center justify-center relative">
            <div
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                transformOrigin: "center center",
                transition: "transform 0.15s ease-out",
              }}
              className="max-w-full"
            >
              {mimeType.includes("pdf") ? (
                <iframe
                  src={rawImage}
                  title="PDF Receipt"
                  className="w-[450px] h-[550px] border border-slate-700 rounded bg-white"
                />
              ) : (
                <img
                  src={rawImage}
                  alt="Raw Receipt Document"
                  className="max-w-full max-h-[580px] object-contain rounded shadow-2xl border border-slate-800"
                />
              )}
            </div>
          </div>
          <div className="bg-slate-950/80 px-3 py-1.5 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono text-center">
            {filename} • Scroll to inspect micro-text or serial codes
          </div>
        </div>

        {/* RIGHT COLUMN: Editable Form & Line Items Breakdown */}
        <div className="lg:col-span-7 space-y-4">
          {/* General Metadata Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Extracted Invoice Details
              </span>
              <span className="text-[11px] text-emerald-400 font-mono">Tesseract.js OCR • Click any field to edit</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase font-mono mb-1">
                  Vendor / Supplier
                </label>
                <input
                  id="vendor-name-input"
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-slate-100 text-xs font-medium focus:border-amber-400 focus:outline-none"
                  placeholder="Supplier Name"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase font-mono mb-1">
                  Transaction Date
                </label>
                <input
                  id="transaction-date-input"
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-slate-100 text-xs font-medium focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase font-mono">
                    Invoice / Receipt #
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/invoices/next-code?date=${transactionDate}`);
                        const json = await res.json();
                        if (json.nextCode) setReceiptNumber(json.nextCode);
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-mono underline"
                    title="Generate sequential invoice code depending on month, date and year"
                  >
                    Auto Sequential Code
                  </button>
                </div>
                <input
                  id="invoice-number-input"
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-slate-100 text-xs font-medium focus:border-amber-400 focus:outline-none font-mono"
                  placeholder="e.g. INV-20261005-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase font-mono mb-1">
                  Calculated Subtotal (NPR)
                </label>
                <div className="px-2.5 py-1.5 bg-slate-950/70 border border-slate-800 rounded-md text-slate-300 text-xs font-mono">
                  {formatNpr(itemsSubtotal)}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase font-mono mb-1">
                  Tax Amount (NPR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={tax}
                  onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-slate-100 text-xs font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase font-mono mb-1">
                  Grand Total (NPR)
                </label>
                <div className="flex items-center space-x-1.5">
                  <input
                    type="number"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                    className={`w-full px-2.5 py-1.5 bg-slate-950 border rounded-md text-xs font-mono font-bold focus:outline-none ${
                      hasDiscrepancy
                        ? "border-amber-500 text-amber-300"
                        : "border-slate-700 text-emerald-400"
                    }`}
                  />
                  {hasDiscrepancy && (
                    <button
                      type="button"
                      onClick={() => setTotalAmount(calculatedGrandTotal)}
                      title={`Sync to items sum (${formatNpr(calculatedGrandTotal)})`}
                      className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-mono whitespace-nowrap"
                    >
                      Sync
                    </button>
                  )}
                </div>
              </div>
            </div>

            {hasDiscrepancy && (
              <p className="text-[11px] text-amber-400/90 font-mono">
                Notice: Line items + tax ({formatNpr(calculatedGrandTotal)}) differs from receipt total (
                {formatNpr(totalAmount)}). You can click Sync or adjust line items.
              </p>
            )}
          </div>

          {/* Line Items Table & Matching Logic */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Line Items &amp; Inventory Matching ({items.length})
                </span>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-slate-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Part Line
              </button>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 relative group hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      {/* Part Name */}
                      <div className="sm:col-span-5">
                        <label className="text-[10px] text-slate-400 font-mono uppercase block">
                          Part Name
                        </label>
                        <input
                          type="text"
                          value={item.part_name}
                          onChange={(e) => handleItemChange(idx, "part_name", e.target.value)}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-white font-medium focus:border-amber-400 focus:outline-none"
                        />
                      </div>

                      {/* SKU / Code */}
                      <div className="sm:col-span-3">
                        <label className="text-[10px] text-slate-400 font-mono uppercase block">
                          SKU / Part #
                        </label>
                        <input
                          type="text"
                          value={item.sku}
                          onChange={(e) => handleItemChange(idx, "sku", e.target.value)}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-amber-300 focus:border-amber-400 focus:outline-none"
                          placeholder="Optional SKU"
                        />
                      </div>

                      {/* Category */}
                      <div className="sm:col-span-4">
                        <label className="text-[10px] text-slate-400 font-mono uppercase block">
                          Category
                        </label>
                        <select
                          value={item.category}
                          onChange={(e) =>
                            handleItemChange(idx, "category", e.target.value as GarageCategory)
                          }
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
                        >
                          {GARAGE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      title="Remove Item"
                      className="text-slate-500 hover:text-red-400 p-1 mt-3 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quantity, Unit Price, Total & Sync Match Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900 text-xs">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] text-slate-400 font-mono">QTY:</span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(idx, "quantity", parseInt(e.target.value) || 1)
                          }
                          className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-center text-white focus:border-amber-400 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] text-slate-400 font-mono">COST:</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) =>
                            handleItemChange(idx, "unit_price", parseFloat(e.target.value) || 0)
                          }
                          className="w-20 px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-center text-white focus:border-amber-400 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] text-slate-400 font-mono">TOTAL:</span>
                        <span className="font-mono font-bold text-slate-200">
                          {formatNpr(Number(item.quantity || 0) * Number(item.unit_price || 0))}
                        </span>
                      </div>
                    </div>

                    {/* Inventory Matching Outcome Indicator */}
                    <div>
                      {item.matchedInventoryId ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-800">
                          <CheckCircle className="w-3 h-3 mr-1 text-emerald-400" />
                          Matched Inventory • Current: {item.currentStock ?? 0} in stock (+
                          {item.quantity})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-sky-950/70 text-sky-300 border border-sky-800">
                          <Plus className="w-3 h-3 mr-1 text-sky-400" />
                          New Part • Will register (initial stock: {item.quantity}, threshold: 2)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Notes */}
            <div className="pt-2">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase font-mono mb-1">
                Receipt Notes / Mechanic Reference
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. For Yamaha R6 overhaul and general shelf restock"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-slate-200 text-xs focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
