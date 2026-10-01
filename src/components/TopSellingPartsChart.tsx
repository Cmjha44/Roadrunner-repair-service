import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Coins,
  Package,
  Layers,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Award,
  ChevronRight,
  Flame,
} from "lucide-react";
import { formatNpr } from "../utils/currency.ts";

export interface TopSellingItem {
  fullName: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  revenue: number;
  avgUnitPrice: number;
  receiptsCount: number;
  lastSoldAt: string;
  currentStock: number | null;
  reorderThreshold: number;
  locationBin: string | null;
}

export interface CategoryMetric {
  category: string;
  units: number;
  revenue: number;
  percentage: number;
}

interface TopSellingPartsChartProps {
  onRefreshTrigger?: number;
}

// Category palette tailored for utilitarian workshop theme
const CATEGORY_COLORS: Record<string, string> = {
  "Oils & Fluids": "#f59e0b", // Amber
  "Braking": "#f43f5e", // Rose
  "Electrical": "#eab308", // Yellow
  "Tires": "#06b6d4", // Cyan
  "Drivetrain": "#a855f7", // Purple
  "Hardware": "#10b981", // Emerald
  "Exhaust": "#64748b", // Slate
  "Suspension": "#3b82f6", // Blue
  "General": "#f59e0b",
};

export const TopSellingPartsChart: React.FC<TopSellingPartsChartProps> = ({
  onRefreshTrigger = 0,
}) => {
  const [data, setData] = useState<TopSellingItem[]>([]);
  const [categories, setCategories] = useState<CategoryMetric[]>([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [topItem, setTopItem] = useState<TopSellingItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // User controls
  const [metricMode, setMetricMode] = useState<"quantity" | "revenue">("quantity");
  const [daysPeriod, setDaysPeriod] = useState<number>(30);

  const fetchTopSelling = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory/top-selling?days=${daysPeriod}&limit=8`);
      const json = await res.json();
      if (json.items) {
        setData(json.items);
        setCategories(json.categories || []);
        setTotalQuantity(json.totalQuantity || 0);
        setTotalRevenue(json.totalRevenue || 0);
        setTopItem(json.topItem || null);
      }
    } catch (err) {
      console.error("Failed to load top selling parts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTopSelling();
  }, [daysPeriod, onRefreshTrigger]);

  // Custom Dark Tooltip for Garage UI
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item: TopSellingItem = payload[0].payload;
      const color = CATEGORY_COLORS[item.category] || "#f59e0b";
      const isLowStock =
        item.currentStock !== null && item.currentStock <= item.reorderThreshold;

      return (
        <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs space-y-2 max-w-xs font-sans text-slate-100">
          <div className="border-b border-slate-800 pb-1.5">
            <div className="flex items-center justify-between gap-2">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                style={{ backgroundColor: `${color}20`, color: color }}
              >
                {item.category}
              </span>
              <span className="font-mono text-[10px] text-slate-400">SKU: {item.sku}</span>
            </div>
            <p className="font-bold text-white text-xs mt-1 leading-snug">{item.fullName}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">Units Sold</span>
              <span className="text-amber-400 font-bold text-sm">{item.quantity} units</span>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">Total Revenue</span>
              <span className="text-emerald-400 font-bold text-sm">
                {formatNpr(item.revenue)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400 font-mono">
            <span>Avg Sale Price:</span>
            <span className="text-slate-200 font-bold">{formatNpr(item.avgUnitPrice)}</span>
          </div>

          {item.currentStock !== null && (
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80 font-mono">
              <span className="text-slate-400">Current On-Hand:</span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                  isLowStock
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    : "bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {item.currentStock} in stock {isLowStock ? "(Low Stock!)" : ""}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
      {/* Top Header Row with Title, Period Tabs & Metric Switch */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Flame className="w-3.5 h-3.5 mr-1 text-amber-500" />
              Receipts Ledger Insights
            </span>
            <span className="text-xs text-slate-400 font-mono">• 30-Day Velocity</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white font-mono mt-1 flex items-center">
            Top-Selling Spare Parts
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Analyzed from customer sales receipts logged over the last {daysPeriod} days.
          </p>
        </div>

        {/* Right Controls: Metric Toggle & Period Selector */}
        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto">
          {/* Days Period Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            {[14, 30, 60].map((days) => (
              <button
                key={days}
                onClick={() => setDaysPeriod(days)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  daysPeriod === days
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {days}D
              </button>
            ))}
          </div>

          {/* Metric Switch: Units vs Revenue */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setMetricMode("quantity")}
              className={`px-3 py-1 rounded flex items-center space-x-1.5 transition-colors ${
                metricMode === "quantity"
                  ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Units Sold</span>
            </button>
            <button
              onClick={() => setMetricMode("revenue")}
              className={`px-3 py-1 rounded flex items-center space-x-1.5 transition-colors ${
                metricMode === "revenue"
                  ? "bg-emerald-500 text-slate-950 font-bold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Revenue (NPR)</span>
            </button>
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchTopSelling}
            title="Refresh sales chart"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-amber-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Top Seller Card */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
              #1 Best-Selling Part
            </span>
            <p className="text-xs font-bold text-white truncate" title={topItem?.fullName || "—"}>
              {topItem?.fullName || "No sales in period"}
            </p>
            <p className="text-[11px] font-mono text-amber-400">
              {topItem ? `${topItem.quantity} units (${formatNpr(topItem.revenue)})` : "—"}
            </p>
          </div>
        </div>

        {/* Total Spare Units Sold */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
              Total Units Moved ({daysPeriod}D)
            </span>
            <p className="text-lg font-black text-white font-mono">{totalQuantity} units</p>
            <p className="text-[11px] text-slate-400">Across top spare categories</p>
          </div>
        </div>

        {/* Total Parts Revenue */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
              Spare Parts Sales Revenue
            </span>
            <p className="text-lg font-black text-emerald-400 font-mono">
              {formatNpr(totalRevenue)}
            </p>
            <p className="text-[11px] text-slate-400">From counter sell receipts</p>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      {isLoading ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 font-mono text-xs space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
          <span>Crunching 30-day receipt sales data...</span>
        </div>
      ) : data.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl p-6 text-center space-y-2">
          <Package className="w-8 h-8 text-slate-600" />
          <p className="text-slate-300 font-semibold">No Sales Receipts Recorded In Last {daysPeriod} Days</p>
          <p className="text-slate-500 max-w-sm">
            Log customer sales receipts using the Staff Terminal or receipt scanner to see live part velocity charts.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="w-full h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 15, right: 10, left: 10, bottom: 45 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={11}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontFamily: "monospace" }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontFamily: "monospace" }}
                  tickFormatter={(val) =>
                    metricMode === "revenue" ? `NPR ${val}` : `${val}`
                  }
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#1e293b", opacity: 0.6 }} />
                <Bar
                  dataKey={metricMode === "quantity" ? "quantity" : "revenue"}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={52}
                >
                  {data.map((entry, index) => {
                    const color = CATEGORY_COLORS[entry.category] || "#f59e0b";
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={color}
                        fillOpacity={0.85}
                        stroke={color}
                        strokeWidth={1}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Color Legend Bar */}
          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                Categories:
              </span>
              {categories.map((cat) => {
                const color = CATEGORY_COLORS[cat.category] || "#f59e0b";
                return (
                  <div key={cat.category} className="flex items-center space-x-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-mono text-slate-300 text-[11px]">
                      {cat.category}{" "}
                      <span className="text-slate-500">({cat.units} sold)</span>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              Showing Top {data.length} Fast-Moving Parts
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
