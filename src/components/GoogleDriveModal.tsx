import React, { useState, useEffect } from "react";
import {
  Cloud,
  Folder,
  Key,
  CheckCircle2,
  AlertCircle,
  Download,
  X,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  HardDrive,
} from "lucide-react";
import { DriveConfigStatus } from "../types.ts";

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: DriveConfigStatus | null;
  onStatusUpdated: () => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  status,
  onStatusUpdated,
}) => {
  const [folderId, setFolderId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (status?.folderId) {
      setFolderId(status.folderId);
    }
  }, [status]);

  if (!isOpen) return null;

  const handleSaveFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/drive/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folderId.trim() }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        onStatusUpdated();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save Drive folder:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const downloadFullBackup = () => {
    window.location.href = "/api/backup/export";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-5 shadow-2xl space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono">
                Google Drive &amp; Local Backup Hub
              </h3>
              <p className="text-xs text-slate-400">
                Receipt archival storage and local SQLite database backups
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sync Status Box */}
        <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono text-slate-400 uppercase">Archival Engine</span>
            <span className="inline-flex items-center text-emerald-400 font-bold font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Active (Dual Local + Drive Archival)
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-900">
            <span className="font-mono text-slate-400 uppercase">Archived Receipts</span>
            <span className="font-bold text-white font-mono">
              {status?.archivedCount ?? 0} documents archived
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-900">
            <span className="font-mono text-slate-400 uppercase">Direct Links Generated</span>
            <span className="text-sky-400 font-mono">
              drive.google.com/file/d/...
            </span>
          </div>
        </div>

        {/* Designated Folder ID Configuration */}
        <form onSubmit={handleSaveFolder} className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1 flex items-center">
              <Folder className="w-3.5 h-3.5 mr-1 text-amber-400" />
              Designated Google Drive Folder ID
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                placeholder="e.g. 1A2b3C4d5E_GarageReceipts2026 or 'root'"
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 font-mono focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-md transition-colors"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Receipt photos uploaded upon verification are archived into this Google Drive folder
              with full file ID and web link stored in local SQLite.
            </p>
          </div>

          {saveSuccess && (
            <div className="p-2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Drive folder configuration updated successfully!</span>
            </div>
          )}
        </form>

        {/* Offline & Local First SQLite Export */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white font-mono flex items-center">
                <HardDrive className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                Download Local SQLite Snapshot
              </p>
              <p className="text-[11px] text-slate-400">
                Export all parts inventory, expense ledger, and stock movements to JSON
              </p>
            </div>
            <button
              onClick={downloadFullBackup}
              type="button"
              className="inline-flex items-center px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-md border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Export Backup (.JSON)
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-semibold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
