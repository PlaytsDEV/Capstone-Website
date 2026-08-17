import React, { useState, useEffect } from "react";
import { inquiryApi } from "../../../shared/api/inquiryApi.js";
import { ReportChartPanel } from "./shared";
import { ExportButtons, handleCsvExport, handlePdfExport } from "../pages/analyticsTabShared";

/**
 * MarketingSourceReport - Analytics view displaying lead volume and conversion rate by channel.
 * Conforms to the solid, high-contrast Lilycrest DMS Overview design.
 */
export default function MarketingSourceReport() {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoi = async () => {
      try {
        setLoading(true);
        const res = await inquiryApi.getMarketingRoi();
        setReport(Array.isArray(res) ? res : res?.data || []);
      } catch (err) {
        console.error("ROI report fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRoi();
  }, []);

  const exportCsv = () => {
    handleCsvExport(
      report,
      [
        { key: "channel", label: "Marketing Channel" },
        { key: "totalLeads", label: "Total Leads" },
        { key: "viewingsScheduled", label: "Viewings Scheduled" },
        { key: "convertedCount", label: "Converted Tenants" },
        { key: "conversionRate", label: "Conversion Rate (%)" },
      ],
      "marketing_channel_roi",
    );
  };

  const exportPdf = () => {
    handlePdfExport({
      title: "Marketing Acquisition Channel ROI",
      subtitle: "Lead generation and conversion efficiency across channels",
      filename: "marketing-roi-report.pdf",
      reportType: "Marketing",
      sections: [
        {
          title: "Channel Performance Summary",
          type: "table",
          headers: ["Marketing Channel", "Total Leads", "Viewings", "Converted", "Conversion Rate"],
          rows: report.map((item) => ({
            "Marketing Channel": item.channel || "Direct",
            "Total Leads": String(item.totalLeads || 0),
            Viewings: String(item.viewingsScheduled || 0),
            Converted: String(item.convertedCount || 0),
            "Conversion Rate": `${item.conversionRate || 0}%`,
          })),
        },
      ],
    });
  };

  if (loading) {
    return (
      <div className="p-6 bg-card border border-border rounded-[10px] text-xs text-muted-foreground italic">
        Loading marketing analytics...
      </div>
    );
  }

  return (
    <ReportChartPanel
      title="Marketing Acquisition Channel ROI"
      subtitle="Lead generation and conversion efficiency across acquisition channels"
      actions={<ExportButtons onCsv={exportCsv} onPdf={exportPdf} />}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-3">Marketing Channel</th>
              <th className="py-2.5 px-3">Total Leads</th>
              <th className="py-2.5 px-3">Viewings Scheduled</th>
              <th className="py-2.5 px-3">Converted Tenants</th>
              <th className="py-2.5 px-3 text-right">Conversion Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {report.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground italic">
                  No acquisition channel data available.
                </td>
              </tr>
            ) : (
              report.map((item, idx) => (
                <tr key={idx} className="hover:bg-muted/40 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-foreground">{item.channel}</td>
                  <td className="py-2.5 px-3 text-foreground">{item.totalLeads}</td>
                  <td className="py-2.5 px-3 text-foreground">{item.viewingsScheduled}</td>
                  <td className="py-2.5 px-3 font-semibold text-emerald-600 dark:text-emerald-400">
                    {item.convertedCount}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="inline-block px-2 py-0.5 font-bold text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded">
                      {item.conversionRate}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportChartPanel>
  );
}
