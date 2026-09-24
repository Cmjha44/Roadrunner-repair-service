import React, { useState, useEffect } from "react";
import { StaffSession, StaffInventoryItem, SaleReceipt } from "../types.ts";
import { StaffSellReceipt } from "./StaffSellReceipt.tsx";
import { StaffInventoryList } from "./StaffInventoryList.tsx";
import { StaffSalesHistory } from "./StaffSalesHistory.tsx";
import {
  Wrench,
  Lock,
  Mail,
  User,
  KeyRound,
  ShieldAlert,
  LogOut,
  Receipt,
  Package,
  History,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ArrowRight,
} from "lucide-react";

interface StaffPortalProps {
  onExitStaffPortal: () => void;
}

const STORAGE_KEY = "motofix_staff_session";

export function StaffPortal({ onExitStaffPortal }: StaffPortalProps) {
  // Session
  const [session, setSession] = useState<StaffSession | null>(null);
  const [activeTab, setActiveTab] = useState<"sell" | "inventory" | "history">("sell");

  // Login Form State
  const [companyEmail, setCompanyEmail] = useState("");
  const [username, setUsername] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [companyDomain, setCompanyDomain] = useState("motofixgarage.com");

  // Preselected inventory item to transfer to sell receipt
  const [preselectedItem, setPreselectedItem] = useState<StaffInventoryItem | null>(null);
  const [salesRefreshCount, setSalesRefreshCount] = useState(0);

  // Load existing session & config on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.id && parsed?.username) {
          setSession(parsed);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    // Fetch company email domain
    fetch("/api/staff/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.companyDomain) {
          setCompanyDomain(data.companyDomain);
        }
      })
      .catch((err) => console.error("Could not fetch staff config:", err));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_email: companyEmail.trim(),
          username: username.trim(),
          access_code: accessCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Login failed. Please verify credentials.");
      }

      setSession(data.staff);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.staff));
    } catch (err: any) {
      setLoginError(err.message || "Authentication error.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setCompanyEmail("");
    setUsername("");
    setAccessCode("");
    setLoginError(null);
  };

  const handleQuickFill = (u: string, email: string, code: string) => {
    setUsername(u);
    setCompanyEmail(email);
    setAccessCode(code);
    setLoginError(null);
  };

  const handleSelectItemForSale = (item: StaffInventoryItem) => {
    setPreselectedItem(item);
    setActiveTab("sell");
  };

  const handleSaleCompleted = (_sale: SaleReceipt) => {
    setSalesRefreshCount((prev) => prev + 1);
  };

  // If not logged in, show Staff Access Gate
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-2">
              <Wrench className="w-8 h-8" />
            </div>
            <div className="flex items-center justify-center space-x-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                Staff Portal
              </span>
              <span className="text-slate-500 text-xs font-mono">• Restricted Access</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white font-mono">
              MOTOFIX GARAGE TERMINAL
            </h1>
            <p className="text-xs text-slate-400">
              Welcome to the staff counter portal. Before starting, you must verify your identity with your official company email and staff passcode.
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            {loginError && (
              <div className="mb-4 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs p-3 rounded-lg flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Step 1: Company Email */}
              <div>
                <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>1. Company Email *</span>
                  <span className="text-[10px] text-amber-400 font-mono">@{companyDomain}</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder={`e.g. alex.tech@${companyDomain}`}
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Must be your verified garage company email address.
                </p>
              </div>

              {/* Step 2: Username */}
              <div>
                <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5">
                  2. Staff Username *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. alex.tech or sam.counter"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Step 3: Access Code / PIN */}
              <div>
                <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5">
                  3. Security Access Code / PIN *
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="password"
                    required
                    placeholder="e.g. 4829"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono tracking-widest"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors shadow-md mt-2"
              >
                {isLoggingIn ? (
                  <span>Verifying Company Credentials...</span>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Authenticate &amp; Start Session</span>
                  </>
                )}
              </button>
            </form>

            {/* Demo / Quick Test Credential Chips */}
            <div className="mt-5 pt-4 border-t border-slate-800/80">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center">
                <HelpCircle className="w-3.5 h-3.5 mr-1 text-slate-500" />
                Quick Test Accounts (Pre-configured):
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() =>
                    handleQuickFill("alex.tech", "alex.tech@motofixgarage.com", "4829")
                  }
                  className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-left transition-colors"
                >
                  <p className="font-semibold text-slate-200">Alex Rivera (Tech)</p>
                  <p className="text-slate-500 font-mono text-[10px]">alex.tech • Code: 4829</p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleQuickFill("sam.counter", "sam.counter@motofixgarage.com", "1234")
                  }
                  className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-left transition-colors"
                >
                  <p className="font-semibold text-slate-200">Sam Miller (Counter)</p>
                  <p className="text-slate-500 font-mono text-[10px]">sam.counter • Code: 1234</p>
                </button>
              </div>
            </div>
          </div>

          {/* Switch back to Main Owner App */}
          <div className="text-center">
            <button
              onClick={onExitStaffPortal}
              className="text-xs font-mono text-slate-500 hover:text-slate-300 underline inline-flex items-center"
            >
              <span>Return to Garage Owner / Admin Management</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Staff View
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Staff Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand & Staff Tag */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500 text-slate-950 font-black shadow-sm">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-black tracking-tight text-white font-mono">
                    MOTOFIX GARAGE
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    STAFF TERMINAL
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Restricted: Sales Receipts &amp; Inventory Availability
                </p>
              </div>
            </div>

            {/* Center: Tabs */}
            <div className="hidden md:flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab("sell")}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                  activeTab === "sell"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Log Sell Receipt</span>
              </button>

              <button
                onClick={() => setActiveTab("inventory")}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                  activeTab === "inventory"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Inventory Catalog</span>
              </button>

              <button
                onClick={() => setActiveTab("history")}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                  activeTab === "history"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>My Sales Log</span>
              </button>
            </div>

            {/* Right: Staff Identity & Logout */}
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-white flex items-center justify-end space-x-1">
                  <span>{session.name}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-[10px] text-slate-400 font-mono">{session.company_email}</div>
              </div>

              <button
                onClick={handleLogout}
                title="Log Out Staff Session"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>

              <button
                onClick={onExitStaffPortal}
                title="Return to Owner Admin Portal"
                className="hidden lg:inline-flex items-center px-2.5 py-1.5 rounded-lg border border-slate-700 text-[11px] font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <span>Owner Mode</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="md:hidden border-t border-slate-800 px-4 py-2 flex items-center justify-between space-x-2 bg-slate-950">
          <button
            onClick={() => setActiveTab("sell")}
            className={`flex-1 py-1.5 text-center text-xs font-mono rounded ${
              activeTab === "sell" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400"
            }`}
          >
            Sell Receipt
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`flex-1 py-1.5 text-center text-xs font-mono rounded ${
              activeTab === "inventory" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400"
            }`}
          >
            Inventory
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-1.5 text-center text-xs font-mono rounded ${
              activeTab === "history" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400"
            }`}
          >
            Sales Log
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === "sell" && (
          <StaffSellReceipt
            staffSession={session}
            preselectedItem={preselectedItem}
            onClearPreselectedItem={() => setPreselectedItem(null)}
            onSaleCompleted={handleSaleCompleted}
          />
        )}

        {activeTab === "inventory" && (
          <StaffInventoryList onSelectItemForSale={handleSelectItemForSale} />
        )}

        {activeTab === "history" && (
          <StaffSalesHistory staffSession={session} refreshTrigger={salesRefreshCount} />
        )}
      </main>

      {/* Restricted Security Notice Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-3 text-center text-[11px] text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            MotoFix Staff Terminal • Session: {session.username} ({session.company_email})
          </span>
          <span className="text-slate-600">
            Permissions: Log Sell Receipts &amp; View Catalog (Owner settings &amp; costs protected)
          </span>
          <button
            onClick={onExitStaffPortal}
            className="text-amber-500/80 hover:text-amber-400 underline"
          >
            Switch to Owner Mode
          </button>
        </div>
      </footer>
    </div>
  );
}
