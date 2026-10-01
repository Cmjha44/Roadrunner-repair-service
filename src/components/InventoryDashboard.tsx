import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus,
  AlertOctagon,
  CheckCircle2,
  Edit2,
  X,
  Package,
  History,
  Coins,
  Boxes,
  Layers,
  MapPin,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Mail,
  Bell,
  Tag,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  InventoryItem,
  GARAGE_CATEGORIES,
  GarageCategory,
  StockMovement,
} from "../types.ts";
import { TopSellingPartsChart } from "./TopSellingPartsChart.tsx";
import { DailyRevenueTrendChart } from "./DailyRevenueTrendChart.tsx";
import { formatNpr } from "../utils/currency.ts";

interface InventoryDashboardProps {
  onSelectPartForHistory?: (item: InventoryItem) => void;
  onRefreshTrigger?: number;
  onOpenNotificationCenter?: () => void;
  onViewReceiptsLedger?: () => void;
}

export const InventoryDashboard: React.FC<InventoryDashboardProps> = ({
  onSelectPartForHistory,
  onRefreshTrigger = 0,
  onOpenNotificationCenter,
  onViewReceiptsLedger,
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showAnalyticsChart, setShowAnalyticsChart] = useState(true);
  const [analyticsView, setAnalyticsView] = useState<"revenue" | "parts" | "both">("revenue");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut to focus search with '/' or 'Ctrl/Cmd+K'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (
        (e.key === "/" && activeTag !== "INPUT" && activeTag !== "TEXTAREA") ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearchTerm("");
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Helper to highlight matching text in search results
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim() || !text) return text;
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase() === query.trim().toLowerCase() ? (
        <mark
          key={i}
          className="bg-amber-400/30 text-amber-200 px-0.5 rounded font-bold underline decoration-amber-400/60"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Sorting state
  const [sortBy, setSortBy] = useState<
    "name" | "category" | "stock_quantity" | "unit_cost" | "last_restocked_at"
  >("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Quick feedback toast / flash
  const [actionFeedback, setActionFeedback] = useState<{
    id: string;
    message: string;
    type: "success" | "warning";
  } | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<InventoryItem | null>(null);
  const [itemMovements, setItemMovements] = useState<StockMovement[]>([]);

  // New Part Form State
  const [newPart, setNewPart] = useState({
    sku: "",
    name: "",
    category: "Oils & Fluids" as GarageCategory,
    stock_quantity: 4,
    reorder_threshold: 2,
    last_purchased_cost: 15.0,
    selling_price: 22.5,
    location_bin: "Shelf A-1",
  });

  const fetchInventory = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append("search", searchTerm.trim());
      if (selectedCategory && selectedCategory !== "ALL")
        params.append("category", selectedCategory);
      if (lowStockOnly) params.append("low_stock", "true");
      params.append("sort_by", sortBy);
      params.append("sort_dir", sortDir);

      const res = await fetch(`/api/inventory?${params.toString()}`);
      const json = await res.json();
      if (json.items) {
        setItems(json.items);
      }
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [searchTerm, selectedCategory, lowStockOnly, sortBy, sortDir, onRefreshTrigger]);

  const toggleSort = (
    column: "name" | "category" | "stock_quantity" | "unit_cost" | "last_restocked_at"
  ) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  };

  // Quick Decrement Handlers (-1, -5) for garage mechanics
  const handleQuickDecrement = async (item: InventoryItem, amount: number) => {
    try {
      const res = await fetch(`/api/inventory/${item.id}/decrement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          reason: `Mechanic pulled ${amount} unit(s) for repair bay`,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, stock_quantity: json.newStock } : i
          )
        );

        setActionFeedback({
          id: item.id,
          message: `Pulled -${amount} ${item.name} (${json.newStock} left)`,
          type: json.isLowStock ? "warning" : "success",
        });

        setTimeout(() => setActionFeedback(null), 3000);
      }
    } catch (err) {
      console.error("Decrement error:", err);
    }
  };

  // Quick Increment (+1)
  const handleQuickIncrement = async (item: InventoryItem, amount: number = 1) => {
    try {
      const res = await fetch(`/api/inventory/${item.id}/increment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          reason: `Quick manual restock (+${amount})`,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, stock_quantity: json.newStock } : i
          )
        );

        setActionFeedback({
          id: item.id,
          message: `Added +${amount} ${item.name} (${json.newStock} in stock)`,
          type: "success",
        });
        setTimeout(() => setActionFeedback(null), 3000);
      }
    } catch (err) {
      console.error("Increment error:", err);
    }
  };

  const handleCreatePart = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPart),
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        setNewPart({
          sku: "",
          name: "",
          category: "Oils & Fluids",
          stock_quantity: 4,
          reorder_threshold: 2,
          last_purchased_cost: 15.0,
          selling_price: 22.5,
          location_bin: "Shelf A-1",
        });
        fetchInventory();
      }
    } catch (err) {
      console.error("Failed to add part:", err);
    }
  };

  const handleUpdatePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const res = await fetch(`/api/inventory/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingItem),
      });
      if (res.ok) {
        setEditingItem(null);
        fetchInventory();
      }
    } catch (err) {
      console.error("Failed to update part:", err);
    }
  };

  const openItemHistory = async (item: InventoryItem) => {
    setViewingHistoryItem(item);
    try {
      const res = await fetch(`/api/movements?inventory_id=${item.id}&limit=20`);
      const json = await res.json();
      setItemMovements(json.movements || []);
    } catch (err) {
      console.error("Failed to load item history:", err);
    }
  };

  // KPIs
  const totalStockItems = items.reduce((acc, i) => acc + (Number(i.stock_quantity) || 0), 0);
  const totalValuation = items.reduce(
    (acc, i) => acc + (Number(i.stock_quantity) || 0) * (Number(i.last_purchased_cost) || 0),
    0
  );
  const lowStockCount = items.filter(
    (i) => Number(i.stock_quantity) <= Number(i.reorder_threshold)
  ).length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Top Garage KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Total SKUs / Parts
            </p>
            <p className="text-xl font-black text-white font-mono">{items.length}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Units In Stock
            </p>
            <p className="text-xl font-black text-white font-mono">{totalStockItems}</p>
          </div>
        </div>

        <div
          onClick={() => {
            if (onOpenNotificationCenter) onOpenNotificationCenter();
          }}
          className={`bg-slate-900 border rounded-xl p-4 shadow-sm flex items-center justify-between transition-all ${
            onOpenNotificationCenter && lowStockCount > 0
              ? "border-red-500/40 hover:border-red-500 hover:bg-slate-800/80 cursor-pointer"
              : "border-slate-800"
          }`}
          title={onOpenNotificationCenter ? "Click to open Low-Stock Alert & Email Center" : undefined}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`p-2.5 rounded-lg border ${
                lowStockCount > 0
                  ? "bg-red-500/10 text-red-400 border-red-500/30 animate-pulse"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Low Stock Alerts
              </p>
              <p
                className={`text-xl font-black font-mono ${
                  lowStockCount > 0 ? "text-red-400" : "text-white"
                }`}
              >
                {lowStockCount} Parts
              </p>
            </div>
          </div>
          {onOpenNotificationCenter && lowStockCount > 0 && (
            <span className="text-[11px] font-mono text-amber-400 hover:text-amber-300 underline hidden sm:inline">
              Email Alert &rarr;
            </span>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Inventory Asset Value
            </p>
            <p className="text-xl font-black text-sky-400 font-mono">
              {formatNpr(totalValuation)}
            </p>
          </div>
        </div>
      </div>

      {/* Global Feedback Toast */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-lg border text-xs font-bold font-mono flex items-center justify-between shadow-lg transition-all ${
            actionFeedback.type === "warning"
              ? "bg-amber-950/90 border-amber-500 text-amber-200"
              : "bg-emerald-950/90 border-emerald-500 text-emerald-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionFeedback.message}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Recharts Workshop Analytics Section (Daily Revenue Trend & Parts Demand) */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          {/* Chart View Switcher Tabs */}
          <div className="flex items-center space-x-1 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
            <button
              onClick={() => {
                setAnalyticsView("revenue");
                setShowAnalyticsChart(true);
              }}
              className={`px-3 py-1.5 rounded-md font-bold flex items-center space-x-1.5 transition-all ${
                analyticsView === "revenue" && showAnalyticsChart
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Daily Revenue Trend</span>
              <span className="text-[10px] opacity-80 uppercase px-1 rounded bg-black/20 font-sans hidden md:inline">
                Ledger
              </span>
            </button>

            <button
              onClick={() => {
                setAnalyticsView("parts");
                setShowAnalyticsChart(true);
              }}
              className={`px-3 py-1.5 rounded-md font-bold flex items-center space-x-1.5 transition-all ${
                analyticsView === "parts" && showAnalyticsChart
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Parts Velocity</span>
            </button>

            <button
              onClick={() => {
                setAnalyticsView("both");
                setShowAnalyticsChart(true);
              }}
              className={`px-2.5 py-1.5 rounded-md font-bold flex items-center space-x-1.5 transition-all ${
                analyticsView === "both" && showAnalyticsChart
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Combined</span>
            </button>
          </div>

          {/* Toggle Expand / Collapse */}
          <button
            onClick={() => setShowAnalyticsChart(!showAnalyticsChart)}
            className="text-xs font-mono text-slate-400 hover:text-amber-400 flex items-center space-x-1 py-1 px-2.5 rounded hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors self-end sm:self-auto"
          >
            <span>{showAnalyticsChart ? "Hide Charts" : "Show Analytics"}</span>
            {showAnalyticsChart ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {showAnalyticsChart && (
          <div className="space-y-4">
            {(analyticsView === "revenue" || analyticsView === "both") && (
              <DailyRevenueTrendChart
                onRefreshTrigger={onRefreshTrigger}
                onViewReceiptsLedger={onViewReceiptsLedger}
              />
            )}

            {(analyticsView === "parts" || analyticsView === "both") && (
              <TopSellingPartsChart onRefreshTrigger={onRefreshTrigger} />
            )}
          </div>
        )}
      </div>

      {/* Controls Bar: Search, Category Filter, Low Stock Toggle, Add Part Button */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Quick Lookup Search Bar */}
          <div className="relative flex-1">
            <div className="relative flex items-center">
              <Search
                className={`w-4 h-4 absolute left-3.5 transition-colors ${
                  searchTerm ? "text-amber-400" : "text-slate-400"
                }`}
              />
              <input
                ref={searchInputRef}
                id="inventory-search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Quick lookup by SKU (e.g. MOT-7100, BRK-PAD), Name (Brembo, Plug), or Category (Braking, Tires)..."
                className="w-full pl-10 pr-24 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/50 font-medium transition-all"
              />
              <div className="absolute right-2.5 flex items-center space-x-1.5">
                {searchTerm ? (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      searchInputRef.current?.focus();
                    }}
                    title="Clear search (Esc)"
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors flex items-center space-x-0.5 text-xs font-mono"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">Clear</span>
                  </button>
                ) : (
                  <kbd
                    onClick={() => searchInputRef.current?.focus()}
                    className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-700 rounded shadow-xs cursor-pointer hover:border-slate-600 hover:text-slate-300"
                    title="Press / or ⌘K to search"
                  >
                    /
                  </kbd>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Filter Dropdown */}
            <div className="flex items-center space-x-1.5">
              <label className="text-xs font-mono text-slate-400 uppercase hidden sm:inline">
                Category:
              </label>
              <select
                id="category-filter-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-400"
              >
                <option value="ALL">All Categories</option>
                {GARAGE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Low Stock Toggle Switch */}
            <button
              id="low-stock-toggle-btn"
              type="button"
              onClick={() => setLowStockOnly((prev) => !prev)}
              className={`px-3 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center space-x-1.5 border transition-all ${
                lowStockOnly
                  ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-inner"
                  : "bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200"
              }`}
            >
              <AlertOctagon className={`w-3.5 h-3.5 ${lowStockOnly ? "text-red-400" : "text-slate-400"}`} />
              <span>Low Stock Only</span>
            </button>

            {/* Email Owner Reorder Advisory Button */}
            {onOpenNotificationCenter && (
              <button
                type="button"
                onClick={onOpenNotificationCenter}
                className="px-3 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center space-x-1.5 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-colors"
                title="Open Low-Stock Email & Notification Center"
              >
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Email Alert</span>
              </button>
            )}

            {/* Add Part Manually */}
            <button
              id="add-part-manual-btn"
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-extrabold uppercase tracking-wider flex items-center space-x-1 shadow transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Part</span>
            </button>
          </div>
        </div>

        {/* Quick Search Chips & Search Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-500 flex items-center mr-1">
              <Tag className="w-3 h-3 mr-1" /> Quick lookup:
            </span>
            {[
              { label: "Brembo", query: "Brembo" },
              { label: "Motul", query: "Motul" },
              { label: "NGK", query: "NGK" },
              { label: "Michelin", query: "Michelin" },
              { label: "Braking", query: "Braking" },
              { label: "Oils & Fluids", query: "Oils & Fluids" },
              { label: "Electrical", query: "Electrical" },
              { label: "Tires", query: "Tires" },
              { label: "Drivetrain", query: "Drivetrain" },
            ].map((tag) => (
              <button
                key={tag.label}
                type="button"
                onClick={() => {
                  setSearchTerm(tag.query);
                  searchInputRef.current?.focus();
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors border ${
                  searchTerm.toLowerCase() === tag.query.toLowerCase()
                    ? "bg-amber-500 text-slate-950 border-amber-400 font-bold"
                    : "bg-slate-950/70 text-slate-400 border-slate-800 hover:text-amber-300 hover:border-slate-700"
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>

          {/* Active Search / Filter Status Counter */}
          <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
            {searchTerm ? (
              <span className="text-amber-300">
                Found <strong>{items.length}</strong> part(s) matching "{searchTerm}"
              </span>
            ) : (
              <span>
                Showing <strong>{items.length}</strong> catalog parts
              </span>
            )}

            {(searchTerm || selectedCategory !== "ALL" || lowStockOnly) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("ALL");
                  setLowStockOnly(false);
                }}
                className="text-slate-500 hover:text-slate-300 underline text-[10px]"
              >
                Reset All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Inventory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider text-[11px] border-b border-slate-800 select-none">
              <tr>
                {/* Part Name */}
                <th
                  onClick={() => toggleSort("name")}
                  className="py-3 px-4 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center space-x-1">
                    <span>Part Name &amp; SKU</span>
                    {sortBy === "name" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-amber-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Category */}
                <th
                  onClick={() => toggleSort("category")}
                  className="py-3 px-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center space-x-1">
                    <span>Category</span>
                    {sortBy === "category" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-amber-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* In-Stock Quantity */}
                <th
                  onClick={() => toggleSort("stock_quantity")}
                  className="py-3 px-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center space-x-1">
                    <span>Stock Qty</span>
                    {sortBy === "stock_quantity" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-amber-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Quick Pull Controls (-1, -5) */}
                <th className="py-3 px-3 text-center">
                  <span className="text-amber-400">Quick Pull (Job)</span>
                </th>

                {/* Last Cost */}
                <th
                  onClick={() => toggleSort("unit_cost")}
                  className="py-3 px-3 cursor-pointer hover:text-white text-right"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Unit Cost</span>
                    {sortBy === "unit_cost" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-amber-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Restocked Date */}
                <th
                  onClick={() => toggleSort("last_restocked_at")}
                  className="py-3 px-3 cursor-pointer hover:text-white hidden md:table-cell"
                >
                  <div className="flex items-center space-x-1">
                    <span>Restocked</span>
                    {sortBy === "last_restocked_at" ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="w-3 h-3 text-amber-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-amber-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Actions */}
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                    Querying local SQLite database...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="max-w-md mx-auto flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
                        <Search className="w-6 h-6 text-amber-400/80" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-white text-sm font-mono">
                          {searchTerm
                            ? `No parts found matching "${searchTerm}"`
                            : "No parts match your filter criteria"}
                        </p>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {searchTerm
                            ? `Try checking for typos, or search by SKU (e.g. MOT-7100, BRK-PAD), generic name (Brembo, Plug), or category (Braking, Tires).`
                            : `Try adjusting the category filter or turning off low-stock filtering.`}
                        </p>
                      </div>
                      {(searchTerm || selectedCategory !== "ALL" || lowStockOnly) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchTerm("");
                            setSelectedCategory("ALL");
                            setLowStockOnly(false);
                            searchInputRef.current?.focus();
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold transition-colors"
                        >
                          Clear Search &amp; Show All Parts
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isLow = Number(item.stock_quantity) <= Number(item.reorder_threshold);
                  const isOut = Number(item.stock_quantity) <= 0;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-800/50 transition-colors ${
                        isLow ? "bg-red-950/10" : ""
                      }`}
                    >
                      {/* Name & SKU */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-white text-sm">
                          {highlightMatch(item.name, searchTerm)}
                        </div>
                        <div className="flex items-center space-x-2 mt-0.5 font-mono text-[11px] text-slate-400">
                          <span className="text-amber-400">
                            {highlightMatch(item.sku || "NO SKU", searchTerm)}
                          </span>
                          {item.location_bin && (
                            <span className="flex items-center text-slate-400">
                              <MapPin className="w-2.5 h-2.5 mr-0.5" />
                              {item.location_bin}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
                          {highlightMatch(item.category, searchTerm)}
                        </span>
                      </td>

                      {/* Stock Quantity + Low Stock Warning */}
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`font-mono text-base font-black px-2 py-0.5 rounded ${
                              isOut
                                ? "bg-red-900/60 text-red-200 border border-red-700"
                                : isLow
                                ? "bg-amber-950 text-amber-300 border border-amber-600"
                                : "text-white"
                            }`}
                          >
                            {item.stock_quantity}
                          </span>
                          {isLow && (
                            <span
                              title={`Threshold: ${item.reorder_threshold} units`}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white uppercase font-mono tracking-tight"
                            >
                              LOW
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          Min: {item.reorder_threshold}
                        </span>
                      </td>

                      {/* Quick Decrement Buttons (-1, -5) and +1 Restock */}
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* -1 Button */}
                          <button
                            id={`dec-1-${item.id}`}
                            type="button"
                            disabled={Number(item.stock_quantity) <= 0}
                            onClick={() => handleQuickDecrement(item, 1)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-red-600 disabled:opacity-30 text-white font-mono font-bold text-xs border border-slate-700 hover:border-red-500 transition-colors shadow-sm"
                            title="Pull 1 unit for repair job"
                          >
                            -1
                          </button>

                          {/* -5 Button */}
                          <button
                            id={`dec-5-${item.id}`}
                            type="button"
                            disabled={Number(item.stock_quantity) < 5}
                            onClick={() => handleQuickDecrement(item, 5)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-red-600 disabled:opacity-30 text-white font-mono font-bold text-xs border border-slate-700 hover:border-red-500 transition-colors shadow-sm"
                            title="Pull 5 units for repair job"
                          >
                            -5
                          </button>

                          {/* +1 Restock */}
                          <button
                            id={`inc-1-${item.id}`}
                            type="button"
                            onClick={() => handleQuickIncrement(item, 1)}
                            className="p-1 rounded bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white border border-slate-700 hover:border-emerald-500 transition-colors"
                            title="Add 1 to stock"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Unit Cost */}
                      <td className="py-3 px-3 text-right font-mono">
                        <span className="text-white font-medium">
                          {formatNpr(item.last_purchased_cost)}
                        </span>
                        {item.selling_price > 0 && (
                          <span className="text-[10px] text-slate-400 block">
                            Sell: {formatNpr(item.selling_price)}
                          </span>
                        )}
                      </td>

                      {/* Restocked Date */}
                      <td className="py-3 px-3 text-slate-400 font-mono text-[11px] hidden md:table-cell">
                        {item.last_restocked_at ? (
                          new Date(item.last_restocked_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        ) : (
                          <span className="text-slate-600">Never</span>
                        )}
                      </td>

                      {/* Actions (Edit / History) */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => openItemHistory(item)}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                            title="View Stock Movement Audit History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingItem(item)}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            title="Edit Part Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
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

      {/* MODAL 1: Add New Part Manually */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white font-mono flex items-center">
                <Plus className="w-4 h-4 mr-1.5 text-amber-400" />
                Register New Inventory Part
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePart} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1">
                  Part Name *
                </label>
                <input
                  type="text"
                  required
                  value={newPart.name}
                  onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                  placeholder="e.g. Michelin Road 6 Rear Tire 180/55ZR17"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1">
                    SKU / Part #
                  </label>
                  <input
                    type="text"
                    value={newPart.sku}
                    onChange={(e) => setNewPart({ ...newPart, sku: e.target.value })}
                    placeholder="e.g. TYR-MIC-ROAD6-R"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1">
                    Category *
                  </label>
                  <select
                    value={newPart.category}
                    onChange={(e) =>
                      setNewPart({ ...newPart, category: e.target.value as GarageCategory })
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newPart.stock_quantity}
                    onChange={(e) =>
                      setNewPart({ ...newPart, stock_quantity: parseInt(e.target.value) || 0 })
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
                    value={newPart.reorder_threshold}
                    onChange={(e) =>
                      setNewPart({ ...newPart, reorder_threshold: parseInt(e.target.value) || 2 })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1">
                    Purchased Cost (NPR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPart.last_purchased_cost}
                    onChange={(e) =>
                      setNewPart({
                        ...newPart,
                        last_purchased_cost: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1">
                    Bin / Shelf Location
                  </label>
                  <input
                    type="text"
                    value={newPart.location_bin}
                    onChange={(e) => setNewPart({ ...newPart, location_bin: e.target.value })}
                    placeholder="e.g. Bay 2 / Shelf C"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md font-bold shadow"
                >
                  Save to SQLite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Existing Part */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white font-mono flex items-center">
                <Edit2 className="w-4 h-4 mr-1.5 text-amber-400" />
                Edit Part: {editingItem.name}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePart} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1">
                  Part Name
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 font-mono uppercase mb-1">
                    SKU / Part #
                  </label>
                  <input
                    type="text"
                    value={editingItem.sku}
                    onChange={(e) => setEditingItem({ ...editingItem, sku: e.target.value })}
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
                      setEditingItem({
                        ...editingItem,
                        category: e.target.value as GarageCategory,
                      })
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
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    Bin / Shelf Location
                  </label>
                  <input
                    type="text"
                    value={editingItem.location_bin || ""}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, location_bin: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md font-bold shadow"
                >
                  Update Part
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Stock Movement History for Part */}
      {viewingHistoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white font-mono flex items-center">
                  <History className="w-4 h-4 mr-1.5 text-amber-400" />
                  Movement Audit: {viewingHistoryItem.name}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  Current Stock: {viewingHistoryItem.stock_quantity} units • SKU:{" "}
                  {viewingHistoryItem.sku || "N/A"}
                </p>
              </div>
              <button
                onClick={() => setViewingHistoryItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {itemMovements.length === 0 ? (
                <p className="text-center py-6 text-slate-500 font-mono">
                  No movement logs recorded yet for this part.
                </p>
              ) : (
                itemMovements.map((mov) => (
                  <div
                    key={mov.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`font-mono font-black text-xs px-2 py-0.5 rounded ${
                            mov.delta > 0
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-red-950 text-red-400 border border-red-800"
                          }`}
                        >
                          {mov.delta > 0 ? `+${mov.delta}` : mov.delta} units
                        </span>
                        <span className="font-semibold text-slate-200">{mov.reason}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono block mt-1">
                        {new Date(mov.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-slate-400 text-[10px]">Stock After:</span>
                      <p className="text-sm font-bold text-white">{mov.quantity_after}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 text-right">
              <button
                type="button"
                onClick={() => setViewingHistoryItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md font-semibold text-xs"
              >
                Close Audit History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
