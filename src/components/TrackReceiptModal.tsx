import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  ShieldCheck,
  CheckCircle2,
  X,
  Printer,
  Calendar,
  User,
  Bike,
  CreditCard,
  Package,
  Share2,
  Download,
  AlertTriangle,
  Receipt,
  FileCheck2,
} from "lucide-react";
import { formatNpr } from "../utils/currency.ts";

interface TrackReceiptModalProps {
  receiptCode: string | null;
  onClose: () => void;
}

export const TrackReceiptModal: React.FC<TrackReceiptModalProps> = ({
  receiptCode,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    if (!receiptCode) return;
    setIsLoading(true);
    setError(null);

    fetch(`/api/transactions/track/${encodeURIComponent(receiptCode)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Transaction record not found.");
        return res.json();
      })
      .then((json) => {
        if (json.receipt) {
          setData(json);

          // Generate QR code
          const currentUrl = window.location.href;
          QRCode.toDataURL(currentUrl, {
            width: 250,
            margin: 2,
            color: { dark: "#090d16", light: "#ffffff" },
          }).then(setQrDataUrl);
        } else {
          setError("Invalid receipt format.");
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load transaction details.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [receiptCode]);

  if (!receiptCode) return null;

  const handlePrint = () => {
    window.print();
  };

  const receipt = data?.receipt;
  const items = data?.items || [];
  const isSale = data?.type === "sale";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono flex items-center">
                <span>Verified Checkout Tracking</span>
                <CheckCircle2 className="w-4 h-4 ml-1.5 text-emerald-400" />
              </h3>
              <p className="text-xs text-slate-400">
                Official Road Runner Moto Repair Shop Record
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 font-mono text-xs space-y-2">
            <div className="inline-block w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            <p>Verifying transaction #{receiptCode}...</p>
          </div>
        ) : error ? (
          <div className="p-5 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white font-mono">Record Not Found</h4>
            <p className="text-xs text-slate-400">
              Could not find verified transaction record for code: <strong className="text-rose-300 font-mono">{receiptCode}</strong>
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-mono"
            >
              Close
            </button>
          </div>
        ) : receipt ? (
          <div className="space-y-4">
            {/* Status Banner */}
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-emerald-300 font-mono block">
                    Authentic Verified Slip
                  </span>
                  <span className="text-[11px] text-emerald-400/80">
                    Recorded in workshop ledger
                  </span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {receipt.receipt_number || receipt.id}
              </span>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
              <div className="text-center pb-2 border-b border-slate-800/80">
                <span className="font-extrabold text-white text-sm uppercase">
                  ROAD RUNNER MOTO REPAIR SHOP
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Kathmandu Workshop &bull; Customer Billing &amp; Parts Intake
                </p>
              </div>

              <div className="space-y-1.5 pt-1 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span>{receipt.created_at ? new Date(receipt.created_at).toLocaleString() : receipt.transaction_date}</span>
                </div>
                {isSale && receipt.customer_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer:</span>
                    <span className="text-white font-bold">{receipt.customer_name}</span>
                  </div>
                )}
                {isSale && receipt.motorcycle_model && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Bike Model:</span>
                    <span className="text-amber-300 font-semibold">{receipt.motorcycle_model}</span>
                  </div>
                )}
                {!isSale && receipt.vendor_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Supplier:</span>
                    <span className="text-white font-bold">{receipt.vendor_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment:</span>
                  <span className="uppercase font-semibold">{receipt.payment_method || "CASH"}</span>
                </div>
                {receipt.staff_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Staff Cashier:</span>
                    <span>{receipt.staff_name}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              {items && items.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Checkout Line Items:
                  </div>
                  <div className="divide-y divide-slate-800/60 max-h-40 overflow-y-auto">
                    {items.map((it: any, idx: number) => (
                      <div key={idx} className="flex justify-between py-1 text-xs">
                        <div className="truncate mr-2">
                          <span className="text-slate-200">{it.part_name}</span>
                          {it.quantity > 1 && (
                            <span className="text-slate-500 text-[10px] ml-1">x{it.quantity}</span>
                          )}
                        </div>
                        <span className="text-white font-medium shrink-0">
                          {formatNpr(it.total_price || (it.unit_price ? it.unit_price * it.quantity : 0))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm">
                <span className="font-bold text-white uppercase">TOTAL AMOUNT</span>
                <span className="font-black text-emerald-400 text-base">
                  {formatNpr(receipt.total_amount)}
                </span>
              </div>
            </div>

            {/* QR Code and Actions */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-2">
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="Tracking QR"
                    className="w-16 h-16 rounded bg-white p-1 border border-slate-700"
                  />
                )}
                <div className="text-[11px] font-mono text-slate-400">
                  <span>Fast Tracking QR</span>
                  <p className="text-[10px] text-slate-500">Scan to re-verify anytime</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs flex items-center space-x-1.5 shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Slip</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
