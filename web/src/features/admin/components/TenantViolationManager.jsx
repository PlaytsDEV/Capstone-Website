import React, { useState, useEffect, useMemo } from "react";
import { AlertTriangle, Plus, RefreshCw, Search, ExternalLink, X, CheckCircle2 } from "lucide-react";
import { billingApi } from "../../../shared/api/billingApi.js";

const getInitials = (name) => {
  if (!name) return "TN";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export default function TenantViolationManager() {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    tenantId: "",
    violationType: "noise_curfew",
    description: "",
    evidenceUrl: "",
    penaltyAmount: 0,
  });

  const fetchViolations = async () => {
    try {
      setLoading(true);
      const res = await billingApi.getViolations();
      setViolations(res.data || []);
    } catch (err) {
      console.error("Violations fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViolations();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await billingApi.logViolation(formData);
      setShowForm(false);
      setFormData({ tenantId: "", violationType: "noise_curfew", description: "", evidenceUrl: "", penaltyAmount: 0 });
      await fetchViolations();
    } catch (err) {
      alert(err.message || "Failed to log violation.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredViolations = useMemo(() => {
    if (!searchQuery.trim()) return violations;
    const q = searchQuery.toLowerCase();
    return violations.filter((v) => {
      const name = String(v.tenantName || v.tenantId || "").toLowerCase();
      const type = String(v.violationType || "").toLowerCase();
      const desc = String(v.description || "").toLowerCase();
      return name.includes(q) || type.includes(q) || desc.includes(q);
    });
  }, [violations, searchQuery]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-card-foreground">
            <AlertTriangle size={18} className="text-amber-500" />
            Tenant Violation & Warning Log
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Track dormitory rule infractions, warning counts, penalty fees, and photo evidence.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center w-full sm:w-56">
            <Search size={14} className="absolute left-2.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search violation or tenant..."
              className="w-full h-8 rounded-lg border border-border bg-card pl-8 pr-7 text-xs font-medium text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-200"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 p-0.5 rounded-full text-muted-foreground hover:text-card-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={fetchViolations}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground shadow-xs transition hover:bg-muted active:scale-[0.98] disabled:opacity-50"
            title="Refresh tenant violation logs"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-muted-foreground" : "text-muted-foreground"} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 active:scale-[0.98] dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            title="Log new tenant rule infraction"
          >
            {showForm ? <X size={14} /> : <Plus size={14} className="text-white dark:text-slate-950" />}
            {showForm ? "Cancel" : "Log Violation"}
          </button>
        </div>
      </div>

      {/* Incident Form Modal / Panel */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3.5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-card-foreground">Record New Rule Infraction</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-card-foreground mb-1">Tenant ID or Full Name</label>
              <input
                type="text"
                required
                value={formData.tenantId}
                onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                placeholder="Enter Tenant ID or Name..."
                className="w-full h-8 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-card-foreground mb-1">Violation Category</label>
              <select
                value={formData.violationType}
                onChange={(e) => setFormData({ ...formData, violationType: e.target.value })}
                className="w-full h-8 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
              >
                <option value="noise_curfew">Noise / Curfew Violation</option>
                <option value="unauthorized_guest">Unauthorized Guest</option>
                <option value="smoking_vaping">Smoking / Vaping</option>
                <option value="appliance_unauthorized">Unauthorized Heavy Appliance</option>
                <option value="property_damage">Property Damage</option>
                <option value="cleanliness_sanitation">Cleanliness & Sanitation</option>
              </select>
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-card-foreground mb-1">Incident Description & Evidence Notes</label>
            <textarea
              rows={2}
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide specific details about the infraction..."
              className="w-full rounded-lg border border-border bg-card p-2.5 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-card-foreground mb-1">Photo Evidence URL (Optional)</label>
              <input
                type="url"
                value={formData.evidenceUrl}
                onChange={(e) => setFormData({ ...formData, evidenceUrl: e.target.value })}
                placeholder="https://example.com/photo.jpg"
                className="w-full h-8 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-card-foreground mb-1">Penalty Fee Amount (₱)</label>
              <input
                type="number"
                min="0"
                value={formData.penaltyAmount}
                onChange={(e) => setFormData({ ...formData, penaltyAmount: Number(e.target.value) })}
                placeholder="0.00"
                className="w-full h-8 rounded-lg border border-border bg-card px-3 text-xs font-medium text-card-foreground focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-8 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-card-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white shadow-xs hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {submitting ? "Saving..." : "Submit Violation Record"}
            </button>
          </div>
        </form>
      )}

      {/* Violations Data Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-background">
              <tr>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Logged Date</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Tenant Name</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Category</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Description</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Evidence</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.10em] text-foreground/80 dark:text-slate-300">Penalty Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 bg-card">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground italic">
                    Loading violation records...
                  </td>
                </tr>
              ) : filteredViolations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center justify-center text-muted-foreground">
                      <CheckCircle2 size={26} className="text-emerald-600 mb-2" />
                      <p className="font-bold text-card-foreground">No violations recorded</p>
                      <p className="mt-0.5 text-[11px]">
                        {searchQuery ? `No records match "${searchQuery}"` : "Zero tenant rule infractions recorded."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredViolations.map((v) => (
                  <tr key={v._id} className="group transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">
                      {new Date(v.createdAt).toLocaleDateString("en-PH")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-bold shadow-xs dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
                          {getInitials(v.tenantName || v.tenantId)}
                        </div>
                        <p className="font-bold text-card-foreground">{v.tenantName || v.tenantId || "Tenant"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
                        {v.violationType?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-card-foreground font-medium max-w-xs truncate">
                      {v.description}
                    </td>
                    <td className="px-4 py-3">
                      {v.evidenceUrl ? (
                        <a
                          href={v.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                          title="View photo evidence in new tab"
                        >
                          <ExternalLink size={12} /> View Photo
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">
                      ₱{Number(v.penaltyAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
