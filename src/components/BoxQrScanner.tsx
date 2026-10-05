import React, { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import QRCode from "qrcode";
import {
  Camera,
  QrCode,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Package,
  Boxes,
  Plus,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Sparkles,
  Zap,
  Check,
  RotateCw,
  X,
  FileText,
} from "lucide-react";
import { InventoryItem, ParsedReceiptData, ParsedItemPayload, GARAGE_CATEGORIES, GarageCategory } from "../types.ts";
import { formatNpr } from "../utils/currency.ts";

interface BoxQrScannerProps {
  onParsedSuccess: (
    parsed: ParsedReceiptData,
    rawImage: string,
    filename: string,
    mimeType: string
  ) => void;
  onOpenAiStudioModal?: () => void;
}

interface DecodedBoxData {
  rawText: string;
  sku: string;
  name?: string;
  quantity: number;
  unitCost: number;
  category?: GarageCategory;
  vendor?: string;
}

export const BoxQrScanner: React.FC<BoxQrScannerProps> = ({
  onParsedSuccess,
  onOpenAiStudioModal,
}) => {
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // Inventory state for matching
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  // Scanned QR result
  const [scannedResult, setScannedResult] = useState<DecodedBoxData | null>(null);
  const [matchedPart, setMatchedPart] = useState<InventoryItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Form edit states for the linked part
  const [restockQty, setRestockQty] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [newPartName, setNewPartName] = useState<string>("");
  const [newCategory, setNewCategory] = useState<GarageCategory>("Other");
  const [newBinLocation, setNewBinLocation] = useState<string>("Shelf A-1");

  // Quick Restock feedback
  const [isRestocking, setIsRestocking] = useState(false);
  const [restockSuccess, setRestockSuccess] = useState<string | null>(null);

  // Sample QR codes with generated images
  const [sampleQrCards, setSampleQrCards] = useState<
    Array<{
      id: string;
      label: string;
      sku: string;
      name: string;
      category: GarageCategory;
      qty: number;
      cost: number;
      qrImage: string;
    }>
  >([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch current inventory
  const fetchInventory = async () => {
    setIsLoadingInventory(true);
    try {
      const res = await fetch("/api/inventory");
      const json = await res.json();
      if (json.items) {
        setInventoryList(json.items);
      }
    } catch (e) {
      console.error("Failed to load inventory for QR matching:", e);
    } finally {
      setIsLoadingInventory(false);
    }
  };

  useEffect(() => {
    fetchInventory();
    generateSampleQrCodes();

    return () => {
      stopCamera();
    };
  }, []);

  // Generate sample QR code data URLs for testing
  const generateSampleQrCodes = async () => {
    const samples = [
      {
        id: "sample-1",
        label: "Motul 7100 10W-40 Synthetic (Case of 8)",
        sku: "MOT-7100-10W40",
        name: "Motul 7100 4T 10W-40 Synthetic Oil (1L)",
        category: "Oils & Fluids" as GarageCategory,
        qty: 8,
        cost: 18.5,
      },
      {
        id: "sample-2",
        label: "Brembo Sintered Brake Pads (Box of 4)",
        sku: "BRK-PAD-F21",
        name: "Brembo Front Sintered Brake Pads",
        category: "Braking" as GarageCategory,
        qty: 4,
        cost: 28.0,
      },
      {
        id: "sample-3",
        label: "NGK Laser Iridium Spark Plugs (Pack of 10)",
        sku: "NGK-SPK-CR9EIX",
        name: "NGK Laser Iridium Spark Plug CR9EIX",
        category: "Electrical" as GarageCategory,
        qty: 10,
        cost: 9.5,
      },
      {
        id: "sample-4",
        label: "Stainless Caliper Bolts M8x25 (Box of 12)",
        sku: "HRD-M8-TORX",
        name: "Stainless Steel M8x25 Caliper Bolts",
        category: "Hardware" as GarageCategory,
        qty: 12,
        cost: 6.2,
      },
    ];

    const rendered = await Promise.all(
      samples.map(async (s) => {
        const payload = JSON.stringify({
          sku: s.sku,
          name: s.name,
          category: s.category,
          quantity: s.qty,
          unit_cost: s.cost,
          vendor: "Apex Moto Supply Co.",
        });
        const qrImage = await QRCode.toDataURL(payload, {
          width: 240,
          margin: 1,
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        return { ...s, qrImage };
      })
    );

    setSampleQrCards(rendered);
  };

  // Start Live Webcam Scanning
  const startCamera = async (mode: "environment" | "user" = facingMode) => {
    setCameraError(null);
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }

      setIsCameraActive(true);
      startScanningLoop();
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setCameraError(
        err?.message ||
          "Unable to access camera. Please check browser camera permissions or upload a QR image."
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const toggleCameraFacing = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    if (isCameraActive) {
      startCamera(nextMode);
    }
  };

  // Scanning loop on the canvas
  const startScanningLoop = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    scanIntervalRef.current = window.setInterval(() => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== 4) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        // QR Code detected!
        handleQrDetected(code.data, canvas.toDataURL("image/jpeg"));
        stopCamera();
      }
    }, 180);
  };

  // Decode QR String payload (handles JSON, SKU prefixes, or plain strings)
  const parseQrText = (text: string): DecodedBoxData => {
    const trimmed = text.trim();
    let sku = "";
    let name = "";
    let quantity = 1;
    let unitCost = 0;
    let category: GarageCategory | undefined = undefined;
    let vendor = "Box QR Delivery";

    try {
      // Try JSON format
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        const parsed = JSON.parse(trimmed);
        sku = parsed.sku || parsed.partNumber || parsed.id || "";
        name = parsed.name || parsed.part_name || "";
        quantity = Number(parsed.quantity || parsed.qty || 1);
        unitCost = Number(parsed.unit_cost || parsed.unit_price || parsed.cost || 0);
        category = parsed.category;
        vendor = parsed.vendor || vendor;
      }
    } catch (e) {
      // Not JSON
    }

    if (!sku) {
      // Check for SKU: or PART: prefixes
      const skuMatch = trimmed.match(/(?:sku|part|item|code)[\s:#_-]+([A-Z0-9-]+)/i);
      if (skuMatch && skuMatch[1]) {
        sku = skuMatch[1];
      } else {
        // Assume entire text or first word is the SKU
        sku = trimmed.split(/[\s,;|]/)[0] || trimmed;
      }
    }

    return {
      rawText: trimmed,
      sku: sku.trim().toUpperCase(),
      name: name || undefined,
      quantity: Math.max(1, quantity),
      unitCost: Math.max(0, unitCost),
      category,
      vendor,
    };
  };

  // Handle detection from camera or uploaded file
  const handleQrDetected = (rawText: string, dataUrl?: string) => {
    const decoded = parseQrText(rawText);
    setScannedResult(decoded);
    setRestockQty(decoded.quantity || 1);
    setRestockSuccess(null);

    if (dataUrl) {
      setQrDataUrl(dataUrl);
    }

    // Match against local inventory
    const matched = inventoryList.find(
      (item) =>
        item.sku.toUpperCase() === decoded.sku ||
        (decoded.name && item.name.toLowerCase() === decoded.name.toLowerCase()) ||
        item.id === decoded.sku.toLowerCase()
    );

    if (matched) {
      setMatchedPart(matched);
      setUnitCost(decoded.unitCost > 0 ? decoded.unitCost : matched.last_purchased_cost);
      setNewPartName(matched.name);
      setNewCategory(matched.category);
      setNewBinLocation(matched.location_bin || "Shelf A-1");
    } else {
      setMatchedPart(null);
      setUnitCost(decoded.unitCost || 15);
      setNewPartName(decoded.name || `Motorbike Part (${decoded.sku})`);
      setNewCategory(decoded.category || "Other");
      setNewBinLocation("Shelf A-1");
    }
  };

  // Handle uploaded image file
  const handleFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data) {
            handleQrDetected(code.data, canvas.toDataURL("image/jpeg"));
          } else {
            setCameraError(
              "No QR code found in this photo. Please make sure the QR label is centered and clearly lit."
            );
          }
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // ACTION 1: Quick Restock directly into inventory
  const handleQuickRestock = async () => {
    if (!scannedResult) return;
    setIsRestocking(true);
    setRestockSuccess(null);

    try {
      if (matchedPart) {
        // Increment stock
        const newStock = Number(matchedPart.stock_quantity) + Number(restockQty);
        const res = await fetch(`/api/inventory/${matchedPart.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selling_price: matchedPart.selling_price,
            location_bin: newBinLocation,
          }),
        });

        // Also add manual adjustment stock log
        await fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sku: matchedPart.sku,
            name: matchedPart.name,
            category: matchedPart.category,
            stock_quantity: newStock,
            last_purchased_cost: unitCost,
            selling_price: matchedPart.selling_price,
            location_bin: newBinLocation,
          }),
        }).catch(() => {});

        setRestockSuccess(
          `Successfully restocked ${restockQty}x "${matchedPart.name}"! Total stock is now ${newStock}.`
        );
      } else {
        // Create new part
        const res = await fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sku: scannedResult.sku,
            name: newPartName,
            category: newCategory,
            stock_quantity: restockQty,
            reorder_threshold: 3,
            last_purchased_cost: unitCost,
            selling_price: Number((unitCost * 1.35).toFixed(2)),
            location_bin: newBinLocation,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to create part");

        setRestockSuccess(
          `Created and stocked new part "${newPartName}" with SKU ${scannedResult.sku} (${restockQty} units)!`
        );
      }

      await fetchInventory();
    } catch (err: any) {
      setCameraError(err?.message || "Failed to update inventory.");
    } finally {
      setIsRestocking(false);
    }
  };

  // ACTION 2: Send Linked Part to Receipt Verification Intake Pipeline
  const handleSendToVerification = async () => {
    if (!scannedResult) return;

    const qty = Math.max(1, Number(restockQty) || 1);
    const cost = Math.max(0, Number(unitCost) || 0);
    const lineTotal = Number((qty * cost).toFixed(2));
    const now = new Date().toISOString();
    const today = now.split("T")[0];

    // Build synthetic QR delivery receipt payload
    const parsedData: ParsedReceiptData = {
      vendor_name: scannedResult.vendor || "Box QR Supplier Intake",
      transaction_date: today,
      receipt_number: `QR-BOX-${scannedResult.sku}-${Date.now().toString().slice(-4)}`,
      subtotal: lineTotal,
      tax: 0,
      total_amount: lineTotal,
      notes: `Restock received via QR code box scan on shelf bin: ${newBinLocation}`,
      items: [
        {
          part_name: matchedPart ? matchedPart.name : newPartName,
          sku: scannedResult.sku,
          quantity: qty,
          unit_price: cost,
          total_price: lineTotal,
          category: matchedPart ? matchedPart.category : newCategory,
          matchedInventoryId: matchedPart ? matchedPart.id : undefined,
          matchedInventoryName: matchedPart ? matchedPart.name : undefined,
          currentStock: matchedPart ? matchedPart.stock_quantity : 0,
          isNewItem: !matchedPart,
        },
      ],
    };

    // Use captured image or generate a clean QR code label image
    let imageToPass = qrDataUrl;
    if (!imageToPass) {
      imageToPass = await QRCode.toDataURL(scannedResult.rawText, {
        width: 400,
        margin: 2,
      });
    }

    onParsedSuccess(
      parsedData,
      imageToPass,
      `QR_Label_${scannedResult.sku}.png`,
      "image/png"
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Mode Description */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md text-slate-100">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1.5">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                <QrCode className="w-3.5 h-3.5 mr-1" />
                QR Box Scanner &amp; Inventory Linker
              </span>
            </div>
            <h3 className="text-xl font-black text-white font-mono">
              Scan Parts Boxes &amp; Bin QR Labels
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Instantly identify parts and cross-reference your garage inventory by pointing your device camera at QR codes on supplier boxes or shelf bin tags.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenAiStudioModal && (
              <button
                type="button"
                onClick={onOpenAiStudioModal}
                className="px-3 py-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 font-mono text-xs flex items-center space-x-1.5 transition-colors"
                title="Open in AI Studio with another email"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>Open in AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Viewfinder or Upload (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm font-bold text-white font-mono">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>Live Viewfinder</span>
              </div>

              {isCameraActive && (
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center space-x-1 border border-slate-700"
                  title="Switch front/back camera"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Flip ({facingMode === "environment" ? "Rear" : "Front"})</span>
                </button>
              )}
            </div>

            {/* Viewfinder Frame */}
            <div className="relative aspect-video max-h-80 w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
              {isCameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Hidden Canvas for QR Analysis */}
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Targeted Crosshair Reticle Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-dashed border-amber-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                      {/* Animated Laser Scan Line */}
                      <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#f59e0b] animate-bounce"></div>
                      <span className="absolute -bottom-6 left-0 right-0 text-center font-mono text-[10px] text-amber-300 uppercase tracking-widest bg-slate-950/80 py-0.5 rounded">
                        Aim at Box QR Code
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-200">
                      Camera scanner is currently idle
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Start the camera to scan box labels directly, or upload an image file of a QR code below.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              {!isCameraActive ? (
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center space-x-2 shadow transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Camera Scanner</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs flex items-center space-x-1.5 transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Stop Camera</span>
                </button>
              )}

              {/* Upload QR Photo Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition-colors"
              >
                <UploadCloud className="w-4 h-4 text-sky-400" />
                <span>Upload QR Image</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
            </div>

            {/* Camera or scanning error */}
            {cameraError && (
              <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Matched Part Card & Restock Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {scannedResult ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4 text-xs">
              {/* Header Status */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                      matchedPart
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold font-mono text-white text-sm">
                      {matchedPart ? "Part Linked to Inventory" : "New Part Recognized"}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      SKU: <strong className="text-amber-300">{scannedResult.sku}</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setScannedResult(null);
                    setMatchedPart(null);
                    setRestockSuccess(null);
                  }}
                  className="text-slate-400 hover:text-white p-1"
                  title="Clear scanned part"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Part Info Summary */}
              {matchedPart ? (
                <div className="bg-slate-950 border border-emerald-900/40 rounded-lg p-3.5 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-white text-xs">{matchedPart.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono mt-1 inline-block">
                        {matchedPart.category}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Current In-Stock</span>
                      <span className="font-mono text-sm font-bold text-emerald-400">
                        {matchedPart.stock_quantity} units
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Bin: <strong className="text-slate-200">{matchedPart.location_bin || "Workshop Bay"}</strong></span>
                    <span>Cost: <strong className="text-slate-200">{formatNpr(matchedPart.last_purchased_cost)}</strong></span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 border border-amber-900/40 rounded-lg p-3.5 space-y-2">
                  <p className="text-[11px] text-amber-300">
                    This part SKU is not in your current database. You can register it and assign a workshop shelf bin:
                  </p>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">
                      Part Description / Name:
                    </label>
                    <input
                      type="text"
                      value={newPartName}
                      onChange={(e) => setNewPartName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        Category:
                      </label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as GarageCategory)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                      >
                        {GARAGE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">
                        Shelf Bin:
                      </label>
                      <input
                        type="text"
                        value={newBinLocation}
                        onChange={(e) => setNewBinLocation(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Quantity & Unit Cost Adjustment */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">
                    Received Box Units:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={restockQty}
                    onChange={(e) => setRestockQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono text-xs font-bold text-amber-300"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">
                    Unit Cost (NPR):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={unitCost}
                    onChange={(e) => setUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono text-xs"
                  />
                </div>
              </div>

              {/* Success Notification */}
              {restockSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-start space-x-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{restockSuccess}</span>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={isRestocking}
                  onClick={handleQuickRestock}
                  className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 text-slate-950 font-bold font-mono text-xs flex items-center justify-center space-x-1.5 shadow transition-colors cursor-pointer"
                >
                  {isRestocking ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Inventory...</span>
                    </>
                  ) : (
                    <>
                      <Boxes className="w-4 h-4" />
                      <span>
                        {matchedPart ? `Quick Restock (+${restockQty} Units)` : "Register & Stock Part"}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSendToVerification}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  <span>Send to Delivery Receipt Intake</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500">
                <Package className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-white text-sm font-mono">No Box Scanned Yet</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scan a parts box with your camera or click one of the pre-loaded supplier test boxes below to see instant SKU linking and inventory restock in action.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Instant Test Sample Box Labels */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-200">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-sm uppercase tracking-wide font-mono">
              Fast Test: Click a Sample Parts Box QR Label
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
            1-Click QR Emulation
          </span>
        </div>
        <p className="text-xs text-slate-400">
          These simulate actual QR labels printed on delivery boxes from warehouse suppliers. Click any label to trigger instant decoding and part matching:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {sampleQrCards.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => {
                const payload = JSON.stringify({
                  sku: sample.sku,
                  name: sample.name,
                  category: sample.category,
                  quantity: sample.qty,
                  unit_cost: sample.cost,
                  vendor: "Apex Moto Supply Co.",
                });
                handleQrDetected(payload, sample.qrImage);
              }}
              className="p-3 rounded-lg bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/50 transition-all text-left group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-12 h-12 bg-white rounded p-1 shrink-0 shadow-inner">
                    <img
                      src={sample.qrImage}
                      alt={sample.sku}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-mono font-bold">
                    {sample.sku}
                  </span>
                </div>
                <h5 className="font-bold text-xs text-slate-200 group-hover:text-white line-clamp-1">
                  {sample.name}
                </h5>
                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                  Box Qty: {sample.qty} • Cost: {formatNpr(sample.cost)}
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-amber-400 group-hover:text-amber-300">
                <span>Scan Box</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
