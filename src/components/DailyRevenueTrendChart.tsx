import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  Receipt,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Eye,
  ChevronRight,
  X,
  CreditCard,
  FileSpreadsheet,
  AlertCircle,
  ShoppingBag,
} from "lucide-react";
import { DailyRevenueDataPoint, DailyRevenueSummary, DailyRevenueResponse } from "../types.ts";
import { formatNpr, formatNprCompact } from "../utils/currency.ts";

interface DailyRevenueTrendChartProps {
  onRefreshTrigger?: number;
  onViewReceiptsLedger?: () => void;
}

export const DailyRevenueTrendChart: React.FC<DailyRevenueTrendChartProps> = ({
  onRefreshTrigger = 0,
  onViewReceiptsLedger,
}) => {
  const [data, setData] = useState<DailyRevenueDataPoint[]>([]);
  const [summary, setSummary] = useState<DailyRevenueSummary | null>(null);
  const [daysPeriod, setDaysPeriod] = useState<number>(30);
  const [chartMode, setChartMode] = useState<"revenue" | "comparison" | "volume" | "average">(
    "revenue"
  );
  const [selectedDay, setSelectedDay] = useState<DailyRevenueDataPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDailyRevenue = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/daily-revenue?days=${daysPeriod}`);
      const json: DailyRevenueResponse = await res.json();
      if (json.trend && json.summary) {
        setData(json.trend);
        setSummary(json.summary);

        // If a day was selected, update its reference with fresh data
        if (selectedDay) {
          const updated = json.trend.find((d) => d.date === selectedDay.date);
          setSelectedDay(updated || null);
        }
      }
    } catch (err: any) {
      console.error("Failed to load daily revenue trend:", err);
      setError("Failed to fetch daily revenue data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyRevenue();
  }, [daysPeriod, onRefreshTrigger]);

  // Formatter for YAxis NPR numbers
  const yAxisFormatter = (value: number) => {
    return formatNprCompact(value);
  };

  // Custom Interactive Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point: DailyRevenueDataPoint = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3.5 rounded-xl shadow-2xl text-xs space-y-2 min-w-[200px] z-50">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <div>
              <span className="font-bold text-white font-mono text-sm block">
                {point.label}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {point.dayOfWeek} • {point.date}
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {point.receiptCount} {point.receiptCount === 1 ? "receipt" : "receipts"}
            </span>
          </div>

          <div className="space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-slate-200">
              <span className="text-slate-400 flex items-center">
                <span className="w-2 h-2 rounded-full bg-amber-400 mr-1.5 inline-block"></span>
                Sales Revenue:
              </span>
              <span className="font-bold text-amber-300">{formatNpr(point.revenue)}</span>
            </div>

            {point.expenses > 0 && (
              <div className="flex items-center justify-between text-slate-200">
                <span className="text-slate-400 flex items-center">
                  <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5 inline-block"></span>
                  Restock Spend:
                </span>
                <span className="font-bold text-rose-300">{formatNpr(point.expenses)}</span>
              </div>
            )}

            {point.expenses > 0 && (
              <div className="flex items-center justify-between text-slate-200 pt-1 border-t border-slate-800">
                <span className="text-slate-400">Net Margin:</span>
                <span
                  className={`font-bold ${
                    point.netRevenue >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {formatNpr(point.netRevenue)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800 text-[11px]">
              <span>Units Sold:</span>
              <span className="text-slate-200 font-bold">{point.itemsCount} pcs</span>
            </div>

            {point.receiptCount > 0 && (
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Avg Receipt:</span>
                <span className="text-slate-200 font-bold">
                  {formatNpr(point.avgReceiptValue)}
                </span>
              </div>
            )}
          </div>

          {point.salesReceipts && point.salesReceipts.length > 0 && (
            <div className="pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400">
              <p className="font-semibold text-slate-300 mb-0.5">Logged Sales:</p>
              <div className="space-y-0.5 max-h-24 overflow-y-auto pr-1">
                {point.salesReceipts.map((sr) => (
                  <div key={sr.id} className="flex justify-between items-center text-slate-300 truncate">
                    <span className="truncate max-w-[120px]">
                      {sr.receipt_number} • {sr.customer_name}
                    </span>
                    <span className="text-amber-400 font-mono ml-2 shrink-0">
                      {formatNpr(sr.total_amount)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-amber-400/80 mt-1 italic">Click point to view day details</p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const handlePointClick = (eventData: any) => {
    if (eventData && eventData.activePayload && eventData.activePayload.length) {
      const point: DailyRevenueDataPoint = eventData.activePayload[0].payload;
      setSelectedDay(point);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Top Header & Interactive Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white font-mono uppercase tracking-wide">
              Daily Revenue Trend &amp; Receipts Ledger Velocity
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Recharts
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time daily cashflow and order trajectory extracted directly from the workshop's receipt ledger.
          </p>
        </div>

        {/* Chart View Mode & Time Period Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Display Mode Switcher */}
          <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setChartMode("revenue")}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                chartMode === "revenue"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Revenue
            </button>
            <button
              onClick={() => setChartMode("comparison")}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                chartMode === "comparison"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Revenue vs Restock
            </button>
            <button
              onClick={() => setChartMode("volume")}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                chartMode === "volume"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Receipts Count
            </button>
            <button
              onClick={() => setChartMode("average")}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                chartMode === "average"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Avg Ticket
            </button>
          </div>

          {/* Timeframe Presets */}
          <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs font-mono">
            {[7, 14, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDaysPeriod(d)}
                className={`px-2 py-1 rounded font-bold transition-all ${
                  daysPeriod === d
                    ? "bg-slate-800 text-white border border-slate-700 shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Refresh Action */}
          <button
            onClick={fetchDailyRevenue}
            disabled={isLoading}
            title="Refresh Ledger Analytics"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Card 1: Total Period Revenue */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              Period Revenue ({daysPeriod}d)
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-base sm:text-lg font-black text-amber-400 font-mono">
                {formatNpr(summary.totalRevenue)}
              </span>
            </div>
            {summary.revenueGrowthPercent !== null && (
              <span
                className={`text-[10px] font-mono flex items-center ${
                  summary.revenueGrowthPercent >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {summary.revenueGrowthPercent >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 mr-0.5 inline" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 mr-0.5 inline" />
                )}
                {summary.revenueGrowthPercent > 0 ? "+" : ""}
                {summary.revenueGrowthPercent}% vs prior
              </span>
            )}
          </div>

          {/* Card 2: Receipts Volume */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              Total Receipts Logged
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-base sm:text-lg font-black text-white font-mono">
                {summary.totalReceipts}
              </span>
              <span className="text-xs text-slate-400 font-mono">sales</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono block">
              {summary.totalUnitsSold} parts sold
            </span>
          </div>

          {/* Card 3: Daily Average Revenue */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              Daily Average
            </span>
            <span className="text-base sm:text-lg font-black text-sky-400 font-mono block">
              {formatNpr(summary.avgDailyRevenue)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono block">per operating day</span>
          </div>

          {/* Card 4: Avg Receipt Ticket */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              Avg Ticket Size
            </span>
            <span className="text-base sm:text-lg font-black text-indigo-300 font-mono block">
              {formatNpr(summary.avgReceiptValue)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono block">per customer sale</span>
          </div>

          {/* Card 5: Peak Revenue Day */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              Peak Day Record
            </span>
            <span className="text-base sm:text-lg font-black text-emerald-400 font-mono block truncate">
              {summary.peakRevenueDay ? formatNpr(summary.peakRevenueDay.revenue) : "NPR 0.00"}
            </span>
            <span className="text-[10px] text-slate-400 font-mono block truncate">
              {summary.peakRevenueDay ? `${summary.peakRevenueDay.label}` : "None"}
            </span>
          </div>

          {/* Card 6: Net Operating Margin */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              Net Workshop Margin
            </span>
            <span
              className={`text-base sm:text-lg font-black font-mono block ${
                summary.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {formatNpr(summary.netProfit)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono block">
              Less restock ledger spend
            </span>
          </div>
        </div>
      )}

      {/* Main Chart Area */}
      <div className="relative min-h-[300px] w-full pt-2">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-10 rounded-lg">
            <div className="flex items-center space-x-2 text-xs font-mono text-amber-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Synthesizing daily ledger cashflow...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs font-mono flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!isLoading && data.length === 0 && (
          <div className="text-center py-12 text-slate-500 font-mono text-xs space-y-2">
            <ShoppingBag className="w-8 h-8 mx-auto text-slate-600" />
            <p>No receipt transactions found within the selected {daysPeriod}-day period.</p>
          </div>
        )}

        {/* 1. REVENUE AREA CHART */}
        {chartMode === "revenue" && (
          <div className="h-[290px] sm:h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                onClick={handlePointClick}
              >
                <defs>
                  <linearGradient id="revenueAmberGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  fontFamily="monospace"
                  minTickGap={20}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  fontFamily="monospace"
                  tickFormatter={yAxisFormatter}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={summary?.avgDailyRevenue || 0}
                  stroke="#06b6d4"
                  strokeDasharray="4 4"
                  label={{
                    value: `Avg: ${formatNprCompact(summary?.avgDailyRevenue || 0)}`,
                    fill: "#38bdf8",
                    fontSize: 10,
                    position: "insideTopRight",
                    fontFamily: "monospace",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Daily Revenue"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revenueAmberGrad)"
                  activeDot={{ r: 6, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 2. REVENUE VS RESTOCK SPEND COMPARISON CHART */}
        {chartMode === "comparison" && (
          <div className="h-[290px] sm:h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                onClick={handlePointClick}
              >
                <defs>
                  <linearGradient id="compRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="compExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  fontFamily="monospace"
                  minTickGap={20}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  fontFamily="monospace"
                  tickFormatter={yAxisFormatter}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Customer Sales Revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#compRevenueGrad)"
                  activeDot={{ r: 5, fill: "#10b981" }}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Supplier Invoices Spend"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#compExpenseGrad)"
                  activeDot={{ r: 5, fill: "#f43f5e" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 3. RECEIPTS & PARTS VOLUME BAR CHART */}
        {chartMode === "volume" && (
          <div className="h-[290px] sm:h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                onClick={handlePointClick}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  fontFamily="monospace"
                  minTickGap={20}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  fontFamily="monospace"
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={36}
                  wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }}
                />
                <Bar
                  dataKey="receiptCount"
                  name="Sales Receipts Count"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="itemsCount"
                  name="Spare Parts Units Sold"
                  fill="#06b6d4"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 4. AVERAGE TICKET VALUE */}
        {chartMode === "average" && (
          <div className="h-[290px] sm:h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                onClick={handlePointClick}
              >
                <defs>
                  <linearGradient id="avgTicketGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis
                  dataKey="label"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  fontFamily="monospace"
                  minTickGap={20}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  fontFamily="monospace"
                  tickFormatter={yAxisFormatter}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={summary?.avgReceiptValue || 0}
                  stroke="#a78bfa"
                  strokeDasharray="3 3"
                  label={{
                    value: `Avg: ${formatNpr(summary?.avgReceiptValue || 0)}`,
                    fill: "#c4b5fd",
                    fontSize: 10,
                    position: "insideTopRight",
                    fontFamily: "monospace",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="avgReceiptValue"
                  name="Avg Receipt Value"
                  stroke="#818cf8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#avgTicketGrad)"
                  activeDot={{ r: 5, fill: "#818cf8" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Selected Day Inspector Drawer (When clicked on a data point) */}
      {selectedDay && (
        <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <div>
                <span className="font-bold text-white text-xs font-mono uppercase">
                  Receipt Breakdown for {selectedDay.dayOfWeek}, {selectedDay.label} ({selectedDay.date})
                </span>
                <span className="text-[11px] text-slate-400 block font-mono">
                  {selectedDay.receiptCount} sale receipts • {selectedDay.itemsCount} units sold
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">Day's Total</span>
                <span className="text-sm font-extrabold text-amber-400 font-mono">
                  {formatNpr(selectedDay.revenue)}
                </span>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                title="Close day details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {selectedDay.salesReceipts && selectedDay.salesReceipts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
              {selectedDay.salesReceipts.map((sr) => (
                <div
                  key={sr.id}
                  className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col justify-between space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{sr.receipt_number}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                      {sr.payment_method}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <p className="text-slate-200 truncate font-sans font-medium">{sr.customer_name}</p>
                    {sr.motorcycle_model && (
                      <p className="truncate text-slate-400 text-[10px]">{sr.motorcycle_model}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-500">
                      {new Date(sr.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="font-black text-amber-400">{formatNpr(sr.total_amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 font-mono italic">
              No specific sale receipts logged on this date.
            </p>
          )}

          {onViewReceiptsLedger && (
            <div className="pt-2 border-t border-slate-800/80 flex justify-end">
              <button
                onClick={onViewReceiptsLedger}
                className="text-xs font-mono font-bold text-amber-400 hover:text-amber-300 flex items-center space-x-1"
              >
                <span>Open Full Receipts Ledger</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
