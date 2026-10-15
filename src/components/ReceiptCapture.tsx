import React, { useState, useRef } from "react";
import {
  UploadCloud,
  Camera,
  FileText,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Zap,
  QrCode,
  ScanBarcode,
  ExternalLink,
} from "lucide-react";
import { SAMPLE_RECEIPTS, SampleReceipt } from "../data/sampleReceipts.ts";
import { ParsedReceiptData } from "../types.ts";
import { BoxQrScanner } from "./BoxQrScanner.tsx";

interface ReceiptCaptureProps {
  onParsedSuccess: (
    parsed: ParsedReceiptData,
    rawImage: string,
    filename: string,
    mimeType: string
  ) => void;
  onOpenAiStudioModal?: () => void;
}

export const ReceiptCapture: React.FC<ReceiptCaptureProps> = ({
  onParsedSuccess,
  onOpenAiStudioModal,
}) => {
  const [captureMode, setCaptureMode] = useState<"ocr" | "qr">("ocr");
  const [selectedFile, setSelectedFile] = useState<{
    dataUrl: string;
    name: string;
    mime: string;
  } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setErrorMessage(null);
    if (!file) return;

    const mime = file.type || "image/jpeg";
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSelectedFile({
        dataUrl,
        name: file.name,
        mime,
      });
    };

    reader.onerror = () => {
      setErrorMessage("Failed to read the selected file. Please try again.");
    };

    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSelectSample = (sample: SampleReceipt) => {
    setErrorMessage(null);
    setSelectedFile({
      dataUrl: sample.svgDataUri,
      name: sample.filename,
      mime: "image/svg+xml",
    });
  };

  const startAiParsing = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStep("Running Open-Source Tesseract OCR Engine locally...");

    try {
      setTimeout(() => {
        setProcessingStep("Extracting text, vendor, line items, quantities, and prices...");
      }, 900);

      setTimeout(() => {
        setProcessingStep("Cross-referencing extracted parts against local SQLite inventory...");
      }, 1800);

      const res = await fetch("/api/receipts/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: selectedFile.dataUrl,
          mimeType: selectedFile.mime,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to process receipt with Open-Source OCR.");
      }

      onParsedSuccess(
        json.data,
        selectedFile.dataUrl,
        selectedFile.name,
        selectedFile.mime
      );
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err?.message || "An unexpected error occurred while parsing the receipt."
      );
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Intake Method Mode Switcher (Receipt OCR vs Box QR Scanner) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setCaptureMode("ocr")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all ${
              captureMode === "ocr"
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Supplier Receipt OCR</span>
          </button>

          <button
            type="button"
            id="tab-qr-box-scanner"
            onClick={() => setCaptureMode("qr")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all ${
              captureMode === "qr"
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <ScanBarcode className="w-4 h-4" />
            <span>Scan QR / Barcode</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 font-normal">
              Camera
            </span>
          </button>
        </div>

        {onOpenAiStudioModal && (
          <button
            type="button"
            onClick={onOpenAiStudioModal}
            className="text-[11px] font-mono text-sky-300 hover:text-white flex items-center justify-center sm:justify-end space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-950/70 border border-sky-700/60 hover:bg-sky-900/60 transition-all font-bold shadow-xs cursor-pointer"
            title="Open in Google AI Studio with a different Gmail account"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <span>Open in AI Studio (Different Gmail)</span>
            <ExternalLink className="w-3 h-3 text-sky-400" />
          </button>
        )}
      </div>

      {captureMode === "qr" ? (
        <BoxQrScanner
          onParsedSuccess={onParsedSuccess}
          onOpenAiStudioModal={onOpenAiStudioModal}
        />
      ) : (
        <>
          {/* Garage Workstation Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md text-slate-100">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
              Open-Source OCR Intake
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white font-mono">
              Scan Parts Receipt or Delivery Invoice
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Capture or upload supplier invoices. The embedded open-source Tesseract OCR engine extracts vendor, parts, SKUs,
              quantities, and costs, then auto-matches to your local garage inventory with zero external API dependencies.
            </p>
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            {/* Direct Camera Button for Garage Tablets/Mobiles */}
            <button
              id="camera-capture-btn"
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 md:flex-none inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow transition-colors"
            >
              <Camera className="w-4 h-4 mr-2" />
              Use Camera
            </button>

            {/* Hidden file inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        </div>
      </div>

      {/* Main Upload Dropzone */}
      <div
        id="receipt-dropzone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all bg-slate-900/60 ${
          isDragging
            ? "border-amber-400 bg-amber-500/10"
            : selectedFile
            ? "border-slate-700 bg-slate-900"
            : "border-slate-800 hover:border-slate-700"
        }`}
      >
        {selectedFile ? (
          <div className="space-y-4">
            <div className="max-w-md mx-auto bg-slate-950 border border-slate-800 rounded-lg p-3 shadow-inner">
              <div className="max-h-72 overflow-hidden rounded flex items-center justify-center bg-slate-900">
                {selectedFile.mime.includes("pdf") ? (
                  <div className="p-8 flex flex-col items-center">
                    <FileText className="w-16 h-16 text-amber-400 mb-2" />
                    <span className="text-sm font-semibold text-slate-200">
                      {selectedFile.name} (PDF Document)
                    </span>
                  </div>
                ) : (
                  <img
                    src={selectedFile.dataUrl}
                    alt="Receipt Preview"
                    className="max-h-64 object-contain"
                  />
                )}
              </div>
              <div className="mt-2 text-xs text-slate-400 flex items-center justify-between px-1">
                <span className="font-mono truncate">{selectedFile.name}</span>
                <span className="text-emerald-400 flex items-center font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Ready
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                id="start-ocr-btn"
                type="button"
                disabled={isProcessing}
                onClick={startAiParsing}
                className="inline-flex items-center px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-slate-950 font-extrabold text-sm tracking-wide shadow-lg transition-all"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin text-slate-950" />
                    <span>Processing with Open-Source OCR...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 text-slate-950" />
                    <span>Run Open-Source OCR Parser</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => {
                  setSelectedFile(null);
                  setErrorMessage(null);
                }}
                className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors"
              >
                Choose Different File
              </button>
            </div>

            {isProcessing && (
              <div className="max-w-md mx-auto mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800 text-left">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping"></div>
                  <p className="text-sm font-medium text-amber-300 font-mono">
                    {processingStep || "Parsing document..."}
                  </p>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div className="bg-amber-400 h-full w-2/3 animate-pulse rounded-full"></div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 mx-auto bg-slate-800 rounded-full flex items-center justify-center text-amber-400 shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>

            <div>
              <p className="text-base font-bold text-white">
                Drag and drop receipt photo or PDF here
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports PNG, JPG, WEBP, or scanned supplier invoice PDFs
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                id="browse-file-btn"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 shadow-sm transition-colors"
              >
                Browse Local Files
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error alert if any */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-sm flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-red-300">Receipt OCR Failed</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Instant Test Receipts for Garage Demonstration */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center space-x-2 text-slate-200 mb-3">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-sm uppercase tracking-wide font-mono">
            Fast Test: Load Sample Garage Invoices
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Click any sample invoice below to test multimodal extraction, automatic inventory matching,
          and Google Drive archival instantly without photographing paper:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SAMPLE_RECEIPTS.map((sample) => (
            <button
              key={sample.id}
              id={`sample-receipt-${sample.id}`}
              onClick={() => handleSelectSample(sample)}
              className="p-3 text-left rounded-lg bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-amber-400 group-hover:text-amber-300 truncate">
                  {sample.vendor}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  Sample
                </span>
              </div>
              <p className="text-xs font-medium text-slate-200 mt-1 line-clamp-1">
                {sample.name}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                {sample.description}
              </p>
            </button>
          ))}
        </div>
      </div>
        </>
      )}
    </div>
  );
};
