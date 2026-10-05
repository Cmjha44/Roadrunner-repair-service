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
  Coins,
  Package,
  Layers,
  CheckCircle,
  Cloud,
  X,
  Clock,
  Filter,
  Trash2,
  RotateCcw,
  QrCode,
  ShoppingCart,
  User,
  Bike,
  CreditCard,
  Share2,
  Sparkles,
  Printer,
  Copy,
  Check,
} from "lucide-react";
import { ReceiptRecord, ReceiptItemDetail, SaleReceipt } from "../types.ts";
import { formatNpr } from "../utils/currency.ts";
import { TransactionQrModal, TransactionQrData } from "./TransactionQrModal.tsx";

interface ReceiptHistoryProps {
  onRefreshTrigger?: number;
  onOpenLedgerReset?: () => void;
}

export const ReceiptHistory: React.FC<ReceiptHistoryProps> = ({
  onRefreshTrigger = 0,
  onOpenLedgerReset,
}) => {
  // Active Ledger Tab: "sales" (Customer Checkout Sales) vs "intake" (Supplier Intake Invoices)
  const [activeSubTab, setActiveSubTab] = useState<"sales" | "intake">("sales");

  // Data states
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [sales, setSales] = useState<SaleReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRangePreset, setDateRangePreset] = useState<"all" | "today" | "week" | "month">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Sort state
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // QR Modal State
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrTransactionData, setQrTransactionData] = useState<TransactionQrData | null>(null);

  // Selected receipt for detailed modal view (Intake)
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null);
  const [receiptDetails, setReceiptDetails] = useState<{
    receipt: any;
    items: ReceiptItemDetail[];
  } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Selected sale receipt for detailed modal view (Sales)
  const [selectedSale, setSelectedSale] = useState<SaleReceipt | null>(null);
  const [saleDetails, setSaleDetails] = useState<{
    receipt: SaleReceipt;
    items: any[];
  } | null>(null);
  const [isLoadingSaleDetails, setIsLoadingSaleDetails] = useState(false);

  // Fetch Vendor Intake Receipts
  const fetchReceipts = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append("vendor", searchQuery.trim());

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
      params.append("sort_by", sortBy === "date" ? "date" : sortBy);
      params.append("sort_dir", sortDir);

      const res = await fetch(`/api/receipts?${params.toString()}`);
      const json = await res.json();
      if (json.receipts) {
        setReceipts(json.receipts);
      }
    } catch (err) {
      console.error("Failed to fetch intake receipts:", err);
    }
  };

  // Fetch Customer Checkout Sales Receipts
  const fetchSales = async () => {
    try {
      const res = await fetch("/api/sales?limit=100");
      const json = await res.json();
      if (json.sales) {
        setSales(json.sales);
      }
    } catch (err) {
      console.error("Failed to fetch customer sales:", err);
    }
  };

  // Unified reload
  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([fetchReceipts(), fetchSales()]);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [dateRangePreset, dateFrom, dateTo, sortBy, sortDir, onRefreshTrigger]);

  // Intake detail modal
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

  // Sale detail modal
  const openSaleModal = async (s: SaleReceipt) => {
    setSelectedSale(s);
    setIsLoadingSaleDetails(true);
    try {
      const res = await fetch(`/api/sales/${s.id}`);
      const json = await res.json();
      setSaleDetails(json);
    } catch (err) {
      console.error("Failed to load sale details:", err);
    } finally {
      setIsLoadingSaleDetails(false);
    }
  };

  // Delete handlers
  const handleDeleteReceipt = async (e: React.MouseEvent, id: string, vendor: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete receipt from "${vendor}"? This will remove it from the recorded ledger.`)) return;
    try {
      const res = await fetch(`/api/receipts/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedReceipt?.id === id) {
          setSelectedReceipt(null);
          setReceiptDetails(null);
        }
        fetchReceipts();
      }
    } catch (err) {
      console.error("Failed to delete receipt:", err);
    }
  };

  const handleDeleteSale = async (e: React.MouseEvent, id: string, receiptNum: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete customer sale #${receiptNum}? This will remove it from the recorded sales ledger.`)) return;
    try {
      const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedSale?.id === id) {
          setSelectedSale(null);
          setSaleDetails(null);
        }
        fetchSales();
      }
    } catch (err) {
      console.error("Failed to delete sale receipt:", err);
    }
  };

  // Trigger QR Code Modal for Sale
  const handleOpenSaleQr = (e: React.MouseEvent, sale: SaleReceipt) => {
    e.stopPropagation();
    setQrTransactionData({
      id: sale.id,
      receipt_number: sale.receipt_number,
      type: "sale",
      customer_name: sale.customer_name,
      customer_phone: sale.customer_phone,
      motorcycle_model: sale.motorcycle_model,
      subtotal: sale.subtotal,
      tax: sale.tax,
      total_amount: sale.total_amount,
      payment_method: sale.payment_method,
      staff_name: sale.staff_name,
      staff_username: sale.staff_username,
      notes: sale.notes,
      date: new Date(sale.created_at).toLocaleString(),
    });
    setQrModalOpen(true);
  };

  // Trigger QR Code Modal for Intake Receipt
  const handleOpenReceiptQr = (e: React.MouseEvent, receipt: ReceiptRecord) => {
    e.stopPropagation();
    setQrTransactionData({
      id: receipt.id,
      receipt_number: receipt.receipt_number || receipt.id,
      type: "intake",
      vendor_name: receipt.vendor_name,
      subtotal: receipt.subtotal,
      tax: receipt.tax,
      total_amount: receipt.total_amount,
      notes: receipt.notes,
      date: receipt.transaction_date,
    });
    setQrModalOpen(true);
  };

  // Filtered customer sales
  const filteredSales = sales.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      s.customer_name?.toLowerCase().includes(q) ||
      s.receipt_number?.toLowerCase().includes(q) ||
      s.motorcycle_model?.toLowerCase().includes(q) ||
      s.staff_name?.toLowerCase().includes(q) ||
      s.customer_phone?.toLowerCase().includes(q)
    );
  });

  // Filtered intake receipts
  const filteredReceipts = receipts.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      r.vendor_name?.toLowerCase().includes(q) ||
      r.receipt_number?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    );
  });

  // KPIs
  const totalSalesRevenue = sales.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0);
  const totalIntakeExpense = receipts.reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0);
  const totalPartsProcured = receipts.reduce((acc, r) => acc + (Number(r.item_count) || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Top Header & Sub-Tab Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                Workshop Transaction Ledgers
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                <QrCode className="w-3.5 h-3.5 mr-1" />
                Fast Checkout QR Tracking Enabled
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-mono mt-1">
              Receipt History &amp; Customer Checkout Tracking
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Inspect all recorded customer sell slips and vendor intake invoices. Generate a shareable QR code for any transaction to enable instantaneous customer mobile checkout verification.
            </p>
          </div>

          {/* Sub-tab Pills */}
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 self-start md:self-auto">
            <button
              id="tab-customer-sales"
              type="button"
              onClick={() => setActiveSubTab("sales")}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center space-x-2 ${
                activeSubTab === "sales"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Customer Sales ({sales.length})</span>
            </button>

            <button
              id="tab-vendor-receipts"
              type="button"
              onClick={() => setActiveSubTab("intake")}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center space-x-2 ${
                activeSubTab === "intake"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Supplier Expenses ({receipts.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {activeSubTab === "sales" ? (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Total Customer Sales Revenue
                </p>
                <p className="text-xl font-black text-emerald-400 font-mono">
                  {formatNpr(totalSalesRevenue)}
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Completed Customer Checkouts
                </p>
                <p className="text-xl font-black text-white font-mono">{sales.length}</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Shareable Checkout Tracking
                </p>
                <p className="text-xl font-black text-sky-400 font-mono">100% QR Ready</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Total Supplier Expenses
                </p>
                <p className="text-xl font-black text-amber-400 font-mono">
                  {formatNpr(totalIntakeExpense)}
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Archived Vendor Receipts
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
                  Parts Stock Procured
                </p>
                <p className="text-xl font-black text-sky-400 font-mono">{totalPartsProcured} units</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              id="ledger-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeSubTab === "sales"
                  ? "Search by customer name, phone, bike model, or invoice code (INV-...)..."
                  : "Search by vendor, supplier name, or invoice number..."
              }
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Date Presets */}
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

            {onOpenLedgerReset && (
              <button
                type="button"
                onClick={onOpenLedgerReset}
                title="Reset recorded ledger before deployment"
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-mono font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                <span>Reset Ledger (Deploy)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* VIEW 1: CUSTOMER SALES TRANSACTIONS (CHECKOUT TRACKING) */}
      {activeSubTab === "sales" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider text-[11px] border-b border-slate-800 select-none">
                <tr>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-3">Invoice / Slip Code</th>
                  <th className="py-3 px-4">Customer &amp; Vehicle</th>
                  <th className="py-3 px-3">Cashier Staff</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-right">Checkout Tracking &amp; Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                      Loading customer checkout transactions...
                    </td>
                  </tr>
                ) : filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                      No customer sales transactions found matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr
                      key={sale.id}
                      onClick={() => openSaleModal(sale)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                        <div className="font-medium text-white">
                          {new Date(sale.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(sale.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>

                      {/* Invoice Code */}
                      <td className="py-3 px-3 font-mono">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {sale.receipt_number}
                        </span>
                      </td>

                      {/* Customer & Vehicle */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">
                          {sale.customer_name || "Walk-in Customer"}
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400 mt-0.5">
                          {sale.motorcycle_model && (
                            <span className="flex items-center text-amber-300">
                              <Bike className="w-3 h-3 mr-1 text-slate-500" />
                              {sale.motorcycle_model}
                            </span>
                          )}
                          {sale.customer_phone && (
                            <span className="text-slate-500">• {sale.customer_phone}</span>
                          )}
                        </div>
                      </td>

                      {/* Staff */}
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {sale.staff_name || sale.staff_username || "Staff"}
                      </td>

                      {/* Payment */}
                      <td className="py-3 px-3 font-mono uppercase text-slate-400 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                          {sale.payment_method || "CASH"}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-4 text-right font-mono font-black text-sm text-emerald-400">
                        {formatNpr(sale.total_amount)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Shareable QR Code Button */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenSaleQr(e, sale)}
                            className="inline-flex items-center px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono shadow-xs transition-colors"
                            title="Generate Shareable QR Code for Fast Customer Checkout Tracking"
                          >
                            <QrCode className="w-3.5 h-3.5 mr-1 text-slate-950" />
                            <span>Share QR</span>
                          </button>

                          {/* Inspect Slip */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSaleModal(sale);
                            }}
                            className="inline-flex items-center px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-colors"
                            title="Inspect checkout breakdown"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1 text-slate-400" />
                            <span>Inspect</span>
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSale(e, sale.id, sale.receipt_number)}
                            className="p-1 rounded bg-slate-800 hover:bg-rose-900/50 text-slate-500 hover:text-rose-400 border border-slate-700 transition-colors"
                            title="Delete sale receipt"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: SUPPLIER INTAKE RECEIPTS */}
      {activeSubTab === "intake" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider text-[11px] border-b border-slate-800 select-none">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Vendor / Supplier</th>
                  <th className="py-3 px-3 hidden sm:table-cell">Invoice #</th>
                  <th className="py-3 px-3 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Google Drive</th>
                  <th className="py-3 px-4 text-right">Tracking &amp; Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                      Loading supplier expense ledger...
                    </td>
                  </tr>
                ) : filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                      No supplier receipts found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => openReceiptModal(r)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      {/* Date */}
                      <td className="py-3 px-4 font-mono font-medium text-white whitespace-nowrap">
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
                        {formatNpr(r.total_amount)}
                      </td>

                      {/* Google Drive Link */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
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

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Shareable QR Code Button */}
                          <button
                            type="button"
                            onClick={(e) => handleOpenReceiptQr(e, r)}
                            className="inline-flex items-center px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono shadow-xs transition-colors"
                            title="Generate Shareable QR Code for Fast Tracking"
                          >
                            <QrCode className="w-3.5 h-3.5 mr-1 text-slate-950" />
                            <span>Share QR</span>
                          </button>

                          {/* Inspect */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openReceiptModal(r);
                            }}
                            className="inline-flex items-center px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1 text-slate-400" />
                            <span>Inspect</span>
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteReceipt(e, r.id, r.vendor_name)}
                            title={`Delete receipt from ${r.vendor_name}`}
                            className="p-1 rounded bg-slate-800 hover:bg-rose-900/40 text-slate-500 hover:text-rose-400 border border-slate-700 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Customer Sale Inspection Drawer/Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono flex items-center space-x-2">
                    <span>Customer Sale #{selectedSale.receipt_number}</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(selectedSale.created_at).toLocaleString()} • Cashier: {selectedSale.staff_name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedSale(null);
                  setSaleDetails(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingSaleDetails ? (
              <div className="py-12 text-center text-slate-400 font-mono text-xs">
                Fetching sale checkout breakdown...
              </div>
            ) : saleDetails ? (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Customer Info Card */}
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block">CUSTOMER</span>
                    <span className="font-bold text-white text-sm">
                      {saleDetails.receipt.customer_name || "Walk-in"}
                    </span>
                    {saleDetails.receipt.customer_phone && (
                      <span className="text-slate-400 block text-[11px]">
                        {saleDetails.receipt.customer_phone}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 block">MOTORCYCLE</span>
                    <span className="font-bold text-amber-300 text-sm">
                      {saleDetails.receipt.motorcycle_model || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">PAYMENT</span>
                    <span className="font-bold text-slate-200 uppercase">
                      {saleDetails.receipt.payment_method || "CASH"}
                    </span>
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                    Purchased Parts &amp; Services ({saleDetails.items.length})
                  </h4>
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Part Name</th>
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3 text-center">Qty</th>
                          <th className="py-2 px-3 text-right">Unit Price</th>
                          <th className="py-2 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-mono">
                        {saleDetails.items.map((it: any) => (
                          <tr key={it.id}>
                            <td className="py-2 px-3 font-semibold text-white">
                              {it.part_name}
                            </td>
                            <td className="py-2 px-3 text-amber-400 text-[11px]">
                              {it.sku || "—"}
                            </td>
                            <td className="py-2 px-3 text-center font-bold">{it.quantity}</td>
                            <td className="py-2 px-3 text-right">{formatNpr(it.unit_price)}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-400">
                              {formatNpr(it.total_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal:</span>
                    <span>{formatNpr(saleDetails.receipt.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Tax:</span>
                    <span>{formatNpr(saleDetails.receipt.tax)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-slate-800">
                    <span>Total Amount:</span>
                    <span className="text-emerald-400">{formatNpr(saleDetails.receipt.total_amount)}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Modal Footer Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={(e) => {
                  if (selectedSale) handleOpenSaleQr(e, selectedSale);
                }}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono shadow-md transition-colors"
              >
                <QrCode className="w-4 h-4 mr-1.5" />
                <span>Shareable QR Code Slip</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={(e) => {
                    if (selectedSale) handleDeleteSale(e, selectedSale.id, selectedSale.receipt_number);
                  }}
                  className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-md font-semibold text-xs flex items-center space-x-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSale(null);
                    setSaleDetails(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Vendor Intake Receipt Inspection Drawer/Modal */}
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
                      {formatNpr(receiptDetails.receipt.subtotal || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">TAX</span>
                    <span className="font-bold text-slate-200">
                      {formatNpr(receiptDetails.receipt.tax || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">TOTAL AMOUNT</span>
                    <span className="font-extrabold text-emerald-400 text-sm">
                      {formatNpr(receiptDetails.receipt.total_amount)}
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
                              {formatNpr(it.unit_price)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-white">
                              {formatNpr(it.total_price)}
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
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={(e) => {
                    if (selectedReceipt) handleOpenReceiptQr(e, selectedReceipt);
                  }}
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono shadow transition-colors"
                >
                  <QrCode className="w-4 h-4 mr-1.5" />
                  <span>Shareable QR Code</span>
                </button>

                {selectedReceipt.google_drive_web_link && (
                  <a
                    href={selectedReceipt.google_drive_web_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow transition-colors"
                  >
                    <Cloud className="w-4 h-4 mr-1.5" />
                    <span>Open in Drive</span>
                  </a>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={(e) => handleDeleteReceipt(e, selectedReceipt.id, selectedReceipt.vendor_name)}
                  className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-md font-semibold text-xs flex items-center space-x-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReceipt(null);
                    setReceiptDetails(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction QR Code Modal */}
      <TransactionQrModal
        isOpen={qrModalOpen}
        onClose={() => {
          setQrModalOpen(false);
          setQrTransactionData(null);
        }}
        data={qrTransactionData}
      />
    </div>
  );
};
