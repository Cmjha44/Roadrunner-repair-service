import React, { useState, useEffect } from "react";
import {
  Cloud,
  Folder,
  CheckCircle2,
  AlertCircle,
  Download,
  X,
  Mail,
  ExternalLink,
  ShieldCheck,
  HardDrive,
  Info,
  FolderCheck,
  Check,
  RefreshCw,
  LogIn,
} from "lucide-react";
import { DriveConfigStatus } from "../types.ts";
import { User } from "firebase/auth";

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: DriveConfigStatus | null;
  onStatusUpdated: () => void;
  currentUser: User | null;
  onSignInWithGoogle: () => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  status,
  onStatusUpdated,
  currentUser,
  onSignInWithGoogle,
}) => {
  const [folderInput, setFolderInput] = useState("");
  const [folderName, setFolderName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ success: boolean; link?: string; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (status) {
      setFolderInput(status.folderId === "root" ? "" : status.folderId);
      setFolderName(status.folderName || "");
      setCompanyEmail(status.companyEmail || (currentUser?.email || ""));
    }
  }, [status, currentUser]);

  if (!isOpen) return null;

  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/drive/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderInput: folderInput.trim(),
          folderName: folderName.trim(),
          companyEmail: companyEmail.trim(),
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        onStatusUpdated();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save Drive folder settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncAllToDrive = async () => {
    setIsSyncingNow(true);
    setSyncFeedback(null);
    try {
      const res = await fetch("/api/drive/sync-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncFeedback({
          success: true,
          link: data.webLink,
          message: "Full workshop inventory and receipts synced to your Google Drive!",
        });
        onStatusUpdated();
      } else {
        setSyncFeedback({
          success: false,
          message: data.error || "Failed to sync. Please ensure you are signed in with Google.",
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        success: false,
        message: err.message || "Failed to synchronize to Google Drive.",
      });
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleResetToDefault = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/drive/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderInput: "root",
          folderName: "Main Drive (Default)",
          companyEmail: currentUser?.email || "",
        }),
      });
      if (res.ok) {
        setFolderInput("");
        setFolderName("");
        setSaveSuccess(true);
        onStatusUpdated();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to reset drive config:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const downloadFullBackup = () => {
    window.location.href = "/api/backup/export";
  };

  const cleanFolderId = folderInput.includes("folders/")
    ? folderInput.match(/folders\/([a-zA-Z0-9_-]+)/)?.[1] || folderInput
    : folderInput.trim();
  const driveWebUrl = cleanFolderId && cleanFolderId !== "root"
    ? `https://drive.google.com/drive/folders/${cleanFolderId}`
    : "https://drive.google.com/drive/my-drive";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white font-mono">
                  Road Runner Moto Repair Shop - Google Drive Hub
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Drive Backup
                </span>
              </div>
              <p className="text-xs text-slate-400">
                All workshop receipts, inventory changes, and sale logs saved to Google Drive
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gmail Sign In Status Box */}
        <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-mono text-slate-400 uppercase tracking-wider text-[11px] block">
                Signed-in Google Account
              </span>
              <span className="text-slate-200 font-bold text-sm">
                {currentUser?.email || "No Gmail account connected yet"}
              </span>
            </div>

            {currentUser ? (
              <button
                onClick={handleSyncAllToDrive}
                disabled={isSyncingNow}
                className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-mono font-bold text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? "animate-spin" : ""}`} />
                <span>{isSyncingNow ? "Backing up..." : "Sync All Data to Drive Now"}</span>
              </button>
            ) : (
              <button
                onClick={onSignInWithGoogle}
                type="button"
                className="px-3 py-1.5 rounded bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs flex items-center space-x-1.5 transition-colors shadow"
              >
                <LogIn className="w-3.5 h-3.5 text-sky-600" />
                <span>Sign in with Google Account</span>
              </button>
            )}
          </div>

          {/* Test Users Guidance Note for 403 access_denied */}
          <div className="p-3 rounded-lg bg-sky-950/40 border border-sky-800/40 text-slate-300 text-xs space-y-1">
            <div className="flex items-center text-sky-300 font-bold font-mono text-[11px] space-x-1.5">
              <Info className="w-3.5 h-3.5 text-sky-400" />
              <span>Fixing "Access blocked (Error 403: access_denied)":</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              When a Google Cloud OAuth app is in development ("Testing"), Google blocks sign-in from any email not registered as a test user. To sign in with <span className="font-mono text-amber-300 font-semibold">roadrunner.motorepair@gmail.com</span>:
            </p>
            <ol className="list-decimal list-inside text-[11px] text-slate-300 space-y-0.5 ml-1 font-sans">
              <li>Open <strong>Google Cloud Console</strong> &gt; <strong>APIs &amp; Services</strong> &gt; <strong>OAuth consent screen</strong>.</li>
              <li>Under <strong>Test users</strong>, click <strong>+ Add Users</strong> and enter <code className="text-amber-300 bg-slate-900 px-1 rounded">roadrunner.motorepair@gmail.com</code>.</li>
              <li>Or sign in directly using the project creator account (<code className="text-sky-300 bg-slate-900 px-1 rounded">chandra.jha44@gmail.com</code>).</li>
            </ol>
          </div>

          {syncFeedback && (
            <div
              className={`p-2 rounded text-xs flex items-center justify-between ${
                syncFeedback.success
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                  : "bg-red-950 text-red-300 border border-red-800"
              }`}
            >
              <span>{syncFeedback.message}</span>
              {syncFeedback.link && (
                <a
                  href={syncFeedback.link}
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-bold text-emerald-200 flex items-center ml-2"
                >
                  View in Drive <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-900 text-slate-300 font-mono">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Archived Receipts</span>
              <span className="font-bold text-amber-400">
                {status?.archivedCount ?? 0} documents
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Target Folder</span>
              <span className="font-semibold text-slate-200 truncate block">
                {status?.folderName || "Road Runner Moto Repair Shop Archive"}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Folder Direct Link</span>
              <a
                href={driveWebUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:text-sky-300 hover:underline flex items-center space-x-1 truncate"
                title="Open Folder in Google Drive"
              >
                <span className="truncate">{cleanFolderId || "Root / Drive"}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          </div>
        </div>

        {/* Form: Set Designated Drive Folder */}
        <form onSubmit={handleSaveFolder} className="space-y-4">
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-3.5">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-800/80">
              <FolderCheck className="w-4 h-4 text-amber-400" />
              <h4 className="font-bold text-slate-200 text-xs font-mono uppercase tracking-wide">
                Target Google Drive Folder Settings
              </h4>
            </div>

            {/* Folder Name (friendly label) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1 flex items-center">
                <Folder className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                Workshop Folder Name / Label
              </label>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Road Runner Moto Repair Shop Archive"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-slate-100 text-xs font-mono focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            {/* Folder ID or Share Link */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1 flex items-center justify-between">
                <span className="flex items-center">
                  <Cloud className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  Custom Google Drive Folder Link or Folder ID (Optional)
                </span>
                <span className="text-[10px] font-normal text-slate-400">
                  Accepts full URL or Folder ID
                </span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={folderInput}
                  onChange={(e) => setFolderInput(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/... or leave blank for auto-created folder"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-400 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-md text-xs font-mono transition-colors flex items-center justify-center space-x-1.5 shadow-md shrink-0"
                >
                  {isSaving ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Folder</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {saveSuccess && (
              <div className="p-2.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Drive configuration saved successfully!</span>
              </div>
            )}
          </div>
        </form>

        {/* Dual-Redundancy & Offline-First SQLite Section */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-white font-mono flex items-center">
                <HardDrive className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                Dual-Protection: Local SQLite + Google Drive Archival
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Every scanned receipt and sale is stored in SQLite and synchronized to Google Drive.
              </p>
            </div>
            <button
              onClick={downloadFullBackup}
              type="button"
              className="inline-flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-md border border-slate-700 transition-colors shrink-0 ml-2"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Download Backup (.JSON)
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={isSaving}
            className="text-xs text-slate-400 hover:text-slate-200 underline font-mono transition-colors"
          >
            Reset to Default
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md font-semibold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
