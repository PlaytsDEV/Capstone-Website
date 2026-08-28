import React from "react";
import { AlertTriangle } from "lucide-react";

export default function MultiBillPriorityBanner({ bills = [] }) {
  if (!bills || bills.length <= 1) return null;

  return (
    <div style={{
      backgroundColor: "#fffbeb",
      border: "1px solid #fcd34d",
      borderRadius: "8px",
      padding: "0.875rem 1rem",
      marginBottom: "1rem",
      color: "#92400e",
      fontSize: "0.875rem"
    }}>
      <div style={{ fontWeight: 600, marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "6px" }}>
        <AlertTriangle size={16} strokeWidth={2} style={{ color: "#d97706" }} />
        Multiple Pending Statements Detected
      </div>
      <div>
        Under Lilycrest billing policy, payments are applied in strict priority sequence:
        <ol style={{ margin: "0.5rem 0 0.5rem 1.25rem", padding: 0 }}>
          <li>Oldest overdue utility bills</li>
          <li>Oldest overdue rent statements</li>
          <li>Current month utility bills</li>
          <li>Current month rent statements</li>
        </ol>
        <div style={{ fontSize: "0.8125rem", color: "#b45309", borderTop: "1px dashed #fde68a", paddingTop: "0.5rem", marginTop: "0.5rem" }}>
          <strong>Policy Note:</strong> Overdue items are past their original due dates and accrue daily late penalty fees (₱50/day after a 1-day grace period). Always check statement deadlines to settle past-due items promptly.
        </div>
      </div>
    </div>
  );
}
