import React, { useState, useEffect } from "react";
import { StaffSession, SaleReceipt } from "../types.ts";
import { Receipt, Calendar, User, Bike, CreditCard, Search, RefreshCw, Printer, X } from "lucide-react";

interface StaffSalesHistoryProps {
  staffSession: StaffSession;
  refreshTrigger?: number;
}

export function StaffSalesHistory({ staffSession, refreshTrigger = 0 }: StaffSalesHistoryProps) {
  const [sales, setSales] = useState<SaleReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<SaleReceipt | null>(null);

  const fetchSales = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sales?staff_username=${staffSession.username}`);
      const json = await res.json();
      if (json.sales) {
        setSales(json.sales);
      }
    } catch (err) {
      console.error("Failed to load staff sales:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [staffSession.username, refreshTrigger]);

  const viewReceiptDetails = async (saleId: string) => {
    try {
      const res = await fetch(`/api/sales/${saleId}`);
      const json = await res.json();
      if (json.receipt) {
        setSelectedReceipt({
          ...json.receipt,
          items: json.items,
        });
      }
    } catch (err) {
      console.error("Failed to fetch receipt details:", err);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Staff Sales Log
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white font-mono mt-1">
              Logged Sell Receipts History
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Audit log of customer sales receipts issued by <strong className="text-slate-200">{staffSession.name}</strong>. Click any row to reprint or review customer details.
            </p>
          </div>

          <button
            onClick={fetchSales}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center space-x-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh History</span>
          </button>
        </div>
      </div>

      {/* Sales List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Date &amp; Time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Motorcycle / WO</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Receipt Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                    Loading sales records...
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                    No sales receipts logged by you yet.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      {sale.receipt_number}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {new Date(sale.created_at).toLocaleDateString()}{" "}
                      <span className="text-slate-600">
                        {new Date(sale.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      {sale.customer_name}
                      {sale.customer_phone && (
                        <div className="text-[11px] text-slate-500 font-mono">{sale.customer_phone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {sale.motorcycle_model || <span className="text-slate-600 font-mono">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-slate-950 text-slate-300 border border-slate-800 font-mono">
                        {sale.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                      ${Number(sale.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => viewReceiptDetails(sale.id)}
                        className="inline-flex items-center px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold"
                      >
                        <Receipt className="w-3.5 h-3.5 mr-1 text-amber-400" />
                        <span>View Slip</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slip Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white font-mono flex items-center">
                <Receipt className="w-4 h-4 mr-1.5 text-amber-400" />
                Receipt Slip #{selectedReceipt.receipt_number}
              </h3>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Preview */}
            <div className="bg-white text-slate-950 p-5 rounded-lg font-mono text-xs space-y-3">
              <div className="text-center border-b border-dashed border-slate-300 pb-2">
                <h4 className="font-black text-sm uppercase">MOTOFIX GARAGE</h4>
                <p className="text-[10px] text-slate-600">Official Parts &amp; Service Receipt</p>
                <div className="mt-1 font-bold">{selectedReceipt.receipt_number}</div>
                <div className="text-[10px] text-slate-500">
                  {new Date(selectedReceipt.created_at).toLocaleString()}
                </div>
              </div>

              <div className="text-[11px] space-y-0.5 border-b border-dashed border-slate-300 pb-2 text-slate-700">
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-semibold">{selectedReceipt.customer_name}</span>
                </div>
                {selectedReceipt.customer_phone && (
                  <div className="flex justify-between">
                    <span>Phone:</span>
                    <span>{selectedReceipt.customer_phone}</span>
                  </div>
                )}
                {selectedReceipt.motorcycle_model && (
                  <div className="flex justify-between">
                    <span>Motorcycle:</span>
                    <span>{selectedReceipt.motorcycle_model}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Seller:</span>
                  <span>{selectedReceipt.staff_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment:</span>
                  <span className="font-semibold">{selectedReceipt.payment_method}</span>
                </div>
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between font-bold text-[10px] uppercase text-slate-800">
                  <span>Part Description</span>
                  <span>Qty × Price = Total</span>
                </div>
                {selectedReceipt.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[200px]">{it.part_name}</span>
                    <span>
                      {it.quantity} × ${it.unit_price.toFixed(2)} = ${(it.quantity * it.unit_price).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 text-right text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>${selectedReceipt.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax (8%):</span>
                  <span>${selectedReceipt.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-slate-950 pt-1 border-t border-slate-300">
                  <span>TOTAL:</span>
                  <span>${selectedReceipt.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-mono"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
