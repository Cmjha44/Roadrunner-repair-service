import React from "react";
import { Wrench, Database, Cloud, Users, Bell, LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { DriveConfigStatus } from "../types.ts";
import { User } from "firebase/auth";

interface HeaderProps {
  activeTab: "scan" | "inventory" | "ledger" | "movements";
  setActiveTab: (tab: "scan" | "inventory" | "ledger" | "movements") => void;
  lowStockCount: number;
  driveStatus: DriveConfigStatus | null;
  currentUser: User | null;
  isSigningIn: boolean;
  onSignInWithGoogle: () => void;
  onSignOutGoogle: () => void;
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
  currentUser,
  isSigningIn,
  onSignInWithGoogle,
  onSignOutGoogle,
  onOpenDriveSettings,
  onOpenStaffManagement,
  onSwitchToStaffPortal,
  onOpenNotificationCenter,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Workshop Title */}
          <div className="flex items-center space-x-3">
            <div className="bg-amber-500 text-slate-950 p-2.5 rounded-lg font-black flex items-center justify-center shadow-inner">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white uppercase font-mono">
                  Road Runner <span className="text-amber-400">Moto Repair Shop</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-emerald-400 border border-emerald-900/50 font-mono">
                  <Database className="w-3 h-3 mr-1" />
                  SQLite
                </span>
                <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-sky-400 border border-sky-900/50 font-mono">
                  Drive Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Receipts Scanner • Spare Parts Inventory • Google Drive Archival
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
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span>Scan Receipt</span>
            </button>

            <button
              id="nav-inventory-tab"
              onClick={() => setActiveTab("inventory")}
              className={`flex items-center px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
                activeTab === "inventory"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span>Inventory</span>
            </button>

            <button
              id="nav-ledger-tab"
              onClick={() => setActiveTab("ledger")}
              className={`flex items-center px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
                activeTab === "ledger"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span>Receipts Ledger</span>
            </button>

            <button
              id="nav-movements-tab"
              onClick={() => setActiveTab("movements")}
              className={`hidden md:flex items-center px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${
                activeTab === "movements"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span>Stock Logs</span>
            </button>

            {/* Staff Portal Link */}
            <button
              id="staff-link-btn"
              onClick={onOpenStaffManagement}
              title="Staff Link & Team Accounts"
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
              title={
                driveStatus?.configured
                  ? `Google Drive: ${driveStatus.companyEmail || (currentUser ? currentUser.email : "Connected")} (${driveStatus.folderName || "Workshop Archive"})`
                  : "Google Drive Cloud Archival Settings"
              }
              className={`p-2 rounded-md border transition-all flex items-center space-x-1.5 text-xs font-medium shadow-sm ${
                driveStatus?.configured || currentUser
                  ? "bg-sky-950/60 hover:bg-sky-900/60 text-sky-200 border-sky-600/60"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700"
              }`}
            >
              <Cloud className="w-4 h-4 text-sky-400" />
              <span className="hidden lg:inline font-mono">
                {currentUser?.email
                  ? currentUser.email.split("@")[0]
                  : driveStatus?.folderName || "Drive Sync"}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  driveStatus?.configured || currentUser ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              ></span>
            </button>

            {/* Official Google Sign-In / Account State Button */}
            {currentUser ? (
              <div className="flex items-center space-x-1.5 ml-1 pl-2 border-l border-slate-800">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || "Google User"}
                    className="w-7 h-7 rounded-full border border-sky-500/50"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-sky-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                    {(currentUser.email || "U")[0].toUpperCase()}
                  </div>
                )}
                <div className="hidden xl:flex flex-col text-left">
                  <span className="text-[11px] font-bold text-slate-200 truncate max-w-[110px]">
                    {currentUser.displayName || currentUser.email?.split("@")[0]}
                  </span>
                  <span className="text-[9px] text-emerald-400 font-mono flex items-center">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                    Drive Synced
                  </span>
                </div>
                <button
                  onClick={onSignOutGoogle}
                  title="Sign out of Google Account"
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onSignInWithGoogle}
                disabled={isSigningIn}
                className="ml-1 sm:ml-2 flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-800 text-xs font-medium font-sans shadow transition-all shrink-0 cursor-pointer disabled:opacity-50"
              >
                {/* Official Google 'G' icon */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27a7.195 7.195 0 0 1 0-4.54V6.58H1.25a11.96 11.96 0 0 0 0 10.84l4.03-3.15Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                  />
                </svg>
                <span className="font-semibold text-slate-800 text-xs">
                  {isSigningIn ? "Signing in..." : "Sign in with Google"}
                </span>
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};
