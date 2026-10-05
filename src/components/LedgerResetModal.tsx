import React, { useState, useEffect } from "react";
import {
  RotateCcw,
  AlertTriangle,
  Database,
  Receipt,
  ShoppingCart,
  Boxes,
  CheckCircle2,
  X,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { LedgerStats } from "../types.ts";
import { formatNpr } from "../utils/currency.ts";

interface LedgerResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetSuccess?: () => void;
}

export function LedgerResetModal({
  isOpen,
  onClose,
  onResetSuccess,
}: LedgerResetModalProps) {
  const [stats, setStats] = useState<LedgerStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset checkboxes
  const [resetSales, setResetSales] = useState(true);
  const [resetReceipts, setResetReceipts] = useState(true);
  const [resetStockMovements, setResetStockMovements] = useState(true);
  const [inventoryOption, setInventoryOption] = useState<"keep" | "reset_zero" | "reset_default">("keep");

  // Safety confirmation text
  const [confirmInput, setConfirmInput] = useState("");

  const fetchStats = async () => {
    setIsLoadingStats(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/ledger/stats");
      const json = await res.json();
      setStats(json);
    } catch (err: any) {
      console.error("Failed to fetch ledger stats:", err);
      setErrorMessage("Could not retrieve current ledger statistics.");
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setConfirmInput("");
      setResetSuccessMessage(null);
      setErrorMessage(null);
      fetchStats();
    }
  }, [isOpen]);

  const handleExecuteReset = async () => {
    if (confirmInput.trim().toUpperCase() !== "RESET") {
      setErrorMessage("Please type RESET exactly in the confirmation field.");
      return;
    }

    setIsResetting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/ledger/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resetSales,
          resetReceipts,
          resetStockMovements,
          inventoryOption,
          confirmText: confirmInput.trim().toUpperCase(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to reset recorded ledger.");
      }

      setResetSuccessMessage(
        json.message || "Recorded ledger has been reset successfully. Fresh deployment state active!"
      );
      setConfirmInput("");
      await fetchStats();

      if (onResetSuccess) {
        onResetSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to reset recorded ledger.");
    } finally {
      setIsResetting(false);
    }
  };

  if (!isOpen) return null;

  const isConfirmReady = confirmInput.trim().toUpperCase() === "RESET";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white font-mono">
                  Reset Recorded Ledger
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Deployment Prep
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Purge recorded ledger logs and start with a clean slate for production launch.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Success Banner */}
          {resetSuccessMessage && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start space-x-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-emerald-200">Reset Complete!</div>
                <div className="text-xs text-emerald-300/90 mt-0.5">{resetSuccessMessage}</div>
                <div className="text-[11px] text-emerald-400/80 mt-1 font-mono">
                  Next sequential invoice code will start at 001 for today.
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Deployment Explanation Notice */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center space-x-2 text-amber-400 font-bold font-mono text-xs uppercase">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>When Should You Reset the Ledger?</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Before deploying or handing over the app to your workshop staff, you can clear all
              pre-recorded test receipts, test sales, and stock movements. Your staff accounts and
              parts catalog will remain safe.
            </p>
          </div>

          {/* Current Ledger Record Summary */}
          <div>
            <h3 className="font-mono text-xs font-bold text-slate-400 uppercase mb-2.5 flex items-center justify-between">
              <span>Current Recorded Ledger Data</span>
              {isLoadingStats && <span className="text-amber-400 lowercase">fetching counts...</span>}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-[11px] font-mono text-slate-400 mb-1 flex items-center justify-center space-x-1">
                  <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sales Ledger</span>
                </div>
                <div className="text-base font-bold font-mono text-white">
                  {stats ? stats.sales.count : "—"}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {stats ? formatNpr(stats.sales.totalAmount) : "—"}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-[11px] font-mono text-slate-400 mb-1 flex items-center justify-center space-x-1">
                  <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Vendor Intake</span>
                </div>
                <div className="text-base font-bold font-mono text-white">
                  {stats ? stats.receipts.count : "—"}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {stats ? formatNpr(stats.receipts.totalAmount) : "—"}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-[11px] font-mono text-slate-400 mb-1 flex items-center justify-center space-x-1">
                  <Boxes className="w-3.5 h-3.5 text-sky-400" />
                  <span>Stock Logs</span>
                </div>
                <div className="text-base font-bold font-mono text-white">
                  {stats ? stats.stockMovements.count : "—"}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">movements</div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-[11px] font-mono text-slate-400 mb-1 flex items-center justify-center space-x-1">
                  <Database className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Inventory Catalog</span>
                </div>
                <div className="text-base font-bold font-mono text-white">
                  {stats ? stats.inventory.itemsCount : "—"}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {stats ? `${stats.inventory.totalUnits} units` : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Checkboxes */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="font-mono text-xs font-bold text-slate-300 uppercase">
              Select What To Reset:
            </h4>

            <label className="flex items-center space-x-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={resetSales}
                onChange={(e) => setResetSales(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-400"
              />
              <div>
                <span className="font-semibold text-slate-200">Customer Sales Ledger & Invoices</span>
                <p className="text-[11px] text-slate-400">
                  Deletes all recorded counter customer sales & items. Sequential invoice code resets to 001.
                </p>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={resetReceipts}
                onChange={(e) => setResetReceipts(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-400"
              />
              <div>
                <span className="font-semibold text-slate-200">Vendor Intake & Expense Receipts</span>
                <p className="text-[11px] text-slate-400">
                  Deletes recorded supplier receipts, invoices, and expense logs from the ledger.
                </p>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={resetStockMovements}
                onChange={(e) => setResetStockMovements(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-400"
              />
              <div>
                <span className="font-semibold text-slate-200">Stock Movements History</span>
                <p className="text-[11px] text-slate-400">
                  Clears past audit trail movements, leaving a clean deployment audit timestamp.
                </p>
              </div>
            </label>
          </div>

          {/* Inventory Stock Handling */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <h4 className="font-mono text-xs font-bold text-slate-300 uppercase">
              Inventory Physical Count Handling:
            </h4>

            <div className="space-y-2">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="inventoryOption"
                  value="keep"
                  checked={inventoryOption === "keep"}
                  onChange={() => setInventoryOption("keep")}
                  className="text-amber-500 focus:ring-amber-400"
                />
                <span className="text-slate-300">
                  Keep parts catalog and current in-stock quantities as-is
                </span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="inventoryOption"
                  value="reset_zero"
                  checked={inventoryOption === "reset_zero"}
                  onChange={() => setInventoryOption("reset_zero")}
                  className="text-amber-500 focus:ring-amber-400"
                />
                <span className="text-slate-300">
                  Keep parts catalog, but reset all stock quantities to <strong className="text-white">0</strong> (fresh physical stock count on deploy)
                </span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="radio"
                  name="inventoryOption"
                  value="reset_default"
                  checked={inventoryOption === "reset_default"}
                  onChange={() => setInventoryOption("reset_default")}
                  className="text-amber-500 focus:ring-amber-400"
                />
                <span className="text-slate-300">
                  Reset parts catalog to default starter stock
                </span>
              </label>
            </div>
          </div>

          {/* Safety Confirmation Input */}
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
            <label className="block text-xs font-mono font-bold text-rose-300">
              Type <span className="bg-rose-950 px-1.5 py-0.5 rounded text-rose-200 border border-rose-700">RESET</span> to confirm deployment ledger reset:
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Type RESET here"
              className="w-full bg-slate-950 border border-rose-600/50 rounded-lg px-3 py-2 text-white font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-rose-400"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!isConfirmReady || isResetting}
            onClick={handleExecuteReset}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all ${
              isConfirmReady && !isResetting
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30 cursor-pointer"
                : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
            }`}
          >
            {isResetting ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Resetting Ledger...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Confirm & Reset Recorded Ledger</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
