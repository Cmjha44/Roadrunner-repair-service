import React, { useState, useEffect } from "react";
import { StaffUser, SaleReceipt } from "../types.ts";
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
  DollarSign,
} from "lucide-react";

interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenStaffPortal: () => void;
}

export function StaffManagementModal({
  isOpen,
  onClose,
  onOpenStaffPortal,
}: StaffManagementModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<"link" | "users" | "all_sales">("link");
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [allSales, setAllSales] = useState<SaleReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Form to add staff member
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCode, setNewCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Editing access code
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [updatedCode, setUpdatedCode] = useState("");

  const staffPortalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?portal=staff`
      : "/?portal=staff";

  const fetchStaffUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/staff/users");
      const json = await res.json();
      if (json.staff) {
        setStaffUsers(json.staff);
      }
    } catch (err) {
      console.error("Failed to load staff accounts:", err);
    } finally {
      setIsLoading(false);
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
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create staff member.");
      }

      // Reset form
      setNewName("");
      setNewUsername("");
      setNewEmail("");
      setNewCode("");
      setIsAdding(false);
      fetchStaffUsers();
    } catch (err: any) {
      setFormError(err.message || "Failed to add staff member.");
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
      fetchStaffUsers();
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove staff member ${name}?`)) return;
    try {
      await fetch(`/api/staff/users/${id}`, { method: "DELETE" });
      fetchStaffUsers();
    } catch (err) {
      console.error("Failed to delete staff member:", err);
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
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">
                    Authorized Staff Accounts
                  </h3>
                  <p className="text-xs text-slate-400">
                    Staff must use their registered company email, username, and code to log in.
                  </p>
                </div>

                <button
                  onClick={() => setIsAdding(!isAdding)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Staff Member</span>
                </button>
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
                        Company Email *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="liam.v@motofixgarage.com"
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
                      <th className="py-2.5 px-3">Company Email</th>
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
                        <td className="py-2.5 px-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingUserId(user.id);
                              setUpdatedCode(user.access_code);
                            }}
                            className="text-slate-400 hover:text-amber-400 text-[11px] font-mono"
                          >
                            Edit Code
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(user.id, user.name)}
                            className="text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
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
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white font-mono">
                    Garage Customer Sales Ledger
                  </h3>
                  <p className="text-xs text-slate-400">
                    All customer sell receipts logged by counter staff members.
                  </p>
                </div>

                <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
                  <span className="text-slate-400 mr-2">Total Sales Revenue:</span>
                  <span className="text-emerald-400 font-bold">${totalSalesRevenue.toFixed(2)}</span>
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
                        <th className="py-2.5 px-3">Receipt #</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Bike / WO</th>
                        <th className="py-2.5 px-3">Staff Seller</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
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
                            ${Number(sale.total_amount).toFixed(2)}
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
