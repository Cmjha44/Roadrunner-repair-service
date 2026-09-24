import React, { useState, useEffect } from "react";
import { InventoryItem } from "../types.ts";
import {
  AlertTriangle,
  AlertOctagon,
  Mail,
  ChevronRight,
  X,
  RefreshCw,
  Bell,
} from "lucide-react";

interface LowStockBannerProps {
  onOpenNotificationCenter: () => void;
  onRefreshTrigger?: number;
}

export function LowStockBanner({
  onOpenNotificationCenter,
  onRefreshTrigger = 0,
}: LowStockBannerProps) {
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLowStock = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/inventory?low_stock=true");
      const json = await res.json();
      if (json.items) {
        setLowStockItems(json.items);
      }
    } catch (err) {
      console.error("Failed to fetch low stock banner data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLowStock();
  }, [onRefreshTrigger]);

  if (isDismissed || lowStockItems.length === 0) {
    return null;
  }

  const outOfStockCount = lowStockItems.filter(
    (i) => Number(i.stock_quantity) <= 0
  ).length;

  const topSampleNames = lowStockItems
    .slice(0, 3)
    .map((i) => i.name.split(" ")[0] + " " + (i.name.split(" ")[1] || ""))
    .join(", ");

  return (
    <div className="bg-gradient-to-r from-amber-950/80 via-amber-900/60 to-rose-950/80 border-b border-amber-500/40 text-amber-100 px-4 py-2.5 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="p-1 rounded bg-amber-500 text-slate-950 font-bold shrink-0">
            {outOfStockCount > 0 ? (
              <AlertOctagon className="w-4 h-4 text-rose-950" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
          </div>
          <div className="truncate">
            <span className="font-bold text-amber-300 font-mono uppercase tracking-wide mr-1.5">
              Low-Stock Alert:
            </span>
            <span className="text-slate-200">
              <strong>{lowStockItems.length} spare parts</strong> are at or below reorder
              threshold ({topSampleNames}
              {lowStockItems.length > 3 ? "..." : ""}).
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-center shrink-0 font-mono text-[11px]">
          <button
            onClick={onOpenNotificationCenter}
            className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center space-x-1 transition-colors shadow-sm"
          >
            <Bell className="w-3.5 h-3.5 mr-0.5" />
            <span>Review &amp; Email Alert</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-amber-900/40"
            title="Dismiss for this session"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
