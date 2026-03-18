import React from "react";
import { Ticket } from "lucide-react";

/**
 * VisitPassEmpty — placeholder shown when no visit is scheduled yet.
 * Rendered in the right column of the dashboard grid.
 */
export default function VisitPassEmpty() {
  return (
    <div style={S.card}>
      <div style={S.iconWrap}>
        <Ticket size={32} color="#CBD5E1" strokeWidth={1.5} />
      </div>
      <p style={S.text}>
        Your visit pass will appear here once your visit is scheduled
      </p>
    </div>
  );
}

const S = {
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    border: "2px dashed #E2E8F0",
    borderRadius: 14,
    padding: "36px 24px",
    background: "#FAFBFC",
    flex: 1,
    height: "100%",
    boxSizing: "border-box",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "#F1F5F9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  text: {
    fontSize: 13,
    color: "#94A3B8",
    lineHeight: 1.5,
    margin: 0,
    maxWidth: 180,
  },
};
