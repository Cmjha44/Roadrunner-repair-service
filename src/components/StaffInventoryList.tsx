import React, { useState, useEffect } from "react";
import { StaffInventoryItem, GARAGE_CATEGORIES } from "../types.ts";
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
} from "lucide-react";

interface StaffInventoryListProps {
  onSelectItemForSale: (item: StaffInventoryItem) => void;
}

export function StaffInventoryList({ onSelectItemForSale }: StaffInventoryListProps) {
  const [items, setItems] = useState<StaffInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [onlyLowStock, setOnlyLowStock] = useState(false);

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

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                Workshop Parts Catalog
              </span>
              <span className="inline-flex items-center text-xs text-emerald-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Staff Safe View
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-mono mt-1">
              Garage Inventory &amp; Stock Availability
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Look up stock counts, warehouse bin locations, and retail prices. Click "Sell Part" to immediately add any item to a customer sell receipt.
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
                <th className="py-3 px-4 text-right">Action</th>
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
                        ${Number(item.selling_price || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
