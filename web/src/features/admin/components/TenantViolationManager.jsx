import React, { useState, useEffect } from "react";
import { billingApi } from "../../../shared/api/billingApi.js";

/**
 * TenantViolationManager - Incident logging, photo evidence, warning count tracking.
 */
export default function TenantViolationManager() {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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
      await billingApi.logViolation(formData);
      setShowForm(false);
      setFormData({ tenantId: "", violationType: "noise_curfew", description: "", evidenceUrl: "", penaltyAmount: 0 });
      await fetchViolations();
    } catch (err) {
      alert(err.message || "Failed to log violation.");
    }
  };

  if (loading) {
    return <div className="p-4 text-xs text-gray-500 italic">Loading tenant violation logs...</div>;
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Tenant Violation & Warning Log</h3>
          <p className="text-xs text-gray-500 font-normal">Track dormitory rule infractions, warning counts, and photo evidence.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700"
        >
          {showForm ? "Cancel" : "+ Log Violation"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Tenant ID / Name</label>
              <input
                type="text"
                required
                value={formData.tenantId}
                onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                placeholder="Enter Tenant ID..."
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Violation Type</label>
              <select
                value={formData.violationType}
                onChange={(e) => setFormData({ ...formData, violationType: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded"
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
            <label className="block font-semibold text-gray-700 mb-1">Incident Description</label>
            <textarea
              rows={2}
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide details about the infraction..."
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Evidence Photo URL (Optional)</label>
              <input
                type="url"
                value={formData.evidenceUrl}
                onChange={(e) => setFormData({ ...formData, evidenceUrl: e.target.value })}
                placeholder="https://example.com/photo.jpg"
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Penalty Amount (₱)</label>
              <input
                type="number"
                min="0"
                value={formData.penaltyAmount}
                onChange={(e) => setFormData({ ...formData, penaltyAmount: Number(e.target.value) })}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700"
            >
              Save Violation Record
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 font-semibold">
              <th className="p-2.5">Date Logged</th>
              <th className="p-2.5">Tenant</th>
              <th className="p-2.5">Violation Type</th>
              <th className="p-2.5">Description</th>
              <th className="p-2.5">Penalty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {violations.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-400 italic">
                  No violations recorded.
                </td>
              </tr>
            ) : (
              violations.map((v) => (
                <tr key={v._id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-2.5 text-gray-500">{new Date(v.createdAt).toLocaleDateString()}</td>
                  <td className="p-2.5 font-bold text-gray-900">{v.tenantName || v.tenantId}</td>
                  <td className="p-2.5 font-semibold text-amber-800 uppercase text-[10px]">{v.violationType?.replace(/_/g, " ")}</td>
                  <td className="p-2.5 text-gray-700">{v.description}</td>
                  <td className="p-2.5 font-semibold text-red-600">₱{v.penaltyAmount || 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
