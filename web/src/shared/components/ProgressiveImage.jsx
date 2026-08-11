import { useState, useRef } from "react";
import { getOptimizedUrl } from "../utils/imageOptimizer";

/**
 * ProgressiveImage
 *
 * A drop-in replacement for <img> that:
 *  - Shows a shimmer skeleton while the image is loading
 *  - Applies a fade-in on reveal (no layout shift)
 *  - Gracefully falls back to a neutral placeholder on error
 *  - Accepts `priority` prop to switch between eager/lazy loading
 *  - Passes through all standard img attributes
 *
 * @example
 * // Above-the-fold (e.g. hero card) — load immediately
 * <ProgressiveImage src={room.images[0]} alt={room.title} priority />
 *
 * // Below-the-fold — lazy load (default)
 * <ProgressiveImage src={doc.url} alt={doc.label} className="w-full h-full object-cover" />
 */
export function ProgressiveImage({
  src,
  alt = "",
  className = "",
  style = {},
  priority = false,
  optimizerOpts = {},
  fallbackLabel,
  ...rest
}) {
  const [status, setStatus] = useState("loading"); // "loading" | "loaded" | "error"
  const imgRef = useRef(null);

  const optimizedSrc = getOptimizedUrl(src, optimizerOpts);

  // ── Skeleton shimmer ───────────────────────────────────────────────────────
  const skeletonStyle = {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(90deg, var(--skeleton-base, #e2e8f0) 25%, var(--skeleton-shine, #f1f5f9) 50%, var(--skeleton-base, #e2e8f0) 75%)",
    backgroundSize: "200% 100%",
    animation: "progressiveImageShimmer 1.4s infinite",
    borderRadius: "inherit",
    transition: "opacity 0.3s ease",
    opacity: status === "loaded" ? 0 : 1,
    pointerEvents: "none",
    zIndex: 1,
  };

  // ── Error fallback ─────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--skeleton-base, #e2e8f0)",
          color: "var(--lp-text-muted, #94a3b8)",
          fontSize: "12px",
          fontWeight: 500,
          ...style,
        }}
        aria-label={alt}
        role="img"
      >
        {fallbackLabel || alt || "Image unavailable"}
      </div>
    );
  }

  return (
    <div
      style={{ position: "relative", overflow: "hidden", ...style }}
      className={className}
    >
      {/* Shimmer skeleton — visible until image loads */}
      <div style={skeletonStyle} aria-hidden="true" />

      {/* Actual image */}
      <img
        ref={imgRef}
        src={optimizedSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchpriority={priority ? "high" : "auto"}
        decoding="async"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "inherit",
          objectPosition: "inherit",
          opacity: status === "loaded" ? 1 : 0,
          transition: "opacity 0.4s ease",
          display: "block",
        }}
        {...rest}
      />

      {/* Global shimmer keyframe — injected once */}
      <style>{`
        @keyframes progressiveImageShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export default ProgressiveImage;
