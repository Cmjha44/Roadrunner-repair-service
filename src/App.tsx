import React, { useState, useEffect } from "react";
import { Header } from "./components/Header.tsx";
import { ReceiptCapture } from "./components/ReceiptCapture.tsx";
import { VerificationScreen } from "./components/VerificationScreen.tsx";
import { InventoryDashboard } from "./components/InventoryDashboard.tsx";
import { ReceiptHistory } from "./components/ReceiptHistory.tsx";
import { StockMovementsLog } from "./components/StockMovementsLog.tsx";
import { GoogleDriveModal } from "./components/GoogleDriveModal.tsx";
import { StaffPortal } from "./components/StaffPortal.tsx";
import { StaffManagementModal } from "./components/StaffManagementModal.tsx";
import { NotificationCenterModal } from "./components/NotificationCenterModal.tsx";
import { AiStudioShareModal } from "./components/AiStudioShareModal.tsx";
import { LedgerResetModal } from "./components/LedgerResetModal.tsx";
import { TrackReceiptModal } from "./components/TrackReceiptModal.tsx";
import { LowStockBanner } from "./components/LowStockBanner.tsx";
import { ParsedReceiptData, DriveConfigStatus } from "./types.ts";
import {
  initAuth,
  googleSignIn,
  googleLogout,
  getAccessToken,
} from "./services/googleAuth.ts";
import { User } from "firebase/auth";
import {
  CheckCircle2,
  ExternalLink,
  Cloud,
  X,
  Users,
  ArrowRight,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

export default function App() {
  // Check if URL specifies the staff branch link (?portal=staff or /staff)
  const [isStaffPortalActive, setIsStaffPortalActive] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("portal") === "staff" || window.location.pathname.startsWith("/staff");
  });

  const [isStaffManagementOpen, setIsStaffManagementOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isAiStudioModalOpen, setIsAiStudioModalOpen] = useState(false);
  const [isLedgerResetModalOpen, setIsLedgerResetModalOpen] = useState(false);
  const [trackingReceiptCode, setTrackingReceiptCode] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("track_receipt") || urlParams.get("receipt") || null;
  });
  const [activeTab, setActiveTab] = useState<"scan" | "inventory" | "ledger" | "movements">("scan");

  // Google Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Verification Screen state
  const [verificationData, setVerificationData] = useState<{
    parsed: ParsedReceiptData;
    rawImage: string;
    filename: string;
    mimeType: string;
  } | null>(null);

  // Global low stock indicator count
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [driveStatus, setDriveStatus] = useState<DriveConfigStatus | null>(null);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Commit success feedback toast
  const [commitToast, setCommitToast] = useState<{
    receiptId: string;
    driveLink: string;
  } | null>(null);

  // Initialize Firebase Auth listener on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        if (token) {
          fetch("/api/auth/google/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken: token,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            }),
          }).catch((e) => console.warn("Failed session ping:", e));
        }
      },
      () => {
        setCurrentUser(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleSignInWithGoogle = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setCurrentUser(res.user);
        fetchGarageMeta();
      }
    } catch (err: any) {
      if (
        err?.code === "auth/popup-closed-by-user" ||
        err?.message?.includes("auth/popup-closed-by-user")
      ) {
        // User voluntarily dismissed popup; do not set scary error toast
        return;
      }
      console.error("Sign in failed:", err);
      let errorMsg = err?.message || "Google Sign-in failed. Please check permissions.";
      if (
        err?.message?.includes("access_denied") ||
        err?.code === "auth/unauthorized-domain" ||
        err?.message?.includes("verification process") ||
        err?.message?.includes("403")
      ) {
        errorMsg = "Google OAuth 403 (Unverified App / Testing Mode): In Google Cloud Console, your OAuth Consent Screen is currently in 'Testing' mode. To sign in with 'roadrunner.motorepair@gmail.com', add it under Google Cloud Console > APIs & Services > OAuth consent screen > Test users, or sign in with the project owner account (chandra.jha44@gmail.com).";
      }
      setAuthError(errorMsg);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOutGoogle = async () => {
    await googleLogout();
    setCurrentUser(null);
    fetchGarageMeta();
  };

  // Fetch low stock count and drive status
  const fetchGarageMeta = async () => {
    try {
      // Low stock count
      const resInv = await fetch("/api/inventory?low_stock=true");
      const jsonInv = await resInv.json();
      if (jsonInv.items) {
        setLowStockCount(jsonInv.items.length);
      }

      // Drive status
      const resDrive = await fetch("/api/drive/status");
      const jsonDrive = await resDrive.json();
      setDriveStatus(jsonDrive);
    } catch (err) {
      console.error("Failed to load garage meta:", err);
    }
  };

  useEffect(() => {
    fetchGarageMeta();
  }, [refreshTrigger]);

  const handleParsedSuccess = (
    parsed: ParsedReceiptData,
    rawImage: string,
    filename: string,
    mimeType: string
  ) => {
    setVerificationData({
      parsed,
      rawImage,
      filename,
      mimeType,
    });
  };

  const handleCommitSuccess = (receiptId: string, driveLink: string) => {
    setVerificationData(null);
    setCommitToast({ receiptId, driveLink });
    setRefreshTrigger((prev) => prev + 1);
    setActiveTab("inventory");
  };

  // If staff branch link is active, render the dedicated Staff Portal
  if (isStaffPortalActive) {
    return (
      <StaffPortal
        onExitStaffPortal={() => {
          setIsStaffPortalActive(false);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("portal");
            window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
        }}
        lowStockCount={lowStockCount}
        driveStatus={driveStatus}
        currentUser={currentUser}
        isSigningIn={isSigningIn}
        onSignInWithGoogle={handleSignInWithGoogle}
        onSignOutGoogle={handleSignOutGoogle}
        onOpenDriveSettings={() => setIsDriveModalOpen(true)}
        onOpenStaffManagement={() => setIsStaffManagementOpen(true)}
        onOpenNotificationCenter={() => setIsNotificationModalOpen(true)}
        onOpenAiStudioModal={() => setIsAiStudioModalOpen(true)}
        onSwitchToStaffPortal={() => {
          setIsStaffPortalActive(true);
          const url = new URL(window.location.href);
          url.searchParams.set("portal", "staff");
          window.history.replaceState({}, "", url.toString());
        }}
      />

      {/* Google Sign-In Prompt Banner if not authenticated */}
      {!currentUser && (
        <div className="bg-gradient-to-r from-sky-950/80 via-slate-900 to-amber-950/40 border-b border-sky-800/50 text-xs px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-slate-200">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
              <span>
                <strong>Road Runner Moto Repair Shop Cloud Sync:</strong> Sign in with your Gmail account to automatically save all workshop receipts and inventory records into your Google Drive folder.
              </span>
            </div>
            <button
              onClick={handleSignInWithGoogle}
              disabled={isSigningIn}
              className="flex items-center space-x-1.5 px-3 py-1 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded shadow text-xs shrink-0 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"/>
                <path fill="#FBBC05" d="M5.28 14.27a7.195 7.195 0 0 1 0-4.54V6.58H1.25a11.96 11.96 0 0 0 0 10.84l4.03-3.15Z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/>
              </svg>
              <span>{isSigningIn ? "Connecting..." : "Sign in with Google"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Auth Error Toast if any */}
      {authError && (
        <div className="bg-red-950/90 border-b border-red-800 text-red-200 text-xs py-2 px-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>{authError}</span>
          </div>
          <button onClick={() => setAuthError(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Persistent Low-Stock Alert Banner for Shop Owner */}
      <LowStockBanner
        onOpenNotificationCenter={() => setIsNotificationModalOpen(true)}
        onRefreshTrigger={refreshTrigger}
      />

      {/* Staff Branch Callout Banner in Owner Mode */}
      <div className="bg-slate-900 border-b border-slate-800 text-xs px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold text-[10px] uppercase">
              Owner Mode
            </span>
            <span>
              Road Runner Staff Terminal Link active: Technicians &amp; Cashiers can log sell receipts with stock auto-deducted.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsStaffManagementOpen(true)}
              className="text-amber-400 hover:text-amber-300 font-mono font-bold underline flex items-center"
            >
              <Users className="w-3.5 h-3.5 mr-1" />
              <span>Staff Link &amp; Access Codes</span>
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={() => setIsAiStudioModalOpen(true)}
              className="text-sky-400 hover:text-sky-300 font-mono flex items-center font-bold"
              title="Open in Google AI Studio with a different Gmail account"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1 text-sky-400 animate-pulse" />
              <span>Open in AI Studio (Other Gmail)</span>
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => {
                setIsStaffPortalActive(true);
                const url = new URL(window.location.href);
                url.searchParams.set("portal", "staff");
                window.history.replaceState({}, "", url.toString());
              }}
              className="text-slate-400 hover:text-slate-200 font-mono flex items-center"
            >
              <span>Test Staff Terminal</span>
              <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Commit Success Notification Banner */}
      {commitToast && (
        <div className="bg-emerald-950 border-b border-emerald-800 text-emerald-200 py-3 px-4 shadow-inner">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs sm:text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Receipt committed &amp; synced to Google Drive &amp; SQLite database!
              </span>
              {commitToast.driveLink && (
                <a
                  href={commitToast.driveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center text-sky-400 hover:text-sky-300 underline font-mono text-xs"
                >
                  <Cloud className="w-3.5 h-3.5 mr-1" />
                  View in Google Drive
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              )}
            </div>
            <button
              onClick={() => setCommitToast(null)}
              className="text-emerald-400 hover:text-white ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Verification Screen takes precedence when active */}
        {verificationData ? (
          <VerificationScreen
            initialData={verificationData.parsed}
            rawImage={verificationData.rawImage}
            filename={verificationData.filename}
            mimeType={verificationData.mimeType}
            onCancel={() => setVerificationData(null)}
            onCommitSuccess={handleCommitSuccess}
          />
        ) : (
          <>
            {activeTab === "scan" && (
              <ReceiptCapture
                onParsedSuccess={handleParsedSuccess}
                onOpenAiStudioModal={() => setIsAiStudioModalOpen(true)}
              />
            )}

            {activeTab === "inventory" && (
              <InventoryDashboard
                onRefreshTrigger={refreshTrigger}
                onOpenNotificationCenter={() => setIsNotificationModalOpen(true)}
                onViewReceiptsLedger={() => setActiveTab("ledger")}
                onOpenLedgerReset={() => setIsLedgerResetModalOpen(true)}
              />
            )}

            {activeTab === "ledger" && (
              <ReceiptHistory
                onRefreshTrigger={refreshTrigger}
                onOpenLedgerReset={() => setIsLedgerResetModalOpen(true)}
              />
            )}

            {activeTab === "movements" && <StockMovementsLog />}
          </>
        )}
      </main>

      {/* Google Drive and Database Settings Modal */}
      <GoogleDriveModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        status={driveStatus}
        onStatusUpdated={fetchGarageMeta}
        currentUser={currentUser}
        onSignInWithGoogle={handleSignInWithGoogle}
      />

      {/* Staff Management & Branch Link Modal */}
      <StaffManagementModal
        isOpen={isStaffManagementOpen}
        onClose={() => setIsStaffManagementOpen(false)}
        onOpenLedgerReset={() => setIsLedgerResetModalOpen(true)}
        onOpenStaffPortal={() => {
          setIsStaffPortalActive(true);
          const url = new URL(window.location.href);
          url.searchParams.set("portal", "staff");
          window.history.replaceState({}, "", url.toString());
        }}
      />

      {/* Low-Stock Notification & Email Advisory Center Modal */}
      <NotificationCenterModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        onNavigateToInventory={() => {
          setActiveTab("inventory");
          setIsNotificationModalOpen(false);
        }}
        onStockUpdated={() => {
          setRefreshTrigger((prev) => prev + 1);
          fetchGarageMeta();
        }}
      />

      {/* Deployment & Ledger Reset Modal */}
      <LedgerResetModal
        isOpen={isLedgerResetModalOpen}
        onClose={() => setIsLedgerResetModalOpen(false)}
        onResetSuccess={() => {
          setRefreshTrigger((prev) => prev + 1);
          fetchGarageMeta();
        }}
      />

      {/* Google AI Studio Multi-Account & Sharing Modal */}
      <AiStudioShareModal
        isOpen={isAiStudioModalOpen}
        onClose={() => setIsAiStudioModalOpen(false)}
        appletId="f87bdbe3-6ea8-4d5e-8f60-cc03aff019f9"
        defaultEmail="chandra.jha44@gmail.com"
      />

      {/* Customer Checkout Tracking Modal (Direct URL or QR Scan) */}
      <TrackReceiptModal
        receiptCode={trackingReceiptCode}
        onClose={() => {
          setTrackingReceiptCode(null);
          const url = new URL(window.location.href);
          url.searchParams.delete("track_receipt");
          url.searchParams.delete("receipt");
          window.history.replaceState({}, "", url.toString());
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-500 font-mono">
        Road Runner Moto Repair Shop OS • Local-First SQLite Database • Role Guard Staff Portal • Google Drive Cloud Sync
      </footer>
    </div>
  );
}
