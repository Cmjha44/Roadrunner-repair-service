import React, { useState, useEffect } from "react";
import { History, ArrowDownRight, ArrowUpRight, Wrench, Package, RefreshCw } from "lucide-react";
import { StockMovement } from "../types.ts";
import { formatNpr } from "../utils/currency.ts";

export const StockMovementsLog: React.FC = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMovements = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/movements?limit=100");
      const json = await res.json();
      if (json.movements) {
        setMovements(json.movements);
      }
    } catch (err) {
      console.error("Failed to fetch movements:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white font-mono flex items-center">
            <History className="w-5 h-5 mr-2 text-amber-400" />
            Stock Movement &amp; Workshop Usage Audit Log
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable audit trail of all part restocks from receipts and mechanic withdrawals for repair
            jobs.
          </p>
        </div>

        <button
          onClick={fetchMovements}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="Refresh Log"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Part Name</th>
                <th className="py-3 px-3 text-center">Movement</th>
                <th className="py-3 px-3 text-center">Balance After</th>
                <th className="py-3 px-4">Reason / Reference</th>
                <th className="py-3 px-4 text-right">Unit Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-mono">
                    Loading movements...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No stock movements recorded yet.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const isPositive = m.delta > 0;
                  return (
                    <tr key={m.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="py-3 px-4 font-bold text-white">{m.part_name}</td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-xs ${
                            isPositive
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-red-950 text-red-400 border border-red-800"
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3 mr-1" />
                          )}
                          {isPositive ? `+${m.delta}` : m.delta}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-white text-sm">
                        {m.quantity_after}
                      </td>

                      <td className="py-3 px-4 text-slate-300">
                        <span className="flex items-center">
                          {m.type === "JOB_USAGE" ? (
                            <Wrench className="w-3.5 h-3.5 mr-1 text-amber-400 shrink-0" />
                          ) : (
                            <Package className="w-3.5 h-3.5 mr-1 text-sky-400 shrink-0" />
                          )}
                          {m.reason}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        {m.unit_cost ? formatNpr(m.unit_cost) : "—"}
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
};
