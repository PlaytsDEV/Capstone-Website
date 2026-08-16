import React from "react";

/**
 * SpotlightCard — high-performance solid card container.
 * Clean 1px solid var(--border) surface adhering strictly to Lilycrest DMS invariants.
 */
function SpotlightCard({
  children,
  className = "",
  style = {},
  ...props
}) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "16px",
        border: "1px solid var(--border, rgba(0,0,0,0.08))",
        backgroundColor: "var(--card, #ffffff)",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export default SpotlightCard;
