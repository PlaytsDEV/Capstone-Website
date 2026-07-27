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
        Multiple Pending Invoices Detected
      </div>
      <div>
        Under Lilycrest billing policy, payments are applied in strict priority sequence:
        <ol style={{ margin: "0.5rem 0 0 1.25rem", padding: 0 }}>
          <li>Oldest overdue utility bills</li>
          <li>Oldest overdue rent invoices</li>
          <li>Current month utility bills</li>
          <li>Current month rent invoices</li>
        </ol>
      </div>
    </div>
  );
}
