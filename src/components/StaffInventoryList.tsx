import React, { useState, useEffect } from "react";
import { StaffInventoryItem, GARAGE_CATEGORIES } from "../types.ts";
import { formatNpr } from "../utils/currency.ts";
import {
  Search,
  Package,
  AlertTriangle,
  CheckCircle2,
  Tag,
  MapPin,
  ShoppingCart,
  Filter,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Edit3,
  Trash2,
  X,
  Plus,
} from "lucide-react";

interface StaffInventoryListProps {
  onSelectItemForSale: (item: StaffInventoryItem) => void;
  isAdmin?: boolean;
}

export function StaffInventoryList({ onSelectItemForSale, isAdmin = false }: StaffInventoryListProps) {
  const [items, setItems] = useState<StaffInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Admin editorial states
  const [actionFeedback, setActionFeedback] = useState<{
    message: string;
    type: "success" | "warning";
  } | null>(null);
  const [editingItem, setEditingItem] = useState<StaffInventoryItem | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (selectedCategory !== "ALL") params.append("category", selectedCategory);
      if (onlyLowStock) params.append("low_stock", "true");

      const res = await fetch(`/api/staff/inventory?${params.toString()}`);
      const json = await res.json();
      if (json.items) {
        setItems(json.items);
      }
    } catch (err) {
      console.error("Failed to load staff inventory:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [search, selectedCategory, onlyLowStock]);

  // Admin: Quick Set Stock to 0
  const handleZeroOutStock = async (item: StaffInventoryItem) => {
    if (
      !confirm(
        `Are you sure you want to set the stock for "${item.name}" to 0? Current stock is ${item.stock_quantity}.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/inventory/${item.id}/set-zero`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, stock_quantity: 0 } : i))
        );
        setActionFeedback({
          message: `Stock for "${item.name}" set to 0.`,
          type: "warning",
        });
        setTimeout(() => setActionFeedback(null), 3500);
      } else {
        alert(json.error || "Failed to zero out stock.");
      }
    } catch (err: any) {
      console.error("Zero stock error:", err);
      alert(err.message || "Failed to zero out stock.");
    }
  };

  // Admin: Delete item from catalog
  const handleDeletePart = async (item: StaffInventoryItem) => {
    if (
      !confirm(
        `Permanently delete "${item.name}" (${item.sku || "No SKU"}) from the inventory catalog? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/inventory/${item.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        if (editingItem?.id === item.id) setEditingItem(null);
        setActionFeedback({
          message: `Part "${item.name}" deleted permanently from inventory.`,
          type: "success",
        });
        setTimeout(() => setActionFeedback(null), 3500);
      } else {
        alert(json.error || "Failed to delete part.");
      }
    } catch (err: any) {
      console.error("Delete part error:", err);
      alert(err.message || "Failed to delete part.");
    }
  };

  // Admin: Save updated part
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSavingEdit(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/inventory/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingItem.name,
          sku: editingItem.sku,
          category: editingItem.category,
          selling_price: Number(editingItem.selling_price) || 0,
          stock_quantity: Math.max(0, parseInt(String(editingItem.stock_quantity)) || 0),
          location_bin: editingItem.location_bin,
          reorder_threshold: Number(editingItem.reorder_threshold) || 2,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update part.");
      }

      setItems((prev) =>
        prev.map((i) => (i.id === editingItem.id ? { ...i, ...editingItem } : i))
      );
      setActionFeedback({
        message: `Updated "${editingItem.name}" successfully.`,
        type: "success",
      });
      setTimeout(() => setActionFeedback(null), 3500);
      setEditingItem(null);
    } catch (err: any) {
      setEditError(err.message || "Failed to save part details.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Action feedback flash */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2 ${
            actionFeedback.type === "warning"
              ? "bg-amber-950/90 border-amber-600 text-amber-200"
              : "bg-emerald-950/90 border-emerald-600 text-emerald-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                Workshop Parts Catalog
              </span>
              {isAdmin ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 font-mono font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1 text-amber-400" />
                  Admin Editorial Access (Zero / Edit / Delete)
                </span>
              ) : (
                <span className="inline-flex items-center text-xs text-emerald-400 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Staff Safe View
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-mono mt-1">
              Garage Inventory &amp; Stock Availability
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Look up stock counts, warehouse bin locations, and retail prices. {isAdmin && "As an admin, you have full editorial access to edit details, zero out stock, or delete parts."}
            </p>
          </div>

          <button
            onClick={fetchItems}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center space-x-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh Stock</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by part name, SKU, or shelf bin..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Low Stock Toggle */}
          <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer select-none self-start sm:self-auto">
            <input
              type="checkbox"
              checked={onlyLowStock}
              onChange={(e) => setOnlyLowStock(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500"
            />
            <span className="font-mono text-slate-300">Show Low Stock Only (&le; reorder threshold)</span>
          </label>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 pt-1 scrollbar-thin">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-all whitespace-nowrap ${
              selectedCategory === "ALL"
                ? "bg-amber-500 text-slate-950 font-bold"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            All Categories
          </button>
          {GARAGE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-amber-500 text-slate-950 font-bold"
                  : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Parts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Part / Product</th>
                <th className="py-3 px-4">SKU / Code</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Stock Level</th>
                <th className="py-3 px-4">Bin Location</th>
                <th className="py-3 px-4 text-right">Retail Price</th>
                <th className="py-3 px-4 text-right">
                  {isAdmin ? "Admin Editorial & Actions" : "Action"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                    Loading inventory catalog...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-mono">
                    No parts found matching your criteria.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isLow = item.stock_quantity <= item.reorder_threshold;
                  const isOut = item.stock_quantity <= 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {item.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {item.sku}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-slate-950 text-slate-300 border border-slate-800">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold ${
                            isOut
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : isLow
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {item.stock_quantity}
                          {isOut ? " (Out)" : isLow ? " (Low)" : " in stock"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {item.location_bin ? (
                          <span className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{item.location_bin}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400 text-sm">
                        {formatNpr(item.selling_price || 0)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Admin Editorial Controls */}
                          {isAdmin && (
                            <>
                              {/* Quick Set to 0 button */}
                              <button
                                type="button"
                                disabled={isOut}
                                onClick={() => handleZeroOutStock(item)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-rose-900/60 disabled:opacity-25 text-rose-300 hover:text-rose-200 border border-slate-700 hover:border-rose-600 transition-colors font-mono text-[11px] font-bold shadow-xs flex items-center space-x-1"
                                title="Admin: Edit stock quantity to 0"
                              >
                                <span className="text-rose-400 font-black">0</span>
                                <span>Set 0</span>
                              </button>

                              {/* Edit Part Details */}
                              <button
                                type="button"
                                onClick={() => setEditingItem(item)}
                                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                                title="Admin: Edit part details & stock"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                              </button>

                              {/* Delete Part */}
                              <button
                                type="button"
                                onClick={() => handleDeletePart(item)}
                                className="p-1.5 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                                title="Admin: Permanently delete part"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* Sell Part Button */}
                          <button
                            onClick={() => onSelectItemForSale(item)}
                            disabled={isOut}
                            className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold font-mono transition-colors ${
                              isOut
                                ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                                : "bg-emerald-500 hover:bg-emerald-400 text-slate-950"
                            }`}
                          >
                            <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                            <span>Sell Part</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Part Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white font-mono flex items-center">
                <Edit3 className="w-4 h-4 mr-2 text-amber-400" />
                Admin Edit: {editingItem.name}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1">
                    Part / Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editingItem.name}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, name: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1">
                    SKU / Part Code
                  </label>
                  <input
                    type="text"
                    value={editingItem.sku || ""}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, sku: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1">
                    Category
                  </label>
                  <select
                    value={editingItem.category}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, category: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    {GARAGE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-300 font-mono uppercase">
                      Stock Quantity
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingItem({ ...editingItem, stock_quantity: 0 })
                      }
                      className="text-[10px] font-mono font-bold text-rose-400 hover:text-rose-300 bg-rose-950/60 hover:bg-rose-900/80 px-2 py-0.5 rounded border border-rose-800/80 transition-colors"
                      title="Set stock quantity to zero"
                    >
                      Set to 0
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={editingItem.stock_quantity ?? 0}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        stock_quantity: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1">
                    Retail Selling Price (NPR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingItem.selling_price || 0}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        selling_price: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1">
                    Reorder Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingItem.reorder_threshold}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        reorder_threshold: parseInt(e.target.value) || 2,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1">
                    Shelf / Bin Location
                  </label>
                  <input
                    type="text"
                    value={editingItem.location_bin || ""}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, location_bin: e.target.value })
                    }
                    placeholder="e.g. Shelf A-3"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const itemToDelete = editingItem;
                    handleDeletePart(itemToDelete);
                  }}
                  className="px-3 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-md font-semibold text-xs flex items-center space-x-1.5 transition-colors"
                  title="Permanently remove this part from inventory"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Part</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-semibold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md font-bold text-xs shadow flex items-center space-x-1"
                  >
                    <span>{isSavingEdit ? "Saving..." : "Update Part"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
