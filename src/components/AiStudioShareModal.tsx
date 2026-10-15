import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  ExternalLink,
  Copy,
  Check,
  X,
  Mail,
  ShieldAlert,
  Sparkles,
  Layers,
  ArrowRight,
  Globe,
  QrCode,
  Smartphone,
  UserPlus,
  Download,
  Laptop,
  CheckCircle2,
  Info,
  Key,
} from "lucide-react";

interface AiStudioShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  appletId?: string;
  defaultEmail?: string;
}

export const AiStudioShareModal: React.FC<AiStudioShareModalProps> = ({
  isOpen,
  onClose,
  appletId = "f87bdbe3-6ea8-4d5e-8f60-cc03aff019f9",
  defaultEmail = "",
}) => {
  const [targetEmail, setTargetEmail] = useState(defaultEmail);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"launcher" | "slots" | "qr" | "guide">("launcher");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const baseAiStudioUrl = `https://aistudio.google.com/applet/${appletId}`;
  const trimmedEmail = targetEmail.trim();

  // URL targeting specific account via Google Account Chooser
  const accountChooserUrl = trimmedEmail
    ? `https://accounts.google.com/AccountChooser?Email=${encodeURIComponent(
        trimmedEmail
      )}&continue=${encodeURIComponent(
        `https://aistudio.google.com/applet/${appletId}?authuser=${encodeURIComponent(
          trimmedEmail
        )}`
      )}`
    : `https://aistudio.google.com/applet/${appletId}`;

  // URL to force "Sign In with Another Account" then direct to AI Studio
  const addSessionUrl = `https://accounts.google.com/AddSession?hl=en&continue=${encodeURIComponent(
    `https://aistudio.google.com/applet/${appletId}`
  )}`;

  // Direct authuser parameter URL
  const directAuthUserUrl = trimmedEmail
    ? `https://aistudio.google.com/applet/${appletId}?authuser=${encodeURIComponent(
        trimmedEmail
      )}`
    : baseAiStudioUrl;

  const sharedWebAppUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://ais-pre-ytshyyxvltb6fied3tjhbn-484219823835.us-west2.run.app";

  // Generate QR code whenever the target URL updates
  useEffect(() => {
    const urlToEncode = trimmedEmail ? accountChooserUrl : baseAiStudioUrl;
    QRCode.toDataURL(urlToEncode, {
      width: 280,
      margin: 2,
      color: {
        dark: "#0f172a", // Dark slate dots
        light: "#ffffff",
      },
    })
      .then((dataUri) => setQrDataUrl(dataUri))
      .catch((err) => console.warn("Failed to generate QR code for AI Studio:", err));
  }, [trimmedEmail, accountChooserUrl, baseAiStudioUrl]);

  if (!isOpen) return null;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `AI_Studio_Launcher_${trimmedEmail ? trimmedEmail.replace(/[^a-zA-Z0-9]/g, "_") : "Applet"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[94vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden my-auto animate-fade-in">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-400/30 text-sky-400 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-sky-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-mono">
                  Open in Google AI Studio
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  Switch Gmail ID
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Launch, switch, or share this applet workspace in Google AI Studio with any Google account.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-xs font-mono overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("launcher")}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "launcher"
                ? "bg-sky-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>1-Click Gmail Switcher</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("slots")}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "slots"
                ? "bg-sky-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Account Profile Slots (/u/0, /u/1)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("qr")}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "qr"
                ? "bg-sky-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Mobile Phone QR Scan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("guide")}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "guide"
                ? "bg-sky-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Permissions &amp; Troubleshooting</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* TAB 1: 1-Click Email Switcher */}
          {activeTab === "launcher" && (
            <div className="space-y-4">
              {/* Email Account Targeter */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
                <div>
                  <label className="block text-slate-200 font-bold font-mono text-xs sm:text-sm flex items-center space-x-2">
                    <Mail className="w-4 h-4 text-amber-400" />
                    <span>Enter Your Other Google Email Address:</span>
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Type the exact Gmail or Google Workspace address you want to open Google AI Studio with.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="email"
                      placeholder="e.g. chandra.jha44@gmail.com or other.account@gmail.com"
                      value={targetEmail}
                      onChange={(e) => setTargetEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs sm:text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                    />
                    {trimmedEmail && (
                      <button
                        type="button"
                        onClick={() => setTargetEmail("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <a
                    href={accountChooserUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 font-black font-mono text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg hover:shadow-sky-500/25 transition-all transform active:scale-98 shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-slate-950" />
                    <span>Launch in AI Studio</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-950" />
                  </a>
                </div>

                {/* Generated Link Display & Copy Actions */}
                <div className="space-y-2 pt-1">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 overflow-hidden">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase font-mono font-bold text-slate-500 block mb-0.5">
                        Generated Google Account Chooser URL:
                      </span>
                      <span className="font-mono text-[11px] text-sky-300 break-all select-all block">
                        {accountChooserUrl}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(accountChooserUrl, "customEmail")}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        {copiedType === "customEmail" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-bold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-sky-400" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>

                      <a
                        href={accountChooserUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 font-mono text-xs flex items-center space-x-1 transition-colors"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    💡 <strong>How this works:</strong> This URL leverages Google's native{" "}
                    <code className="text-sky-300 font-mono">AccountChooser</code> routing. It commands Google to switch the authenticated session directly to{" "}
                    <strong className="text-amber-300">{trimmedEmail || "your chosen email"}</strong> and immediately open this applet.
                  </p>
                </div>
              </div>

              {/* Alternative 1-Click Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Add Session Card */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1.5 text-amber-400">
                      <UserPlus className="w-4 h-4" />
                      <h4 className="font-bold font-mono text-xs text-white">
                        Sign In as New Google Account
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Opens Google's "Sign in to another account" flow and automatically routes into this applet upon login completion.
                    </p>
                  </div>

                  <a
                    href={addSessionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <span>Sign In Another Account &amp; Open</span>
                    <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  </a>
                </div>

                {/* Incognito Card */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1.5 text-sky-400">
                      <Laptop className="w-4 h-4" />
                      <h4 className="font-bold font-mono text-xs text-white">
                        Open in Incognito / Private Window
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Copy the clean applet URL and paste into an Incognito window (<kbd className="px-1 py-0.5 rounded bg-slate-800 font-mono text-[10px]">Ctrl+Shift+N</kbd> / <kbd className="px-1 py-0.5 rounded bg-slate-800 font-mono text-[10px]">Cmd+Shift+N</kbd>).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(baseAiStudioUrl, "incognito")}
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    {copiedType === "incognito" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copied URL for Incognito!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-sky-400" />
                        <span>Copy Applet URL for Incognito</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Multi-Account Profile Slots */}
          {activeTab === "slots" && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center space-x-2 text-sky-400 font-bold font-mono">
                  <Layers className="w-4 h-4" />
                  <span>Google Multi-Account Index Profile Links</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  When you are signed into multiple Google accounts in the same Chrome or browser window, Google indexes each session as <code className="text-sky-300 font-mono">/u/0/</code>, <code className="text-sky-300 font-mono">/u/1/</code>, <code className="text-sky-300 font-mono">/u/2/</code>, and <code className="text-sky-300 font-mono">/u/3/</code>. Click below to test opening with each account index directly:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {[
                    {
                      slot: 0,
                      title: "Account 1 (/u/0/)",
                      desc: "Default primary Google account (first signed-in)",
                      color: "text-amber-400",
                    },
                    {
                      slot: 1,
                      title: "Account 2 (/u/1/)",
                      desc: "Second Google account signed in this browser",
                      color: "text-sky-400",
                    },
                    {
                      slot: 2,
                      title: "Account 3 (/u/2/)",
                      desc: "Third Google account signed in this browser",
                      color: "text-emerald-400",
                    },
                    {
                      slot: 3,
                      title: "Account 4 (/u/3/)",
                      desc: "Fourth Google account signed in this browser",
                      color: "text-purple-400",
                    },
                  ].map(({ slot, title, desc, color }) => {
                    const slotUrl = `https://aistudio.google.com/u/${slot}/applet/${appletId}`;
                    return (
                      <div
                        key={slot}
                        className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-2 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className={`font-mono font-bold text-xs ${color}`}>{title}</span>
                            <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                            u/{slot}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2 pt-1 border-t border-slate-800/80">
                          <a
                            href={slotUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-1.5 px-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 font-mono text-[11px] font-bold flex items-center justify-center space-x-1 transition-colors"
                          >
                            <span>Open as /u/{slot}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleCopy(slotUrl, `slot-${slot}`)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                            title="Copy link"
                          >
                            {copiedType === `slot-${slot}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Mobile Phone / Tablet QR Code */}
          {activeTab === "qr" && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-center space-y-4">
                <div className="max-w-md mx-auto space-y-1">
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-1">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Instant Camera Scan for Phone or Tablet</span>
                  </div>
                  <h4 className="font-bold text-white text-sm sm:text-base font-mono">
                    Scan with Your Mobile Device
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    If your other Gmail account is logged into your phone or tablet, scan this QR code with your camera to open the applet directly in AI Studio on that device:
                  </p>
                </div>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="p-3 bg-white rounded-2xl shadow-xl border-4 border-slate-800 inline-block">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="AI Studio QR Code"
                        className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                      />
                    ) : (
                      <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-slate-400 font-mono text-xs">
                        Generating QR Code...
                      </div>
                    )}
                  </div>

                  {trimmedEmail && (
                    <div className="text-[11px] font-mono text-amber-300 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20">
                      Targeted for: <strong>{trimmedEmail}</strong>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-400" />
                      <span>Download QR Image</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy(accountChooserUrl, "qrLink")}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      {copiedType === "qrLink" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Scanned URL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Permissions & Troubleshooting */}
          {activeTab === "guide" && (
            <div className="space-y-4">
              {/* Fix for "Available regions / Age requirements" warning */}
              <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center space-x-2 text-amber-400 font-bold font-mono text-xs sm:text-sm">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Important: Google AI Studio Access Rules for New Accounts</span>
                </div>
                <div className="text-[11px] text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    When opening Google AI Studio (<code className="text-amber-300 font-mono">aistudio.google.com</code>) with a second Gmail account, Google enforces the following:
                  </p>
                  <ol className="list-decimal pl-5 space-y-2 text-slate-300">
                    <li>
                      <strong>Account Age (18+ Requirement):</strong> Google AI Studio requires the account birthday to be verified 18+. Check the account birthday at{" "}
                      <a
                        href="https://myaccount.google.com/birthday"
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 underline font-bold"
                      >
                        myaccount.google.com/birthday
                      </a>{" "}
                      and verify the age.
                    </li>
                    <li>
                      <strong>Personal Gmail vs School / Workspace:</strong> School, university, and enterprise Google Workspace accounts frequently have Google AI Studio disabled by their domain administrator. If you see a policy restriction, use a personal <code className="text-amber-300 font-mono">@gmail.com</code> address.
                    </li>
                    <li>
                      <strong>Applet Sharing Permissions:</strong> If the other account sees <em>"Applet not found"</em> or <em>"Access Denied"</em>, in the original Google AI Studio window click the <strong>Share</strong> button (top right) and ensure the link permissions are set to viewable by collaborators or anyone with link.
                    </li>
                    <li>
                      <strong>Google Chrome Multiple Profiles (Recommended):</strong> To permanently prevent Google accounts from switching back and forth, create a dedicated Chrome Profile: click your profile avatar at the top right of Chrome $\rightarrow$ <strong>Add Profile</strong> $\rightarrow$ sign in with the other Gmail account.
                    </li>
                  </ol>
                </div>
              </div>

              {/* Standalone Web App Alternative */}
              <div className="bg-slate-950 border border-emerald-900/40 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-emerald-400 font-mono text-xs sm:text-sm">
                      Standalone Web App (Zero AI Studio Account Needed)
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(sharedWebAppUrl, "standalone")}
                    className="text-[11px] text-emerald-300 hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedType === "standalone" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Web App Link</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  If the other user (such as workshop counter staff, cashiers, or mechanics) simply needs to <strong>use the application</strong> to scan receipts and manage inventory, they do <strong>not</strong> need to visit Google AI Studio. Send them the deployed web app link:
                </p>
                <div className="p-2.5 rounded-lg bg-slate-900 font-mono text-[11px] text-amber-300 select-all border border-slate-800 break-all flex items-center justify-between">
                  <span>{sharedWebAppUrl}</span>
                  <a
                    href={sharedWebAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-slate-400 hover:text-white"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-slate-950 text-xs">
          <div className="flex items-center space-x-2 font-mono text-slate-400 text-[11px]">
            <span>Applet ID:</span>
            <code className="text-sky-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {appletId}
            </code>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleCopy(baseAiStudioUrl, "base")}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[11px] flex items-center space-x-1 cursor-pointer"
            >
              {copiedType === "base" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied Base Link</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Base AI Studio Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-mono font-bold text-[11px] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
