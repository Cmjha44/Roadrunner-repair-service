import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import {
  QrCode,
  Download,
  Copy,
  Check,
  Printer,
  Share2,
  X,
  ExternalLink,
  ShieldCheck,
  Calendar,
  User,
  Bike,
  CreditCard,
  Receipt,
  Sparkles,
  Phone,
  Clock,
  Package,
} from "lucide-react";
import { formatNpr } from "../utils/currency.ts";

export interface TransactionQrData {
  id: string;
  receipt_number: string;
  type: "sale" | "intake";
  title?: string;
  customer_name?: string;
  customer_phone?: string;
  motorcycle_model?: string;
  vendor_name?: string;
  subtotal?: number;
  tax?: number;
  total_amount: number;
  payment_method?: string;
  staff_name?: string;
  staff_username?: string;
  notes?: string;
  date: string;
  items?: Array<{
    part_name: string;
    sku?: string;
    quantity: number;
    unit_price?: number;
    total_price: number;
    category?: string;
  }>;
}

interface TransactionQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: TransactionQrData | null;
}

export const TransactionQrModal: React.FC<TransactionQrModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [items, setItems] = useState<any[]>(data?.items || []);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Generate public tracking URL
  const trackingCode = data?.receipt_number || data?.id || "";
  const trackingUrl = typeof window !== "undefined"
    ? `${window.location.origin}?track_receipt=${encodeURIComponent(trackingCode)}`
    : `https://roadrunner-motorepair.app?track_receipt=${encodeURIComponent(trackingCode)}`;

  useEffect(() => {
    if (!isOpen || !data) {
      setQrDataUrl("");
      return;
    }

    // Generate high resolution QR code data URL
    QRCode.toDataURL(trackingUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#090d16", // slate-950
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error("Failed to generate transaction QR code:", err);
      });

    // If items are not provided, fetch them from API
    if (!data.items || data.items.length === 0) {
      setIsLoadingItems(true);
      const endpoint = data.type === "sale" ? `/api/sales/${data.id}` : `/api/receipts/${data.id}`;
      fetch(endpoint)
        .then((res) => res.json())
        .then((json) => {
          if (json.items) {
            setItems(json.items);
          }
        })
        .catch((err) => console.error("Failed to load transaction items for QR modal:", err))
        .finally(() => setIsLoadingItems(false));
    } else {
      setItems(data.items);
    }
  }, [isOpen, data, trackingUrl]);

  if (!isOpen || !data) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(trackingUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `QR-${data.receipt_number || data.id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrintSlip = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const isCustomerSale = data.type === "sale";
    const text = isCustomerSale
      ? `*Road Runner Moto Repair Shop*\nOfficial Customer Checkout Receipt\nInvoice Code: *${data.receipt_number}*\nCustomer: ${data.customer_name || "Valued Client"}${data.motorcycle_model ? `\nBike: ${data.motorcycle_model}` : ""}\nTotal: ${formatNpr(data.total_amount)}\n\nTrack and verify your transaction here:\n${trackingUrl}`
      : `*Road Runner Moto Repair Shop*\nSupplier Intake Record\nReceipt Code: *${data.receipt_number || data.id}*\nVendor: ${data.vendor_name || "Supplier"}\nTotal: ${formatNpr(data.total_amount)}\n\nVerify record:\n${trackingUrl}`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  const isSale = data.type === "sale";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white font-mono">
                  Shareable Checkout QR Code
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    isSale
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                  }`}
                >
                  {isSale ? "Customer Sale" : "Supplier Intake"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Scan or share this code for instant customer checkout verification &amp; tracking.
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

        {/* Printable & Scannable Card */}
        <div
          ref={printRef}
          className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-inner space-y-4"
        >
          {/* Workshop Brand Header */}
          <div className="text-center pb-3 border-b border-slate-800/80">
            <div className="inline-flex items-center space-x-1.5 text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Road Runner Moto Repair Shop</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Verified Digital Checkout Slip &bull; Fast Tracking
            </p>
            <div className="mt-2 inline-flex items-center px-3 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-xs text-white">
              <span className="text-slate-400 mr-2">Code:</span>
              <span className="font-bold text-amber-300">{data.receipt_number || data.id}</span>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-md border-2 border-amber-400/40 max-w-xs mx-auto">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Transaction QR Code for ${data.receipt_number}`}
                className="w-52 h-52 object-contain"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center text-slate-400 text-xs font-mono">
                Generating scannable QR...
              </div>
            )}
            <p className="text-[10px] text-slate-700 font-mono font-medium text-center mt-1">
              Point phone camera to verify checkout
            </p>
          </div>

          {/* Transaction Metadata Breakdown */}
          <div className="bg-slate-900/90 rounded-lg p-3.5 border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
              <span className="text-slate-400 flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" />
                Date &amp; Time
              </span>
              <span className="text-slate-200 font-medium">{data.date}</span>
            </div>

            {isSale ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-slate-400 flex items-center">
                    <User className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    Customer Name
                  </span>
                  <span className="text-white font-bold">{data.customer_name || "Walk-in Customer"}</span>
                </div>
                {data.customer_phone && (
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400 flex items-center">
                      <Phone className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      Phone
                    </span>
                    <span className="text-slate-300">{data.customer_phone}</span>
                  </div>
                )}
                {data.motorcycle_model && (
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400 flex items-center">
                      <Bike className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      Motorcycle Model
                    </span>
                    <span className="text-amber-300 font-semibold">{data.motorcycle_model}</span>
                  </div>
                )}
                {data.staff_name && (
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="text-slate-400 flex items-center">
                      <Check className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      Cashier Staff
                    </span>
                    <span className="text-slate-300">{data.staff_name}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-400 flex items-center">
                  <Package className="w-3.5 h-3.5 mr-1 text-slate-500" />
                  Supplier / Vendor
                </span>
                <span className="text-white font-bold">{data.vendor_name || "Supplier"}</span>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
              <span className="text-slate-400 flex items-center">
                <CreditCard className="w-3.5 h-3.5 mr-1 text-slate-500" />
                Payment Method
              </span>
              <span className="text-slate-300 font-semibold uppercase">{data.payment_method || "CASH"}</span>
            </div>

            <div className="flex items-center justify-between pt-1 text-sm">
              <span className="text-slate-300 font-bold uppercase">Total Amount</span>
              <span className="text-emerald-400 font-black text-base">
                {formatNpr(data.total_amount)}
              </span>
            </div>
          </div>

          {/* Line Items Preview */}
          {items && items.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Items in Checkout ({items.length})</span>
                <span className="text-[10px] text-slate-500">Verified</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-800 rounded-lg p-2 bg-slate-900/60 divide-y divide-slate-800/40">
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs pt-1 first:pt-0">
                    <div className="truncate mr-2">
                      <span className="text-slate-200 font-medium">{it.part_name}</span>
                      {it.quantity > 1 && (
                        <span className="text-slate-400 text-[10px] ml-1.5 font-mono">
                          x{it.quantity}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-slate-300 shrink-0">
                      {formatNpr(it.total_price || (it.unit_price ? it.unit_price * it.quantity : 0))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shareable Link Input with Copy Button */}
          <div className="pt-2">
            <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
              Shareable Customer Tracking URL
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={trackingUrl}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono select-all focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-semibold flex items-center space-x-1 transition-colors shrink-0"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-semibold flex items-center justify-center space-x-1.5 transition-colors"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadQr}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-semibold flex items-center justify-center space-x-1.5 transition-colors"
            title="Download QR code image as PNG"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Download QR</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="p-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 text-xs font-mono font-semibold flex items-center justify-center space-x-1.5 transition-colors"
            title="Share checkout tracking via WhatsApp or SMS"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handlePrintSlip}
            className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono flex items-center justify-center space-x-1.5 shadow transition-colors"
            title="Print receipt slip with QR code"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Slip</span>
          </button>
        </div>
      </div>
    </div>
  );
};
