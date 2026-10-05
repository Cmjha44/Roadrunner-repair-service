import React, { useState } from "react";
import {
  ExternalLink,
  Copy,
  Check,
  X,
  Mail,
  ShieldAlert,
  Sparkles,
  Users,
  Layers,
  ArrowRight,
  Globe,
  Info,
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

  if (!isOpen) return null;

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

  const directAuthUserUrl = trimmedEmail
    ? `https://aistudio.google.com/applet/${appletId}?authuser=${encodeURIComponent(
        trimmedEmail
      )}`
    : baseAiStudioUrl;

  const sharedWebAppUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://ais-pre-ytshyyxvltb6fied3tjhbn-484219823835.us-west2.run.app";

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white font-mono flex items-center space-x-2">
                <span>Open in Google AI Studio</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Different Email
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Launch or share this applet workspace in Google AI Studio with another Google account.
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Email Account Targeter */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <label className="block text-slate-300 font-bold font-mono text-xs flex items-center space-x-1.5">
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              <span>Enter the Other Google Email Address:</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="e.g. your-other-email@gmail.com"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => handleCopy(accountChooserUrl, "customEmail")}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-mono font-semibold flex items-center justify-center space-x-1 shrink-0"
              >
                {copiedType === "customEmail" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Custom Link</span>
                  </>
                )}
              </button>
            </div>

            {/* Generated Link Display */}
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2 overflow-hidden">
              <span className="font-mono text-[11px] text-sky-300 truncate">
                {accountChooserUrl}
              </span>
              <a
                href={accountChooserUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold font-mono text-[11px] flex items-center space-x-1 shrink-0 transition-colors shadow-sm"
              >
                <span>Open in AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-slate-400">
              This link triggers the Google Account Chooser to authenticate directly with your specified email, bypassing the currently active Google account.
            </p>
          </div>

          {/* Quick Slot Switchers */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-slate-200 font-mono flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Multi-Account Profile Direct Links:</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              If you have multiple Google accounts logged into the same browser, you can jump between account profiles directly:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { slot: 0, label: "Account 1 (Default / u/0)" },
                { slot: 1, label: "Account 2 (Second / u/1)" },
                { slot: 2, label: "Account 3 (Third / u/2)" },
              ].map(({ slot, label }) => {
                const slotUrl = `https://aistudio.google.com/u/${slot}/applet/${appletId}`;
                return (
                  <a
                    key={slot}
                    href={slotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-500/50 flex flex-col justify-between transition-colors group"
                  >
                    <span className="text-[11px] font-bold text-slate-300 group-hover:text-sky-300 flex items-center justify-between">
                      <span>{label}</span>
                      <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-sky-400" />
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 truncate mt-1">
                      /u/{slot}/applet/...
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Standalone Web App Alternative */}
          <div className="bg-slate-950 border border-emerald-900/40 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-emerald-400 font-mono">
                  No AI Studio Account Needed for Regular Users:
                </span>
              </div>
              <button
                onClick={() => handleCopy(sharedWebAppUrl, "standalone")}
                className="text-[11px] text-emerald-300 hover:underline flex items-center space-x-1"
              >
                {copiedType === "standalone" ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Web App Link</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-300">
              If the other person only needs to <strong>use the application</strong> (such as mechanics or staff in Nepal), they do <strong>not</strong> need to visit Google AI Studio. Send them this standalone app link directly:
            </p>
            <div className="p-2 rounded bg-slate-900 font-mono text-[11px] text-amber-300 select-all border border-slate-800">
              {sharedWebAppUrl}
            </div>
          </div>

          {/* Fix for "Available regions / Age requirements" warning */}
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 space-y-2">
            <div className="flex items-center space-x-2 text-amber-400 font-bold font-mono">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Fixing "Available regions / Age requirements" Error in Google AI Studio:</span>
            </div>
            <div className="text-[11px] text-slate-300 space-y-1.5 leading-relaxed">
              <p>
                When a new email opens <code className="text-amber-300 font-mono">aistudio.google.com</code>, Google checks two strict rules:
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-slate-300">
                <li>
                  <strong>Account Age (18+):</strong> Google AI Studio requires accounts to be verified 18+. Check the account birthday at{" "}
                  <a
                    href="https://myaccount.google.com/birthday"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 underline"
                  >
                    myaccount.google.com/birthday
                  </a>{" "}
                  and verify the age.
                </li>
                <li>
                  <strong>Personal Gmail vs School/Company:</strong> School and company Google accounts often have AI Studio blocked by their IT admin. Use a personal <code className="text-amber-300 font-mono">@gmail.com</code> account.
                </li>
                <li>
                  <strong>Project Access:</strong> Ensure the second email has been added in Google Cloud Console IAM or shared as a collaborator if required.
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950 text-xs">
          <span className="font-mono text-slate-500">
            Applet ID: <code className="text-slate-400">{appletId}</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
