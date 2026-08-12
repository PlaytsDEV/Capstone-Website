import React, { useState, useEffect } from "react";
import { inquiryApi } from "../../../shared/api/inquiryApi.js";

/**
 * MarketingSourceReport - Analytics view displaying lead volume and conversion rate by channel.
 */
export default function MarketingSourceReport() {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoi = async () => {
      try {
        setLoading(true);
        const res = await inquiryApi.getMarketingRoi();
        setReport(res.data || []);
      } catch (err) {
        console.error("ROI report fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRoi();
  }, []);

  if (loading) {
    return <div className="p-4 text-xs text-gray-500 italic">Loading marketing analytics...</div>;
  }

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900">Marketing Acquisition Channel ROI</h3>
        <p className="text-xs text-gray-500">Lead generation performance across acquisition channels.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 font-semibold">
              <th className="p-2.5">Marketing Channel</th>
              <th className="p-2.5">Total Leads</th>
              <th className="p-2.5">Viewings Scheduled</th>
              <th className="p-2.5">Converted Tenants</th>
              <th className="p-2.5">Conversion Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-400 italic">
                  No acquisition channel data available.
                </td>
              </tr>
            ) : (
              report.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="p-2.5 font-bold text-gray-800">{item.channel}</td>
                  <td className="p-2.5">{item.totalLeads}</td>
                  <td className="p-2.5">{item.viewingsScheduled}</td>
                  <td className="p-2.5 font-semibold text-emerald-700">{item.convertedCount}</td>
                  <td className="p-2.5">
                    <span className="px-2 py-0.5 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded">
                      {item.conversionRate}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
