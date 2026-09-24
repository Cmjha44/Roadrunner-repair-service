import React from "react";
import { Wrench, Database, Cloud, Camera, Package, Receipt, History, Users, Link, Bell } from "lucide-react";
import { DriveConfigStatus } from "../types.ts";

interface HeaderProps {
  activeTab: "scan" | "inventory" | "ledger" | "movements";
  setActiveTab: (tab: "scan" | "inventory" | "ledger" | "movements") => void;
  lowStockCount: number;
  driveStatus: DriveConfigStatus | null;
  onOpenDriveSettings: () => void;
  onOpenStaffManagement: () => void;
  onSwitchToStaffPortal: () => void;
  onOpenNotificationCenter: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  lowStockCount,
  driveStatus,
  onOpenDriveSettings,
  onOpenStaffManagement,
  onSwitchToStaffPortal,
  onOpenNotificationCenter,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Garage Title */}
          <div className="flex items-center space-x-3">
            <div className="bg-amber-500 text-slate-950 p-2 rounded-lg font-black flex items-center justify-center shadow-inner">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white uppercase font-mono">
                  MotoFix <span className="text-amber-400">Garage</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-emerald-400 border border-emerald-900/50">
                  <Database className="w-3 h-3 mr-1" />
                  SQLite Local
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-amber-400 border border-amber-900/50">
                  Tesseract OCR
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Receipt Scanner • Parts Inventory • Drive Backup
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              id="nav-scan-tab"
              onClick={() => setActiveTab("scan")}
              className={`flex items-center px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
                activeTab === "scan"
                  ? "bg-amber-500 text-slate-950 shadow"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Camera className="w-4 h-4 mr-1.5" />
              <span>Scan &amp; Verify</span>
            </button>

            <button
              id="nav-inventory-tab"
              onClick={() => setActiveTab("inventory")}
              className={`flex items-center px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors relative ${
                activeTab === "inventory"
                  ? "bg-amber-500 text-slate-950 shadow"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Package className="w-4 h-4 mr-1.5" />
              <span>Inventory</span>
              {lowStockCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse">
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              id="nav-ledger-tab"
              onClick={() => setActiveTab("ledger")}
              className={`flex items-center px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
                activeTab === "ledger"
                  ? "bg-amber-500 text-slate-950 shadow"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Receipt className="w-4 h-4 mr-1.5" />
              <span>Receipt Ledger</span>
            </button>

            <button
              id="nav-movements-tab"
              onClick={() => setActiveTab("movements")}
              className={`hidden md:flex items-center px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
                activeTab === "movements"
                  ? "bg-amber-500 text-slate-950 shadow"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <History className="w-4 h-4 mr-1.5" />
              <span>Stock Logs</span>
            </button>

            {/* Staff Link & Team Portal Trigger */}
            <button
              id="staff-link-btn"
              onClick={onOpenStaffManagement}
              title="Branch Out Staff Link & Manage Staff Accounts"
              className="ml-1 sm:ml-2 px-2.5 py-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors flex items-center space-x-1.5 text-xs font-mono font-semibold"
            >
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Staff Link</span>
            </button>

            {/* Low-Stock Notification Bell */}
            <button
              id="header-notification-bell-btn"
              onClick={onOpenNotificationCenter}
              title={`Low-Stock Notification Center (${lowStockCount} parts flagged)`}
              className="relative p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center justify-center"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              {lowStockCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-mono font-bold text-white shadow-sm animate-pulse">
                  {lowStockCount}
                </span>
              )}
            </button>

            {/* Cloud Drive Status Quick Trigger */}
            <button
              id="drive-status-btn"
              onClick={onOpenDriveSettings}
              title="Google Drive Cloud Archival Settings"
              className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center space-x-1.5 text-xs font-medium"
            >
              <Cloud className="w-4 h-4 text-sky-400" />
              <span className="hidden lg:inline">
                {driveStatus?.configured ? "Drive Connected" : "Drive Archive"}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

