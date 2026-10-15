import React, { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} from "@zxing/library";
import {
  Camera,
  QrCode,
  Barcode,
  ScanBarcode,
  ScanLine,
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
  SlidersHorizontal,
  Play,
} from "lucide-react";
import {
  InventoryItem,
  ParsedReceiptData,
  ParsedItemPayload,
  GARAGE_CATEGORIES,
  GarageCategory,
} from "../types.ts";
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
  format?: string;
}

// Global cached ZXing MultiFormat reader for 1D Barcodes and 2D codes
const zxReader = new MultiFormatReader();
const zxHints = new Map();
zxHints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
]);
zxHints.set(DecodeHintType.TRY_HARDER, true);
zxReader.setHints(zxHints);

export const BoxQrScanner: React.FC<BoxQrScannerProps> = ({
  onParsedSuccess,
  onOpenAiStudioModal,
}) => {
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isCameraStarting, setIsCameraStarting] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  // Scanner option: "all" (QR + Barcode), "qr" (QR Code only), "barcode" (1D Barcode only)
  const [scanFormat, setScanFormat] = useState<"all" | "qr" | "barcode">("all");

  // Inventory state for matching
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  // Scanned result
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

  // Sample cards (QR Codes & 1D Barcodes)
  const [activeSampleTab, setActiveSampleTab] = useState<"qr" | "barcode">("qr");
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

  const [sampleBarcodeCards, setSampleBarcodeCards] = useState<
    Array<{
      id: string;
      label: string;
      sku: string;
      name: string;
      category: GarageCategory;
      qty: number;
      cost: number;
      barcodeImage: string;
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
      console.error("Failed to load inventory for scanner matching:", e);
    } finally {
      setIsLoadingInventory(false);
    }
  };

  useEffect(() => {
    fetchInventory();
    generateSampleQrCodes();
    generateSampleBarcodes();

    return () => {
      stopCamera();
    };
  }, []);

  // Generate sample QR code data URLs
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

  // Generate sample 1D Barcodes with JsBarcode
  const generateSampleBarcodes = () => {
    const barcodeSamples = [
      {
        id: "bar-1",
        label: "Motul 7100 10W-40 Synthetic (1L)",
        sku: "MOT-7100-10W40",
        name: "Motul 7100 4T 10W-40 Synthetic Oil (1L)",
        category: "Oils & Fluids" as GarageCategory,
        qty: 6,
        cost: 18.5,
      },
      {
        id: "bar-2",
        label: "Brembo Front Sintered Brake Pads 07BB",
        sku: "BRK-PAD-07BB",
        name: "Brembo Sintered Front Brake Pads 07BB",
        category: "Braking" as GarageCategory,
        qty: 4,
        cost: 42.0,
      },
      {
        id: "bar-3",
        label: "NGK Laser Iridium Spark Plug CR9EIA",
        sku: "SPK-NGK-CR9E",
        name: "NGK Laser Iridium Spark Plug CR9EIA-9",
        category: "Electrical" as GarageCategory,
        qty: 8,
        cost: 16.5,
      },
      {
        id: "bar-4",
        label: "K&N Oil Filter KN-204-1 Black",
        sku: "FLT-KN-KN204",
        name: "K&N Oil Filter KN-204-1 Black",
        category: "Oils & Fluids" as GarageCategory,
        qty: 5,
        cost: 19.99,
      },
    ];

    const rendered = barcodeSamples.map((s) => {
      try {
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, s.sku, {
          format: "CODE128",
          width: 2,
          height: 50,
          displayValue: true,
          font: "monospace",
          fontSize: 12,
          background: "#ffffff",
          lineColor: "#0f172a",
          margin: 8,
        });
        return { ...s, barcodeImage: canvas.toDataURL("image/png") };
      } catch (err) {
        return { ...s, barcodeImage: "" };
      }
    });

    setSampleBarcodeCards(rendered);
  };

  // Emulate instant scan of sample parts (1-click test for demo / when physical camera is busy)
  const handleEmulateDemoScan = (type?: "qr" | "barcode" | "all") => {
    const targetType = type || scanFormat;
    if (targetType === "barcode" && sampleBarcodeCards.length > 0) {
      const sample = sampleBarcodeCards[0];
      handleDetected(sample.sku, sample.barcodeImage, "1D Barcode (CODE-128)");
    } else if (sampleQrCards.length > 0) {
      const sample = sampleQrCards[0];
      const payload = JSON.stringify({
        sku: sample.sku,
        name: sample.name,
        category: sample.category,
        quantity: sample.qty,
        unit_cost: sample.cost,
        vendor: "Apex Moto Supply Co.",
      });
      handleDetected(payload, sample.qrImage, "QR Code");
    }
  };

  // Start Live Camera Scanning with robust multi-stage fallback & hardware release
  const startCamera = async (
    mode: "environment" | "user" = facingMode,
    forcedFormat?: "all" | "qr" | "barcode"
  ) => {
    const activeFmt = forcedFormat || scanFormat;
    if (forcedFormat) {
      setScanFormat(forcedFormat);
    }
    setCameraError(null);
    setIsCameraStarting(true);

    // If stream is active, stop it cleanly and give the browser/OS camera pipeline time to release
    if (streamRef.current) {
      stopCamera();
      await new Promise((resolve) => setTimeout(resolve, 250));
    } else {
      stopCamera();
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError(
        "Camera API is not supported in this browser environment. You can upload an image or click 'Emulate Demo Scan' below."
      );
      setIsCameraStarting(false);
      return;
    }

    let stream: MediaStream | null = null;

    // Stage 1: Try with ideal dimensions & requested facingMode
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err1: any) {
      console.warn("Camera attempt 1 (ideal 720p constraints) failed, attempting fallback:", err1);
      // Wait for camera hardware driver to settle
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Stage 2: Try facingMode only without strict width/height
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
        });
      } catch (err2: any) {
        console.warn("Camera attempt 2 (facingMode only) failed, attempting basic video:", err2);
        await new Promise((resolve) => setTimeout(resolve, 250));

        // Stage 3: Try simple video: true
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (err3: any) {
          // Graceful handling of hardware errors without throwing fatal console.error
          console.warn("Camera access failed across all constraint levels:", err3);

          const isDeviceInUse =
            err3?.name === "NotReadableError" ||
            err3?.name === "TrackStartError" ||
            err1?.name === "NotReadableError" ||
            err1?.name === "TrackStartError" ||
            err2?.name === "NotReadableError" ||
            err3?.message?.toLowerCase().includes("device in use") ||
            err3?.message?.toLowerCase().includes("could not start video source") ||
            err1?.message?.toLowerCase().includes("device in use");

          if (isDeviceInUse) {
            setCameraError(
              "Camera access failed: Device in use. Another application, browser tab, or software (e.g. Zoom, Google Meet) may be using your camera."
            );
          } else if (err3?.name === "NotAllowedError" || err3?.name === "PermissionDeniedError") {
            setCameraError(
              "Camera access permission was denied. Please allow camera permissions in your browser address bar."
            );
          } else if (err3?.name === "NotFoundError" || err3?.name === "DevicesNotFoundError") {
            setCameraError(
              "No camera device was detected on your system. You can upload an image or click 'Emulate Demo Scan'."
            );
          } else {
            setCameraError(
              err3?.message ||
                "Unable to access camera. Please check camera permissions or upload an image file."
            );
          }

          setIsCameraActive(false);
          setIsCameraStarting(false);
          return;
        }
      }
    }

    if (stream) {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Video playback was interrupted or delayed:", playErr);
        }
      }

      setIsCameraActive(true);
      setCameraError(null);
      startScanningLoop(activeFmt);
    }
    setIsCameraStarting(false);
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (e) {
        // Safe track stop
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsCameraStarting(false);
  };

  const toggleCameraFacing = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    if (isCameraActive) {
      startCamera(nextMode);
    }
  };

  // Scanning loop on the canvas (supports both QR codes and 1D Barcodes)
  const startScanningLoop = (activeFormat: "all" | "qr" | "barcode" = scanFormat) => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    scanIntervalRef.current = window.setInterval(async () => {
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

      // 1. Check for QR Code via jsQR if mode is "all" or "qr"
      if (activeFormat === "all" || activeFormat === "qr") {
        const qr = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (qr && qr.data) {
          handleDetected(qr.data, canvas.toDataURL("image/jpeg"), "QR Code");
          stopCamera();
          return;
        }
      }

      // 2. Try native Hardware BarcodeDetector if available in browser
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: [
              "qr_code",
              "code_128",
              "code_39",
              "ean_13",
              "ean_8",
              "upc_a",
              "upc_e",
            ],
          });
          const detected = await detector.detect(canvas);
          if (detected && detected.length > 0 && detected[0].rawValue) {
            const raw = detected[0].rawValue;
            const fmt = detected[0].format || "barcode";
            const isQr = fmt === "qr_code";

            // Enforce format constraint if selected
            if (
              activeFormat === "all" ||
              (activeFormat === "qr" && isQr) ||
              (activeFormat === "barcode" && !isQr)
            ) {
              const readableFormat = isQr
                ? "QR Code"
                : `1D Barcode (${fmt.toUpperCase().replace("_", "-")})`;
              handleDetected(raw, canvas.toDataURL("image/jpeg"), readableFormat);
              stopCamera();
              return;
            }
          }
        } catch (e) {
          // Fall through to ZXing MultiFormatReader
        }
      }

      // 3. Fallback: Multi-Format 1D Barcode & QR Reader via @zxing/library
      if (activeFormat === "all" || activeFormat === "barcode") {
        try {
          const luminanceSource = new RGBLuminanceSource(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
          );
          const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
          const result = zxReader.decode(binaryBitmap);

          if (result && result.getText()) {
            const fmt = result.getBarcodeFormat();
            const formatName = BarcodeFormat[fmt] || "1D Barcode";
            const isQr = formatName === "QR_CODE";

            if (activeFormat === "all" || !isQr) {
              const displayFormat = isQr
                ? "QR Code"
                : `1D Barcode (${formatName.replace("_", "-")})`;
              handleDetected(
                result.getText(),
                canvas.toDataURL("image/jpeg"),
                displayFormat
              );
              stopCamera();
              return;
            }
          }
        } catch (err) {
          // Expected: no code detected in this video frame
        }
      }
    }, 150);
  };

  // Decode String payload (handles JSON, SKU prefixes, 1D barcode numbers, or plain strings)
  const parseScannedText = (text: string, formatName?: string): DecodedBoxData => {
    const trimmed = text.trim();
    let sku = "";
    let name = "";
    let quantity = 1;
    let unitCost = 0;
    let category: GarageCategory | undefined = undefined;
    let vendor = "Box Scanner Delivery";

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
        // Look up if any inventory item matches by SKU or ID directly
        const exactMatch = inventoryList.find(
          (i) =>
            i.sku.toUpperCase() === trimmed.toUpperCase() ||
            i.id.toLowerCase() === trimmed.toLowerCase()
        );
        if (exactMatch) {
          sku = exactMatch.sku;
          name = exactMatch.name;
        } else {
          sku = trimmed.split(/[\s,;|]/)[0] || trimmed;
        }
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
      format: formatName || "Auto-Detected",
    };
  };

  // Handle detection from camera or uploaded file
  const handleDetected = (rawText: string, dataUrl?: string, formatName?: string) => {
    const decoded = parseScannedText(rawText, formatName);
    setScannedResult(decoded);
    setRestockQty(decoded.quantity || 1);
    setRestockSuccess(null);

    if (dataUrl) {
      setQrDataUrl(dataUrl);
    }

    // Match against local inventory
    const matched = inventoryList.find(
      (item) =>
        item.sku.toUpperCase() === decoded.sku.toUpperCase() ||
        (decoded.name && item.name.toLowerCase() === decoded.name.toLowerCase()) ||
        item.id.toLowerCase() === decoded.sku.toLowerCase()
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

  // Handle uploaded image file (supports both QR codes & 1D Barcodes)
  const handleFileUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // 1. Check for QR Code
        const qr = jsQR(imageData.data, imageData.width, imageData.height);
        if (qr && qr.data) {
          handleDetected(qr.data, canvas.toDataURL("image/jpeg"), "QR Code");
          return;
        }

        // 2. Check for 1D Barcode with ZXing
        try {
          const luminanceSource = new RGBLuminanceSource(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
          );
          const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
          const result = zxReader.decode(binaryBitmap);
          if (result && result.getText()) {
            const fmt = result.getBarcodeFormat();
            const formatName = BarcodeFormat[fmt] || "1D Barcode";
            handleDetected(
              result.getText(),
              canvas.toDataURL("image/jpeg"),
              `Barcode (${formatName.replace("_", "-")})`
            );
            return;
          }
        } catch (err) {
          // No barcode found
        }

        setCameraError(
          "Could not detect a valid QR code or 1D barcode in the uploaded image. Please try a clearer picture."
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle 1-Click Quick Restock into SQLite inventory
  const handleQuickRestock = async () => {
    if (!scannedResult) return;
    setIsRestocking(true);
    setRestockSuccess(null);

    const qty = Number(restockQty) || 1;
    const cost = Number(unitCost) || 0;

    try {
      if (matchedPart) {
        const res = await fetch(`/api/inventory/${matchedPart.id}/increment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            delta: qty,
            reason: `Direct Scanner Restock (${scannedResult.format || "Code"}) from ${scannedResult.vendor || "Warehouse"}`,
            unit_cost: cost,
          }),
        });

        const json = await res.json();
        if (res.ok) {
          setRestockSuccess(
            `Successfully restocked +${qty} units of "${matchedPart.name}". New Stock: ${json.newStock}`
          );
          fetchInventory();
        } else {
          alert(json.error || "Failed to update inventory.");
        }
      } else {
        const res = await fetch("/api/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sku: scannedResult.sku,
            name: newPartName,
            category: newCategory,
            stock_quantity: qty,
            reorder_threshold: 2,
            last_purchased_cost: cost,
            selling_price: Number((cost * 1.4).toFixed(2)),
            location_bin: newBinLocation,
          }),
        });

        const json = await res.json();
        if (res.ok) {
          setRestockSuccess(
            `Registered new inventory part "${newPartName}" with +${qty} initial units.`
          );
          fetchInventory();
          if (json.item) {
            setMatchedPart(json.item);
          }
        } else {
          alert(json.error || "Failed to create inventory part.");
        }
      }
    } catch (e: any) {
      console.error("Restock failed:", e);
      alert(e.message || "Failed to complete restock.");
    } finally {
      setIsRestocking(false);
    }
  };

  // Push into Main OCR Verification Flow
  const handleSendToVerification = async () => {
    if (!scannedResult) return;

    const qty = Number(restockQty) || 1;
    const cost = Number(unitCost) || 0;
    const lineTotal = Number((qty * cost).toFixed(2));

    const parsedData: ParsedReceiptData = {
      vendor_name: scannedResult.vendor || "Box Barcode Delivery",
      transaction_date: new Date().toISOString().split("T")[0],
      receipt_number: `SCAN-${scannedResult.sku}-${Date.now().toString().slice(-4)}`,
      subtotal: lineTotal,
      tax: 0,
      total_amount: lineTotal,
      notes: `Restock received via ${scannedResult.format || "Scanner"} on shelf bin: ${newBinLocation}`,
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
      `Label_${scannedResult.sku}.png`,
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
                <ScanBarcode className="w-3.5 h-3.5 mr-1" />
                Live Camera Scanner: QR &amp; Barcodes
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Code-128 &bull; EAN-13 &bull; UPC &bull; 2D QR
              </span>
            </div>
            <h3 className="text-xl font-black text-white font-mono">
              Parts Box QR Code &amp; 1D Barcode Scanner
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Instantly scan QR code box tags or standard 1D barcodes on spare parts packaging with your camera. Cross-reference parts against your local SQLite database with automatic stock updating.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenAiStudioModal && (
              <button
                type="button"
                onClick={onOpenAiStudioModal}
                className="px-3 py-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-sky-300 font-mono text-xs font-bold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                title="Open in Google AI Studio with a different Gmail account"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                <span>Open in AI Studio (Other Gmail)</span>
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
            {/* Viewfinder Header & Format Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
              <div className="flex items-center space-x-2 text-sm font-bold text-white font-mono">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>Camera Viewfinder</span>
              </div>

              {/* Format Filter Options (All vs QR vs Barcode) */}
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto text-xs font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setScanFormat("all");
                    if (isCameraActive) startScanningLoop("all");
                  }}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center space-x-1 ${
                    scanFormat === "all"
                      ? "bg-amber-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Detect both QR codes and 1D barcodes"
                >
                  <ScanBarcode className="w-3 h-3" />
                  <span>All Formats</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScanFormat("qr");
                    if (isCameraActive) startScanningLoop("qr");
                  }}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center space-x-1 ${
                    scanFormat === "qr"
                      ? "bg-amber-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Scan 2D QR codes only"
                >
                  <QrCode className="w-3 h-3" />
                  <span>QR Code</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScanFormat("barcode");
                    if (isCameraActive) startScanningLoop("barcode");
                  }}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center space-x-1 ${
                    scanFormat === "barcode"
                      ? "bg-amber-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Scan 1D barcodes only (EAN-13, UPC, Code 128)"
                >
                  <Barcode className="w-3 h-3" />
                  <span>1D Barcode</span>
                </button>

                {isCameraActive && (
                  <button
                    type="button"
                    onClick={toggleCameraFacing}
                    className="ml-1 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Switch camera"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Viewfinder Frame (Targeted Element) */}
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
                  {/* Hidden Canvas for Frame Analysis */}
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Mode Indicator Overlay */}
                  <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-700 text-[10px] font-mono flex items-center space-x-1.5 text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="uppercase font-bold">
                      {scanFormat === "all"
                        ? "Scanning: QR & Barcodes"
                        : scanFormat === "qr"
                        ? "Scanning: QR Code Only"
                        : "Scanning: 1D Barcode Only"}
                    </span>
                  </div>

                  {/* Targeted Crosshair Reticle Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    {scanFormat === "barcode" ? (
                      /* Barcode Laser Reticle (Wide horizontal bar with red laser line) */
                      <div className="w-64 sm:w-80 h-28 sm:h-32 border-2 border-dashed border-red-500/80 rounded-xl relative shadow-[0_0_25px_rgba(239,68,68,0.25)] flex items-center justify-center">
                        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_#ef4444] animate-pulse"></div>
                        <span className="absolute -bottom-6 left-0 right-0 text-center font-mono text-[10px] text-red-400 uppercase tracking-widest bg-slate-950/90 py-0.5 rounded border border-red-500/30">
                          Align Red Laser Across Barcode
                        </span>
                      </div>
                    ) : scanFormat === "qr" ? (
                      /* QR Code Reticle (Square) */
                      <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-dashed border-amber-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                        <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#f59e0b] animate-bounce"></div>
                        <span className="absolute -bottom-6 left-0 right-0 text-center font-mono text-[10px] text-amber-300 uppercase tracking-widest bg-slate-950/90 py-0.5 rounded border border-amber-500/30">
                          Aim at Box QR Code
                        </span>
                      </div>
                    ) : (
                      /* Hybrid Reticle (All Formats) */
                      <div className="w-56 sm:w-64 h-44 sm:h-48 border-2 border-dashed border-amber-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center justify-center">
                        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#f59e0b] animate-pulse"></div>
                        <span className="absolute -bottom-6 left-0 right-0 text-center font-mono text-[10px] text-amber-300 uppercase tracking-widest bg-slate-950/90 py-0.5 rounded border border-amber-500/30">
                          Aim at QR Code or 1D Barcode
                        </span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Idle Standby Card (Direct Target of CSS Selector 1) */
                <div className="w-full h-full p-4 sm:p-5 flex flex-col justify-center items-center text-center max-w-lg mx-auto space-y-3">
                  {cameraError ? (
                    /* In-Viewfinder Camera Error / Device In Use Recovery Deck */
                    <div className="w-full bg-slate-900/95 border border-rose-500/40 rounded-xl p-4 sm:p-5 text-left space-y-3 shadow-2xl backdrop-blur-sm animate-fade-in">
                      <div className="flex items-start justify-between gap-2 border-b border-rose-900/40 pb-2.5">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                            <AlertCircle className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-xs sm:text-sm text-white font-mono flex items-center gap-1.5">
                              <span>Camera Hardware Busy</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800 font-normal">
                                Device In Use
                              </span>
                            </h4>
                            <p className="text-[11px] text-rose-300/90 font-mono mt-0.5">
                              Another tab, app, or OS process has camera control.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCameraError(null)}
                          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
                          title="Dismiss"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        {cameraError}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isCameraStarting}
                          onClick={() => startCamera(facingMode, scanFormat)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center space-x-1.5 shadow transition-all cursor-pointer"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${isCameraStarting ? "animate-spin" : ""}`}
                          />
                          <span>{isCameraStarting ? "Reconnecting..." : "Retry Camera"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={toggleCameraFacing}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                        >
                          <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                          <span>Switch Facing</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEmulateDemoScan(scanFormat)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 font-mono text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                          title="Simulate a real scan with sample motorcycle parts"
                        >
                          <Zap className="w-3.5 h-3.5 text-emerald-400" />
                          <span>1-Click Test Code</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                        >
                          <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
                          <span>Upload Photo</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Interactive Standby Scanner Control Hub */
                    <>
                      {/* Status Badges & Subtitle */}
                      <div className="space-y-1">
                        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-900/90 text-amber-300 border border-slate-800 shadow-inner">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>Optical Engine Ready</span>
                          <span className="text-slate-500">&bull;</span>
                          <span className="text-white">
                            {scanFormat === "all"
                              ? "QR & Barcodes"
                              : scanFormat === "qr"
                              ? "QR Code Only"
                              : "1D Barcode Only"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto font-sans leading-tight">
                          Select a scanner mode to start camera recognition for parts boxes or receipts:
                        </p>
                      </div>

                      {/* 3 Interactive Mode Selector Cards */}
                      <div className="grid grid-cols-3 gap-2 w-full max-w-md pt-0.5">
                        {/* Option 1: QR Code */}
                        <button
                          type="button"
                          onClick={() => {
                            setScanFormat("qr");
                            startCamera(facingMode, "qr");
                          }}
                          className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between group cursor-pointer ${
                            scanFormat === "qr"
                              ? "bg-amber-500/15 border-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                              : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div
                              className={`p-1.5 rounded-lg ${
                                scanFormat === "qr"
                                  ? "bg-amber-500 text-slate-950 font-bold"
                                  : "bg-slate-800 text-amber-400"
                              }`}
                            >
                              <QrCode className="w-4 h-4" />
                            </div>
                            <span className="text-[9px] font-mono uppercase font-bold text-amber-400">
                              2D
                            </span>
                          </div>
                          <div>
                            <div className="font-mono font-bold text-xs text-white">QR Code</div>
                            <div className="text-[10px] text-slate-400 font-sans leading-tight mt-0.5 hidden sm:block">
                              Box tags &amp; receipts
                            </div>
                          </div>
                        </button>

                        {/* Option 2: 1D Barcode */}
                        <button
                          type="button"
                          onClick={() => {
                            setScanFormat("barcode");
                            startCamera(facingMode, "barcode");
                          }}
                          className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between group cursor-pointer ${
                            scanFormat === "barcode"
                              ? "bg-sky-500/15 border-sky-400 text-white shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                              : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div
                              className={`p-1.5 rounded-lg ${
                                scanFormat === "barcode"
                                  ? "bg-sky-400 text-slate-950 font-bold"
                                  : "bg-slate-800 text-sky-400"
                              }`}
                            >
                              <Barcode className="w-4 h-4" />
                            </div>
                            <span className="text-[9px] font-mono uppercase font-bold text-sky-400">
                              1D
                            </span>
                          </div>
                          <div>
                            <div className="font-mono font-bold text-xs text-white">Barcode</div>
                            <div className="text-[10px] text-slate-400 font-sans leading-tight mt-0.5 hidden sm:block">
                              EAN-13, UPC, Code 128
                            </div>
                          </div>
                        </button>

                        {/* Option 3: Both (QR + Barcode) */}
                        <button
                          type="button"
                          onClick={() => {
                            setScanFormat("all");
                            startCamera(facingMode, "all");
                          }}
                          className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between group cursor-pointer ${
                            scanFormat === "all"
                              ? "bg-emerald-500/15 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                              : "bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div
                              className={`p-1.5 rounded-lg ${
                                scanFormat === "all"
                                  ? "bg-emerald-400 text-slate-950 font-bold"
                                  : "bg-slate-800 text-emerald-400"
                              }`}
                            >
                              <ScanBarcode className="w-4 h-4" />
                            </div>
                            <span className="text-[9px] font-mono uppercase font-bold text-emerald-400">
                              Dual
                            </span>
                          </div>
                          <div>
                            <div className="font-mono font-bold text-xs text-white">All Formats</div>
                            <div className="text-[10px] text-slate-400 font-sans leading-tight mt-0.5 hidden sm:block">
                              Auto-detect 1D &amp; 2D
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* Primary Start Camera Button */}
                      <div className="pt-1 w-full max-w-md">
                        <button
                          type="button"
                          disabled={isCameraStarting}
                          onClick={() => startCamera(facingMode, scanFormat)}
                          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold font-mono text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg hover:shadow-amber-500/25 transition-all transform active:scale-98 cursor-pointer disabled:opacity-75"
                        >
                          {isCameraStarting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                              <span>Opening Camera Stream...</span>
                            </>
                          ) : (
                            <>
                              <Camera className="w-4 h-4 text-slate-950" />
                              <span>
                                Start Camera Scanner (
                                {scanFormat === "all"
                                  ? "QR + Barcode"
                                  : scanFormat === "qr"
                                  ? "QR Code"
                                  : "1D Barcode"}
                                )
                              </span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Fast Emulation / Fallback Hint */}
                      <div className="flex items-center justify-center space-x-3 text-[11px] font-mono text-slate-400 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleEmulateDemoScan(scanFormat)}
                          className="hover:text-amber-300 flex items-center space-x-1 underline decoration-dotted transition-colors cursor-pointer"
                        >
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span>1-Click Test Sample Scan</span>
                        </button>
                        <span>&bull;</span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="hover:text-sky-300 flex items-center space-x-1 underline decoration-dotted transition-colors cursor-pointer"
                        >
                          <UploadCloud className="w-3 h-3 text-sky-400" />
                          <span>Upload Image</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              {!isCameraActive ? (
                <button
                  type="button"
                  disabled={isCameraStarting}
                  onClick={() => startCamera()}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center space-x-2 shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-75"
                >
                  {isCameraStarting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  <span>
                    {isCameraStarting
                      ? "Starting Camera..."
                      : `Start Camera Scanner (${
                          scanFormat === "all"
                            ? "QR + Barcode"
                            : scanFormat === "qr"
                            ? "QR Code"
                            : "1D Barcode"
                        })`}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Stop Camera</span>
                </button>
              )}

              {/* Upload Image File Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-sky-400" />
                <span>Upload QR / Barcode Photo</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
            </div>

            {/* Camera error notification */}
            {cameraError && (
              <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center justify-between gap-2">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode, scanFormat)}
                    className="px-2 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-mono text-[10px] font-bold border border-rose-700 cursor-pointer"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraError(null)}
                    className="text-rose-400 hover:text-white p-0.5"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-[10px] text-slate-400 font-mono">
                        SKU: <strong className="text-amber-300">{scannedResult.sku}</strong>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-sky-400 font-mono font-medium border border-slate-700">
                        {scannedResult.format || "Scanned Code"}
                      </span>
                    </div>
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
                  title="Clear scanned code"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Matched Part Details */}
              {matchedPart ? (
                <div className="bg-slate-950/70 p-3.5 rounded-lg border border-slate-800 space-y-2 font-mono">
                  <div className="flex justify-between items-start">
                    <span className="text-slate-400">Database Name:</span>
                    <span className="text-white font-bold text-right ml-2">
                      {matchedPart.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Category:</span>
                    <span className="text-amber-300 font-semibold">{matchedPart.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Stock:</span>
                    <span className="text-emerald-400 font-black text-sm">
                      {matchedPart.stock_quantity} units on shelf
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bin Location:</span>
                    <span className="text-slate-300 font-medium">
                      {matchedPart.location_bin || "Shelf A-1"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last Unit Cost:</span>
                    <span className="text-slate-300">{formatNpr(matchedPart.last_purchased_cost)}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-slate-950/70 p-3.5 rounded-lg border border-slate-800 font-sans">
                  <div className="text-[11px] font-mono text-amber-300 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                    SKU <strong>{scannedResult.sku}</strong> is not yet in the inventory catalog. Configure part details to register it now:
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">
                      Part Name:
                    </label>
                    <input
                      type="text"
                      value={newPartName}
                      onChange={(e) => setNewPartName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white text-xs font-mono"
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
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono"
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
                    Received Units:
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
              <h4 className="font-bold text-white text-sm font-mono">No Code Scanned Yet</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scan a parts box with your camera or click one of the pre-loaded supplier test QR codes or 1D barcodes below to see instant SKU linking in action.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Instant Test Sample Box Labels (QR Code & 1D Barcode) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-slate-200">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-sm uppercase tracking-wide font-mono">
              Fast Test: 1-Click Sample Box Labels
            </span>
          </div>

          {/* Sample Format Pills */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveSampleTab("qr")}
              className={`px-2.5 py-1 rounded transition-colors flex items-center space-x-1.5 ${
                activeSampleTab === "qr"
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <QrCode className="w-3 h-3" />
              <span>Sample QR Codes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSampleTab("barcode")}
              className={`px-2.5 py-1 rounded transition-colors flex items-center space-x-1.5 ${
                activeSampleTab === "barcode"
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Barcode className="w-3 h-3" />
              <span>Sample 1D Barcodes</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Click any sample code below to emulate scanning a physical parts box with instant decoding and SQLite catalog linkage:
        </p>

        {/* QR Code Samples */}
        {activeSampleTab === "qr" && (
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
                  handleDetected(payload, sample.qrImage, "QR Code");
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
                    Box Qty: {sample.qty} &bull; Cost: {formatNpr(sample.cost)}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-amber-400 group-hover:text-amber-300">
                  <span>Emulate Scan</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 1D Barcode Samples */}
        {activeSampleTab === "barcode" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {sampleBarcodeCards.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => {
                  handleDetected(sample.sku, sample.barcodeImage, "1D Barcode (CODE-128)");
                }}
                className="p-3 rounded-lg bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-500/50 transition-all text-left group flex flex-col justify-between"
              >
                <div>
                  <div className="mb-2 bg-white rounded p-1.5 shadow-inner flex items-center justify-center">
                    {sample.barcodeImage ? (
                      <img
                        src={sample.barcodeImage}
                        alt={sample.sku}
                        className="h-10 w-full object-contain"
                      />
                    ) : (
                      <span className="font-mono text-slate-800 text-xs font-bold">
                        {sample.sku}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 font-mono font-bold">
                      {sample.sku}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">CODE-128</span>
                  </div>
                  <h5 className="font-bold text-xs text-slate-200 group-hover:text-white line-clamp-1">
                    {sample.name}
                  </h5>
                  <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                    Box Qty: {sample.qty} &bull; Cost: {formatNpr(sample.cost)}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-sky-400 group-hover:text-sky-300">
                  <span>Emulate Barcode</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
