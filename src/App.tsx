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
import { LowStockBanner } from "./components/LowStockBanner.tsx";
import { ParsedReceiptData, DriveConfigStatus } from "./types.ts";
import { CheckCircle2, ExternalLink, Cloud, X, Users, ArrowRight } from "lucide-react";

export default function App() {
  // Check if URL specifies the staff branch link (?portal=staff or /staff)
  const [isStaffPortalActive, setIsStaffPortalActive] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("portal") === "staff" || window.location.pathname.startsWith("/staff");
  });

  const [isStaffManagementOpen, setIsStaffManagementOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"scan" | "inventory" | "ledger" | "movements">("scan");

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
          // If navigating away, keep or cancel verification
          setActiveTab(tab);
        }}
        lowStockCount={lowStockCount}
        driveStatus={driveStatus}
        onOpenDriveSettings={() => setIsDriveModalOpen(true)}
        onOpenStaffManagement={() => setIsStaffManagementOpen(true)}
        onOpenNotificationCenter={() => setIsNotificationModalOpen(true)}
        onSwitchToStaffPortal={() => {
          setIsStaffPortalActive(true);
          const url = new URL(window.location.href);
          url.searchParams.set("portal", "staff");
          window.history.replaceState({}, "", url.toString());
        }}
      />

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
              Counter Staff Branch Link available: Technicians &amp; Cashiers can only log sell receipts and browse catalog stock.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsStaffManagementOpen(true)}
              className="text-amber-400 hover:text-amber-300 font-mono font-bold underline flex items-center"
            >
              <Users className="w-3.5 h-3.5 mr-1" />
              <span>Copy Staff Link &amp; Manage Accounts</span>
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
                Receipt successfully committed to local SQLite database &amp; inventory synced!
              </span>
              {commitToast.driveLink && (
                <a
                  href={commitToast.driveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center text-sky-400 hover:text-sky-300 underline font-mono text-xs"
                >
                  <Cloud className="w-3.5 h-3.5 mr-1" />
                  View Archived Document
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
              <ReceiptCapture onParsedSuccess={handleParsedSuccess} />
            )}

            {activeTab === "inventory" && (
              <InventoryDashboard
                onRefreshTrigger={refreshTrigger}
                onOpenNotificationCenter={() => setIsNotificationModalOpen(true)}
              />
            )}

            {activeTab === "ledger" && (
              <ReceiptHistory onRefreshTrigger={refreshTrigger} />
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
      />

      {/* Staff Management & Branch Link Modal */}
      <StaffManagementModal
        isOpen={isStaffManagementOpen}
        onClose={() => setIsStaffManagementOpen(false)}
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

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-500 font-mono">
        MotoFix Garage OS • Local-First SQLite Database • Role Guard Staff Portal • Google Drive Cloud Backup
      </footer>
    </div>
  );
}
