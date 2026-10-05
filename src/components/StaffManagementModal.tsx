import React, { useState, useEffect } from "react";
import { StaffUser, SaleReceipt } from "../types.ts";
import { formatNpr } from "../utils/currency.ts";
import {
  Users,
  Link,
  Copy,
  Check,
  Plus,
  Shield,
  KeyRound,
  Mail,
  User,
  Trash2,
  RefreshCw,
  ExternalLink,
  X,
  AlertCircle,
  Receipt,
  Edit3,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";

interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenStaffPortal: () => void;
  onOpenLedgerReset?: () => void;
}

export function StaffManagementModal({
  isOpen,
  onClose,
  onOpenStaffPortal,
  onOpenLedgerReset,
}: StaffManagementModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<"link" | "users" | "all_sales">("link");
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [allSales, setAllSales] = useState<SaleReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Form to add staff member
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newRole, setNewRole] = useState<"staff" | "admin">("staff");
  const [formError, setFormError] = useState<string | null>(null);

  // Full Edit staff state
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editRole, setEditRole] = useState<"staff" | "admin">("staff");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Editing quick access code inline
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [updatedCode, setUpdatedCode] = useState("");

  // Email domain settings
  const [configuredDomain, setConfiguredDomain] = useState("gmail.com");
  const [isEditingDomain, setIsEditingDomain] = useState(false);
  const [newDomainInput, setNewDomainInput] = useState("gmail.com");

  const staffPortalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?portal=staff`
      : "/?portal=staff";

  const fetchStaffUsers = async () => {
    setIsLoading(true);
    try {
      const [resStaff, resConfig] = await Promise.all([
        fetch("/api/staff/users"),
        fetch("/api/staff/config").catch(() => null),
      ]);

      const json = await resStaff.json();
      if (json.staff) {
        setStaffUsers(json.staff);
      }

      if (resConfig) {
        const jsonConfig = await resConfig.json();
        if (jsonConfig?.companyDomain) {
          setConfiguredDomain(jsonConfig.companyDomain);
          setNewDomainInput(jsonConfig.companyDomain);
        }
      }
    } catch (err) {
      console.error("Failed to load staff accounts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDomain = async () => {
    try {
      const clean = newDomainInput.trim().toLowerCase().replace(/^@/, "");
      if (!clean) return;
      await fetch("/api/staff/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyDomain: clean }),
      });
      setConfiguredDomain(clean);
      setIsEditingDomain(false);
      fetchStaffUsers();
    } catch (err) {
      console.error("Failed to update domain:", err);
    }
  };

  const fetchAllSales = async () => {
    try {
      const res = await fetch("/api/sales");
      const json = await res.json();
      if (json.sales) {
        setAllSales(json.sales);
      }
    } catch (err) {
      console.error("Failed to load garage sales:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStaffUsers();
      fetchAllSales();
    }
  }, [isOpen]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(staffPortalUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newName || !newUsername || !newEmail || !newCode) {
      setFormError("All fields are required.");
      return;
    }

    try {
      const res = await fetch("/api/staff/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          username: newUsername,
          company_email: newEmail,
          access_code: newCode,
          role: newRole,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create staff member.");
      }

      setActionSuccessMessage(`Staff member ${newName} added successfully.`);
      setTimeout(() => setActionSuccessMessage(null), 3500);

      // Reset form
      setNewName("");
      setNewUsername("");
      setNewEmail("");
      setNewCode("");
      setNewRole("staff");
      setIsAdding(false);
      fetchStaffUsers();
    } catch (err: any) {
      setFormError(err.message || "Failed to add staff member.");
    }
  };

  const handleStartEdit = (user: StaffUser) => {
    setEditingStaff(user);
    setEditName(user.name);
    setEditUsername(user.username);
    setEditEmail(user.company_email);
    setEditCode(user.access_code);
    setEditRole(user.role || "staff");
    setEditStatus(user.status || "active");
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setEditError(null);

    if (!editName.trim() || !editUsername.trim() || !editEmail.trim() || !editCode.trim()) {
      setEditError("All fields are required.");
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/staff/users/${editingStaff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          username: editUsername.trim().toLowerCase(),
          company_email: editEmail.trim().toLowerCase(),
          access_code: editCode.trim(),
          role: editRole,
          status: editStatus,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update staff member.");
      }

      setActionSuccessMessage(`Staff member ${editName} updated successfully.`);
      setTimeout(() => setActionSuccessMessage(null), 3500);
      setEditingStaff(null);
      fetchStaffUsers();
    } catch (err: any) {
      setEditError(err.message || "Failed to update staff member.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleUpdateCode = async (id: string) => {
    if (!updatedCode.trim()) return;
    try {
      await fetch(`/api/staff/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_code: updatedCode.trim() }),
      });
      setEditingUserId(null);
      setUpdatedCode("");
      setActionSuccessMessage("Access code updated.");
      setTimeout(() => setActionSuccessMessage(null), 3000);
      fetchStaffUsers();
    } catch (err) {
      console.error("Failed to update access code:", err);
    }
  };

  const handleToggleStatus = async (user: StaffUser) => {
    const nextStatus = user.status === "active" ? "inactive" : "active";
    try {
      await fetch(`/api/staff/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      setActionSuccessMessage(`Staff account ${nextStatus === "active" ? "activated" : "deactivated"}.`);
      setTimeout(() => setActionSuccessMessage(null), 3000);
      fetchStaffUsers();
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete staff account for "${name}"? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/staff/users/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok) {
        setActionSuccessMessage(json.message || `Staff member ${name} deleted.`);
        setTimeout(() => setActionSuccessMessage(null), 3500);
        fetchStaffUsers();
      } else {
        alert(json.error || "Failed to delete staff member.");
      }
    } catch (err) {
      console.error("Failed to delete staff member:", err);
    }
  };

  const handleDeleteSale = async (id: string, receiptNum: string) => {
    if (!confirm(`Are you sure you want to delete sale receipt #${receiptNum}? This will remove it from the sales ledger.`)) return;
    try {
      const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
      if (res.ok) {
        setActionSuccessMessage(`Sale #${receiptNum} removed from ledger.`);
        setTimeout(() => setActionSuccessMessage(null), 3000);
        fetchAllSales();
      }
    } catch (err) {
      console.error("Failed to delete sale:", err);
    }
  };

  if (!isOpen) return null;

  const totalSalesRevenue = allSales.reduce(
    (acc, s) => acc + (Number(s.total_amount) || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-mono flex items-center space-x-2">
                <span>Staff Access &amp; Counter Portal</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Role-Based Security
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Branch out a restricted link for counter mechanics to log sell receipts and check stock.
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

        {/* Sub-tab Navigation */}
        <div className="flex items-center px-6 pt-3 border-b border-slate-800 space-x-4 bg-slate-950/50 text-xs font-mono">
          <button
            onClick={() => setActiveSubTab("link")}
            className={`pb-2.5 font-bold transition-colors border-b-2 flex items-center space-x-1.5 ${
              activeSubTab === "link"
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>Staff Portal Link</span>
          </button>

          <button
            onClick={() => setActiveSubTab("users")}
            className={`pb-2.5 font-bold transition-colors border-b-2 flex items-center space-x-1.5 ${
              activeSubTab === "users"
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staff Accounts &amp; Codes ({staffUsers.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab("all_sales")}
            className={`pb-2.5 font-bold transition-colors border-b-2 flex items-center space-x-1.5 ${
              activeSubTab === "all_sales"
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Customer Sales Ledger ({allSales.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: BRANCH OUT LINK */}
          {activeSubTab === "link" && (
            <div className="space-y-5">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2">
                      <Link className="w-4 h-4 text-amber-400" />
                      <span>Dedicated Staff Link</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Give this link to your shop counter staff and technicians. They can open it directly on phones, tablets, or counter laptops.
                    </p>
                  </div>
                </div>

                {/* Link Box & Copy Button */}
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={staffPortalUrl}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-amber-300 select-all focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center space-x-1.5 shrink-0 transition-colors shadow-sm"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Staff Link</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      onOpenStaffPortal();
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center space-x-1 shrink-0"
                    title="Open Staff Terminal view"
                  >
                    <span>Test Staff View</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Security & Access Boundaries Card */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-3">
                <h4 className="text-xs font-bold text-slate-200 uppercase font-mono tracking-wider flex items-center">
                  <Shield className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  Enforced Security &amp; Permissions Matrix
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-emerald-900/30">
                    <span className="font-bold text-emerald-400 font-mono flex items-center mb-1">
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Allowed Staff Capabilities:
                    </span>
                    <ul className="text-slate-300 space-y-1 text-[11px] list-disc pl-4">
                      <li>Log customer sell receipts with custom customer/bike info</li>
                      <li>Browse inventory stock levels &amp; bin shelf locations</li>
                      <li>Automatic live inventory decrement on checkout</li>
                      <li>Print / view customer sale receipts &amp; audit own sales</li>
                    </ul>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-lg border border-rose-900/30">
                    <span className="font-bold text-rose-400 font-mono flex items-center mb-1">
                      <X className="w-3.5 h-3.5 mr-1" />
                      Restricted (Owner Only):
                    </span>
                    <ul className="text-slate-400 space-y-1 text-[11px] list-disc pl-4">
                      <li>Wholesale purchase costs and profit markup margins (hidden)</li>
                      <li>Supplier receipt scans and OCR intake approval</li>
                      <li>Google Drive archive folder settings &amp; cloud tokens</li>
                      <li>Database backup export, part deletion, or system configs</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STAFF USERS & CODES */}
          {activeSubTab === "users" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">
                    Authorized Staff Accounts
                  </h3>
                  <p className="text-xs text-slate-400">
                    Staff must use their registered Gmail address (or company email), username, and PIN to log in.
                  </p>
                </div>

                <button
                  onClick={() => setIsAdding(!isAdding)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center space-x-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Staff Member</span>
                </button>
              </div>

              {/* Email Domain Configuration Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-slate-400">Staff Email Domain: </span>
                    <strong className="text-white font-mono">@{configuredDomain}</strong>
                    {configuredDomain === "gmail.com" && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Gmail Accounts Active
                      </span>
                    )}
                  </div>
                </div>

                {isEditingDomain ? (
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-500 font-mono text-xs">@</span>
                    <input
                      type="text"
                      value={newDomainInput}
                      onChange={(e) => setNewDomainInput(e.target.value)}
                      placeholder="gmail.com"
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono w-32 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={handleSaveDomain}
                      className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingDomain(false)}
                      className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingDomain(true)}
                    className="text-[11px] text-sky-400 hover:text-sky-300 underline font-mono"
                  >
                    Change Domain
                  </button>
                )}
              </div>

              {/* Add New Staff Form */}
              {isAdding && (
                <form
                  onSubmit={handleCreateStaff}
                  className="bg-slate-950 border border-amber-500/40 rounded-xl p-4 space-y-3"
                >
                  <h4 className="text-xs font-bold text-amber-400 font-mono uppercase tracking-wider">
                    New Staff Registration
                  </h4>

                  {formError && (
                    <div className="bg-rose-950/80 border border-rose-800 text-rose-200 text-xs p-2.5 rounded flex items-center space-x-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Liam Vance"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Username *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. liam.v"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Staff Email (Gmail or custom) *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. mechanic.ramesh@gmail.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Access Code / PIN *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 5821"
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono tracking-wider"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Role
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as "staff" | "admin")}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                      >
                        <option value="staff">Staff / Counter</option>
                        <option value="admin">Supervisor / Admin</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="px-3 py-1 rounded bg-slate-800 text-slate-300 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs"
                    >
                      Save Account
                    </button>
                  </div>
                </form>
              )}

              {/* Staff Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Staff Member</th>
                      <th className="py-2.5 px-3">Username</th>
                      <th className="py-2.5 px-3">Staff Email (Gmail)</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Access Code</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {staffUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-900/50">
                        <td className="py-2.5 px-3 font-semibold text-slate-200">
                          {user.name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">
                          {user.username}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">
                          {user.company_email}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                            user.role === "admin"
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : "bg-slate-800 text-slate-400"
                          }`}>
                            {user.role || "staff"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {editingUserId === user.id ? (
                            <div className="flex items-center space-x-1">
                              <input
                                type="text"
                                value={updatedCode}
                                onChange={(e) => setUpdatedCode(e.target.value)}
                                className="w-16 bg-slate-900 border border-amber-500 rounded px-1.5 py-0.5 text-xs text-white"
                              />
                              <button
                                onClick={() => handleUpdateCode(user.id)}
                                className="p-1 rounded bg-amber-500 text-slate-950 hover:bg-amber-400"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
                                className="p-1 text-slate-400 hover:text-white"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-400 tracking-wider">
                              {user.access_code}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              user.status === "active"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-800 text-slate-500 border border-slate-700"
                            }`}
                          >
                            {user.status === "active" ? "Active" : "Disabled"}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(user)}
                            title={`Edit staff details for ${user.name}`}
                            className="inline-flex items-center px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-[11px] font-mono font-medium transition-colors"
                          >
                            <Edit3 className="w-3 h-3 mr-1" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(user.id, user.name)}
                            title={`Delete staff account for ${user.name}`}
                            className="inline-flex items-center p-1 rounded bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 text-[11px] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMER SALES LEDGER */}
          {activeSubTab === "all_sales" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">
                    Garage Customer Sales Ledger
                  </h3>
                  <p className="text-xs text-slate-400">
                    All customer sell receipts logged by counter staff members.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
                    <span className="text-slate-400 mr-2">Total Sales:</span>
                    <span className="text-emerald-400 font-bold">{formatNpr(totalSalesRevenue)}</span>
                  </div>

                  {onOpenLedgerReset && (
                    <button
                      type="button"
                      onClick={onOpenLedgerReset}
                      className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-mono font-semibold transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1 text-rose-400" />
                      <span>Reset Ledger</span>
                    </button>
                  )}
                </div>
              </div>

              {allSales.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 font-mono border border-dashed border-slate-800 rounded-xl">
                  No sales receipts logged yet. Share the staff link with your counter crew to begin selling.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Invoice / Receipt #</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Bike / Model</th>
                        <th className="py-2.5 px-3">Staff Seller</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {allSales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-slate-900/50">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                            {sale.receipt_number}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">
                            {new Date(sale.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-200">
                            {sale.customer_name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {sale.motorcycle_model || "—"}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">
                            {sale.staff_name}
                            <span className="text-[10px] text-slate-500 block">
                              {sale.staff_email}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                            {formatNpr(sale.total_amount)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteSale(sale.id, sale.receipt_number)}
                              title={`Delete sale #${sale.receipt_number}`}
                              className="p-1 rounded bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Edit Staff Modal Overlay */}
        {editingStaff && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 shadow-2xl text-slate-100 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono">Edit Staff Member</h3>
                    <p className="text-[11px] text-slate-400">Update name, email, credentials or role</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editError && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Staff Email (Gmail or custom) *</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">Access PIN *</label>
                    <input
                      type="text"
                      required
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono tracking-wider"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">Role</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as "staff" | "admin")}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Account Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as "active" | "inactive")}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                  >
                    <option value="active">Active (Access Allowed)</option>
                    <option value="inactive">Disabled (Access Blocked)</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingStaff(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-mono text-xs hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center space-x-1"
                  >
                    {isSavingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-500">
          <span>MotoFix Role Guard • Active Staff: {staffUsers.filter((u) => u.status === "active").length}</span>
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
