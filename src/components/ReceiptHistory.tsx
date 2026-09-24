import React, { useState, useEffect } from "react";
import {
  Receipt,
  Search,
  ExternalLink,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  FileText,
  DollarSign,
  Package,
  Layers,
  CheckCircle,
  Cloud,
  X,
  Clock,
  Filter,
} from "lucide-react";
import { ReceiptRecord, ReceiptItemDetail } from "../types.ts";

interface ReceiptHistoryProps {
  onRefreshTrigger?: number;
}

export const ReceiptHistory: React.FC<ReceiptHistoryProps> = ({ onRefreshTrigger = 0 }) => {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [vendorSearch, setVendorSearch] = useState("");
  const [dateRangePreset, setDateRangePreset] = useState<"all" | "today" | "week" | "month">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Sort state
  const [sortBy, setSortBy] = useState<"date" | "total_amount" | "vendor_name" | "item_count">(
    "date"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Selected receipt for detailed modal view
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null);
  const [receiptDetails, setReceiptDetails] = useState<{
    receipt: any;
    items: ReceiptItemDetail[];
  } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const fetchReceipts = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (vendorSearch.trim()) params.append("vendor", vendorSearch.trim());

      // Date filtering logic
      let effectiveFrom = dateFrom;
      let effectiveTo = dateTo;
      const todayStr = new Date().toISOString().split("T")[0];

      if (dateRangePreset === "today") {
        effectiveFrom = todayStr;
        effectiveTo = todayStr;
      } else if (dateRangePreset === "week") {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
        effectiveFrom = weekAgo;
        effectiveTo = todayStr;
      } else if (dateRangePreset === "month") {
        const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
        effectiveFrom = monthAgo;
        effectiveTo = todayStr;
      }

      if (effectiveFrom) params.append("date_from", effectiveFrom);
      if (effectiveTo) params.append("date_to", effectiveTo);
      params.append("sort_by", sortBy);
      params.append("sort_dir", sortDir);

      const res = await fetch(`/api/receipts?${params.toString()}`);
      const json = await res.json();
      if (json.receipts) {
        setReceipts(json.receipts);
      }
    } catch (err) {
      console.error("Failed to fetch receipts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [vendorSearch, dateRangePreset, dateFrom, dateTo, sortBy, sortDir, onRefreshTrigger]);

  const toggleSort = (column: "date" | "total_amount" | "vendor_name" | "item_count") => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(column === "vendor_name" ? "asc" : "desc");
    }
  };

  const openReceiptModal = async (r: ReceiptRecord) => {
    setSelectedReceipt(r);
    setIsLoadingDetails(true);
    try {
      const res = await fetch(`/api/receipts/${r.id}`);
      const json = await res.json();
      setReceiptDetails(json);
    } catch (err) {
      console.error("Failed to load receipt details:", err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // KPIs
  const totalExpense = receipts.reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0);
  const totalItemsProcured = receipts.reduce((acc, r) => acc + (Number(r.item_count) || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Top Expense KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Total Expenses (Filtered)
            </p>
            <p className="text-xl font-black text-amber-400 font-mono">
              ${totalExpense.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Archived Receipts
            </p>
            <p className="text-xl font-black text-white font-mono">{receipts.length}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Parts Procured
            </p>
            <p className="text-xl font-black text-sky-400 font-mono">{totalItemsProcured}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Vendor Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              id="vendor-search-input"
              type="text"
              value={vendorSearch}
              onChange={(e) => setVendorSearch(e.target.value)}
              placeholder="Search by supplier or vendor name..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
            />
            {vendorSearch && (
              <button
                onClick={() => setVendorSearch("")}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Date Range Quick Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-slate-400 uppercase hidden sm:inline">
              Period:
            </span>
            <div className="inline-flex rounded-lg bg-slate-950 border border-slate-800 p-0.5">
              {(["all", "today", "week", "month"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setDateRangePreset(preset);
                    if (preset !== "all") {
                      setDateFrom("");
                      setDateTo("");
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase font-mono transition-colors ${
                    dateRangePreset === preset
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {preset === "all"
                    ? "All Time"
                    : preset === "today"
                    ? "Today"
                    : preset === "week"
                    ? "7 Days"
                    : "30 Days"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider text-[11px] border-b border-slate-800 select-none">
              <tr>
                {/* Date */}
                <th
                  onClick={() => toggleSort("date")}
                  className="py-3 px-4 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center space-x-1">
                    <span>Date</span>
                    {sortBy === "date" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-amber-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Vendor Name */}
                <th
                  onClick={() => toggleSort("vendor_name")}
                  className="py-3 px-4 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center space-x-1">
                    <span>Vendor / Supplier</span>
                    {sortBy === "vendor_name" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-amber-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Invoice # */}
                <th className="py-3 px-3 hidden sm:table-cell">Invoice #</th>

                {/* Number of Items */}
                <th
                  onClick={() => toggleSort("item_count")}
                  className="py-3 px-3 cursor-pointer hover:text-white text-center"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <span>Items</span>
                    {sortBy === "item_count" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-amber-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Total Amount */}
                <th
                  onClick={() => toggleSort("total_amount")}
                  className="py-3 px-4 cursor-pointer hover:text-white text-right"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Total Amount</span>
                    {sortBy === "total_amount" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-amber-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Google Drive Link */}
                <th className="py-3 px-4 text-center">Google Drive</th>

                {/* Actions */}
                <th className="py-3 px-4 text-right">View Details</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                    Loading expense ledger...
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No receipts found for the selected filter.
                  </td>
                </tr>
              ) : (
                receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/50 transition-colors">
                    {/* Date */}
                    <td className="py-3 px-4 font-mono font-medium text-white">
                      {r.transaction_date}
                    </td>

                    {/* Vendor Name */}
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      <div>{r.vendor_name}</div>
                      {r.notes && (
                        <span className="text-[11px] text-slate-500 block truncate max-w-xs">
                          {r.notes}
                        </span>
                      )}
                    </td>

                    {/* Invoice # */}
                    <td className="py-3 px-3 font-mono text-amber-400 hidden sm:table-cell">
                      {r.receipt_number || "—"}
                    </td>

                    {/* Item count */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-200">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {r.item_count}
                      </span>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3 px-4 text-right font-mono font-black text-sm text-emerald-400">
                      ${Number(r.total_amount).toFixed(2)}
                    </td>

                    {/* One-Click Google Drive Link */}
                    <td className="py-3 px-4 text-center">
                      {r.google_drive_web_link ? (
                        <a
                          id={`drive-link-${r.id}`}
                          href={r.google_drive_web_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-2.5 py-1 rounded bg-sky-950/70 hover:bg-sky-900 text-sky-300 border border-sky-800 text-[11px] font-mono font-semibold transition-colors"
                          title="Open archived receipt document in Google Drive"
                        >
                          <Cloud className="w-3 h-3 mr-1 text-sky-400" />
                          <span>Drive File</span>
                          <ExternalLink className="w-2.5 h-2.5 ml-1 text-sky-400" />
                        </a>
                      ) : (
                        <span className="text-slate-600 font-mono text-[10px]">Local only</span>
                      )}
                    </td>

                    {/* Detail Button */}
                    <td className="py-3 px-4 text-right">
                      <button
                        id={`view-receipt-btn-${r.id}`}
                        onClick={() => openReceiptModal(r)}
                        className="inline-flex items-center px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Receipt Modal with Raw Document and Line Items */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold text-white font-mono">
                    {selectedReceipt.vendor_name}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    Date: {selectedReceipt.transaction_date} • Invoice #:{" "}
                    {selectedReceipt.receipt_number || "N/A"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedReceipt(null);
                  setReceiptDetails(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingDetails ? (
              <div className="py-12 text-center text-slate-400 font-mono text-xs">
                Fetching receipt line items and stored image...
              </div>
            ) : receiptDetails ? (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Financial overview bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block">SUBTOTAL</span>
                    <span className="font-bold text-slate-200">
                      ${Number(receiptDetails.receipt.subtotal || 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">TAX</span>
                    <span className="font-bold text-slate-200">
                      ${Number(receiptDetails.receipt.tax || 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">TOTAL AMOUNT</span>
                    <span className="font-extrabold text-emerald-400 text-sm">
                      ${Number(receiptDetails.receipt.total_amount).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">GOOGLE DRIVE ID</span>
                    <span className="font-mono text-sky-400 truncate block text-[11px]">
                      {receiptDetails.receipt.google_drive_file_id || "None"}
                    </span>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                    Procured Parts &amp; Restocked Items ({receiptDetails.items.length})
                  </h4>
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Part Name</th>
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3">Category</th>
                          <th className="py-2 px-3 text-center">Qty</th>
                          <th className="py-2 px-3 text-right">Unit Price</th>
                          <th className="py-2 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                        {receiptDetails.items.map((it) => (
                          <tr key={it.id}>
                            <td className="py-2 px-3 font-semibold text-white">
                              {it.part_name}
                            </td>
                            <td className="py-2 px-3 font-mono text-amber-300 text-[11px]">
                              {it.sku || "—"}
                            </td>
                            <td className="py-2 px-3">{it.category}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold">
                              {it.quantity}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              ${Number(it.unit_price).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-white">
                              ${Number(it.total_price).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Raw Stored Image if available */}
                {receiptDetails.receipt.image_data && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                      Original Scanned Document
                    </h4>
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-center max-h-72 overflow-auto">
                      <img
                        src={receiptDetails.receipt.image_data}
                        alt="Scanned receipt document"
                        className="max-h-64 object-contain rounded"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              {selectedReceipt.google_drive_web_link ? (
                <a
                  href={selectedReceipt.google_drive_web_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow transition-colors"
                >
                  <Cloud className="w-4 h-4 mr-1.5" />
                  Open in Google Drive
                </a>
              ) : (
                <div></div>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedReceipt(null);
                  setReceiptDetails(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
