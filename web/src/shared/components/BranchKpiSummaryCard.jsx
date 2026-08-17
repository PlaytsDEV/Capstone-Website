import { Building2, TrendingUp, Users, DollarSign, ShieldCheck } from "lucide-react";

/**
 * Branch Financial KPI & Occupancy Yield Card (Scenario 6)
 *
 * @param {Object} props
 * @param {string} [props.branchName] - Branch name ("Main" | "Annex" | "All Branches")
 * @param {number} [props.occupancyRate] - Occupancy percentage (0-100)
 * @param {number} [props.revPOB] - Revenue per occupied bed (₱)
 * @param {number} [props.collectionEfficiency] - Collection efficiency percentage (0-100)
 * @param {number} [props.netRevenue] - Net branch revenue (₱)
 * @param {string} [props.className] - Container CSS overrides
 */
export default function BranchKpiSummaryCard({
  branchName = "All Branches",
  occupancyRate = 0,
  revPOB = 0,
  collectionEfficiency = 0,
  netRevenue = 0,
  className = "",
}) {
  return (
    <div className={`p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm space-y-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 cursor-default ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-base text-slate-900 dark:text-white">{branchName}</h3>
            <p className="text-xs text-slate-500">Financial Ledger & Yield Summary</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-transparent text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" /> Isolated Ledger
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-sm">
        <div className="space-y-0.5">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Occupancy Rate
          </span>
          <p className="font-bold text-slate-900 dark:text-white">{occupancyRate}%</p>
        </div>

        <div className="space-y-0.5">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> RevPOB
          </span>
          <p className="font-bold text-slate-900 dark:text-white">₱{revPOB.toLocaleString()}</p>
        </div>

        <div className="space-y-0.5">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" /> Collection Eff.
          </span>
          <p className="font-bold text-slate-900 dark:text-white">{collectionEfficiency}%</p>
        </div>

        <div className="space-y-0.5">
          <span className="text-xs text-slate-500">Net Branch Rev.</span>
          <p className="font-bold text-emerald-600 dark:text-emerald-400">₱{netRevenue.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
