import React, { useState, useEffect } from "react";
import { InventoryItem, NotificationSettings } from "../types.ts";
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Mail,
  Send,
  Sliders,
  Check,
  X,
  ExternalLink,
  Copy,
  Plus,
  ArrowRight,
  RefreshCw,
  Package,
  MapPin,
  Sparkles,
} from "lucide-react";

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToInventory?: () => void;
  onStockUpdated?: () => void;
}

export function NotificationCenterModal({
  isOpen,
  onClose,
  onNavigateToInventory,
  onStockUpdated,
}: NotificationCenterModalProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    ownerEmail: "chandra.jha44@gmail.com",
    globalThreshold: null,
    emailAlertsEnabled: true,
  });

  // Threshold filter: default to part's reorder threshold, or custom number
  const [customThreshold, setCustomThreshold] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"alerts" | "email_preview" | "settings">("alerts");

  // Email dispatch state
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessResult, setSendSuccessResult] = useState<{
    subject: string;
    bodyText: string;
    mailtoUrl: string;
    emailSentTo: string;
    partsCount: number;
  } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Fetch low stock items using the existing /api/inventory?low_stock=true endpoint
  const fetchLowStockItems = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("low_stock", "true");
      if (customThreshold.trim() !== "") {
        params.append("threshold", customThreshold.trim());
      }

      const res = await fetch(`/api/inventory?${params.toString()}`);
      const json = await res.json();
      if (json.items) {
        setItems(json.items);
      }

      // Fetch notification settings
      const settingsRes = await fetch("/api/notifications/settings");
      const settingsJson = await settingsRes.json();
      if (settingsJson.ownerEmail) {
        setSettings(settingsJson);
      }
    } catch (err) {
      console.error("Failed to fetch low stock items:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLowStockItems();
      setSendSuccessResult(null);
    }
  }, [isOpen, customThreshold]);

  // Quick Restock from inside the notification center
  const handleQuickRestock = async (item: InventoryItem, amount: number) => {
    try {
      const res = await fetch(`/api/inventory/${item.id}/increment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          reason: `Restocked ${amount} units via Low-Stock Notification Center`,
        }),
      });
      if (res.ok) {
        fetchLowStockItems();
        if (onStockUpdated) onStockUpdated();
      }
    } catch (err) {
      console.error("Restock error:", err);
    }
  };

  // Dispatch Email Notification
  const handleSendEmailAlert = async () => {
    setIsSending(true);
    try {
      const res = await fetch("/api/notifications/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_email: settings.ownerEmail,
          threshold: customThreshold.trim() !== "" ? Number(customThreshold) : undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSendSuccessResult(json);
        setActiveTab("email_preview");
      }
    } catch (err) {
      console.error("Failed to send email alert:", err);
    } finally {
      setIsSending(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await fetch("/api/notifications/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setActiveTab("alerts");
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCopyEmailText = () => {
    if (!sendSuccessResult) return;
    navigator.clipboard.writeText(
      `Subject: ${sendSuccessResult.subject}\n\n${sendSuccessResult.bodyText}`
    );
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2500);
  };

  if (!isOpen) return null;

  const criticalItems = items.filter((i) => Number(i.stock_quantity) <= 0);
  const lowItems = items.filter((i) => Number(i.stock_quantity) > 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-mono">
                  Low-Stock Notification Center
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {items.length} Flagged
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated reorder advisory based on SQLite <code className="text-amber-300">/api/inventory?low_stock=true</code>.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center px-6 pt-3 border-b border-slate-800 space-x-4 bg-slate-950/50 text-xs font-mono">
          <button
            onClick={() => setActiveTab("alerts")}
            className={`pb-2.5 font-bold transition-colors border-b-2 flex items-center space-x-1.5 ${
              activeTab === "alerts"
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Active Alerts ({items.length})</span>
          </button>

          {sendSuccessResult && (
            <button
              onClick={() => setActiveTab("email_preview")}
              className={`pb-2.5 font-bold transition-colors border-b-2 flex items-center space-x-1.5 ${
                activeTab === "email_preview"
                  ? "border-amber-400 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email Dispatch Slip</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-2.5 font-bold transition-colors border-b-2 flex items-center space-x-1.5 ${
              activeTab === "settings"
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Owner Notification Settings</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: ACTIVE ALERTS */}
          {activeTab === "alerts" && (
            <div className="space-y-4">
              {/* Threshold Specification Bar */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-300 font-mono font-semibold">
                    Specified Alert Threshold:
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Auto (Part Reorder)"
                    value={customThreshold}
                    onChange={(e) => setCustomThreshold(e.target.value)}
                    className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                  {customThreshold && (
                    <button
                      onClick={() => setCustomThreshold("")}
                      className="text-slate-500 hover:text-slate-300 text-[11px] underline"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Email Dispatch Action Button */}
                <button
                  onClick={handleSendEmailAlert}
                  disabled={isSending || items.length === 0}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>
                    {isSending ? "Preparing Dispatch..." : `Email Owner (${items.length} parts)`}
                  </span>
                </button>
              </div>

              {/* Status Breakdown Pills */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-rose-950/40 border border-rose-900/50 rounded-lg p-2.5 flex items-center justify-between">
                  <span className="text-rose-300 flex items-center space-x-1.5">
                    <AlertOctagon className="w-4 h-4 text-rose-400" />
                    <span>Out of Stock (Critical):</span>
                  </span>
                  <span className="font-bold text-rose-400">{criticalItems.length} Parts</span>
                </div>

                <div className="bg-amber-950/40 border border-amber-900/50 rounded-lg p-2.5 flex items-center justify-between">
                  <span className="text-amber-300 flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Low Stock (Warning):</span>
                  </span>
                  <span className="font-bold text-amber-400">{lowItems.length} Parts</span>
                </div>
              </div>

              {/* Items List */}
              {isLoading ? (
                <div className="py-12 text-center text-slate-500 font-mono text-xs flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                  <span>Checking live inventory levels...</span>
                </div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-mono text-xs border border-dashed border-slate-800 rounded-xl space-y-1">
                  <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="font-bold text-white">All Spare Parts Well Stocked!</p>
                  <p className="text-slate-500 text-[11px]">
                    No inventory parts are currently below the specified threshold.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 bg-slate-950/40">
                  {items.map((item) => {
                    const isZero = Number(item.stock_quantity) <= 0;
                    return (
                      <div
                        key={item.id}
                        className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-900/50 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                isZero
                                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              }`}
                            >
                              {isZero ? "Out of Stock" : "Low Stock"}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {item.sku}
                            </span>
                            <span className="text-[11px] text-slate-500">• {item.category}</span>
                          </div>
                          <p className="font-bold text-sm text-white truncate max-w-sm">
                            {item.name}
                          </p>
                          <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono">
                            <span>
                              On Hand:{" "}
                              <strong className={isZero ? "text-rose-400" : "text-amber-400"}>
                                {item.stock_quantity}
                              </strong>{" "}
                              / Threshold: {item.reorder_threshold}
                            </span>
                            {item.location_bin && (
                              <span className="flex items-center space-x-1 text-slate-500">
                                <MapPin className="w-3 h-3 text-slate-600" />
                                <span>{item.location_bin}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick Restock Actions */}
                        <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                          <button
                            onClick={() => handleQuickRestock(item, 2)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold flex items-center space-x-1"
                            title="Restock 2 units"
                          >
                            <Plus className="w-3 h-3 text-emerald-400" />
                            <span>+2</span>
                          </button>
                          <button
                            onClick={() => handleQuickRestock(item, 4)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold flex items-center space-x-1"
                            title="Restock 4 units"
                          >
                            <Plus className="w-3 h-3 text-emerald-400" />
                            <span>+4</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EMAIL PREVIEW / DISPATCH SLIP */}
          {activeTab === "email_preview" && sendSuccessResult && (
            <div className="space-y-4">
              <div className="bg-emerald-950/60 border border-emerald-800/80 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-200 font-semibold">
                    Email notification advisory formatted for:{" "}
                    <strong className="text-white">{sendSuccessResult.emailSentTo}</strong>
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 font-bold">
                  {sendSuccessResult.partsCount} Items
                </span>
              </div>

              {/* Action Buttons: Copy Text & Open Mail Client */}
              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={handleCopyEmailText}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center space-x-1.5"
                >
                  {copyFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Email Text</span>
                    </>
                  )}
                </button>

                <a
                  href={sendSuccessResult.mailtoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center space-x-1.5 shadow-sm"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Launch in Mail App</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>

              {/* Email Content Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-2 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                <div className="text-amber-400 font-bold border-b border-slate-800 pb-2">
                  Subject: {sendSuccessResult.subject}
                </div>
                <div>{sendSuccessResult.bodyText}</div>
              </div>
            </div>
          )}

          {/* TAB 3: OWNER SETTINGS */}
          {activeTab === "settings" && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-amber-400 font-mono uppercase tracking-wider">
                  Owner Notification Destination
                </h4>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Shop Owner Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={settings.ownerEmail}
                      onChange={(e) =>
                        setSettings({ ...settings, ownerEmail: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    All low-stock warnings, reorder sheets, and daily digests will be addressed to this email.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      Enable Automated Dashboard Alert Badges
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Show persistent warnings when parts fall at or below reorder thresholds.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.emailAlertsEnabled}
                    onChange={(e) =>
                      setSettings({ ...settings, emailAlertsEnabled: e.target.checked })
                    }
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("alerts")}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-mono"
                >
                  Back to Alerts
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs"
                >
                  {savingSettings ? "Saving..." : "Save Preferences"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-500">
          <button
            onClick={() => {
              onClose();
              if (onNavigateToInventory) onNavigateToInventory();
            }}
            className="text-amber-400 hover:text-amber-300 underline flex items-center space-x-1"
          >
            <span>View &amp; Manage All Parts in Inventory Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-mono"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
