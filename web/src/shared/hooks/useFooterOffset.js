import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * useFooterOffset
 *
 * Dynamically computes the visible overlap of the page <footer> relative to the viewport
 * using IntersectionObserver and MutationObserver.
 * Resilient to React.lazy() / Suspense code-splitting: continuously listens for when the
 * footer element mounts into the DOM and attaches the high-precision intersection observer.
 *
 * @param {number} defaultOffset - Base bottom offset in px when footer is not in view (default: 24)
 * @param {number} buffer - Extra clearance buffer in px above the footer top border (default: 20)
 * @param {Object} [locationOverride] - Optional router location override for standalone testing
 * @returns {number} The computed bottom offset in pixels
 */
export function useFooterOffset(defaultOffset = 24, buffer = 20, locationOverride = null) {
  const [offset, setOffset] = useState(defaultOffset);
  let location = locationOverride;
  if (locationOverride === null || locationOverride === undefined) {
    try {
      location = useLocation();
    } catch {
      location = null;
    }
  }

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    let intersectionObserver = null;
    let mutationObserver = null;
    let isCleanedUp = false;

    // Granular 100-step thresholds for smooth continuous docking
    const thresholds = Array.from({ length: 101 }, (_, i) => i / 100);

    const recalculateOffset = (footerEl) => {
      if (!footerEl || isCleanedUp) return;
      const rect = footerEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const visibleHeight = Math.max(0, viewportHeight - rect.top);
      if (visibleHeight > 0) {
        setOffset(Math.max(defaultOffset, Math.round(visibleHeight + buffer)));
      } else {
        setOffset(defaultOffset);
      }
    };

    const attachToFooter = (footerEl) => {
      if (!footerEl || isCleanedUp) return;

      if (intersectionObserver) {
        intersectionObserver.disconnect();
      }

      intersectionObserver = new IntersectionObserver(
        (entries) => {
          if (isCleanedUp) return;
          const entry = entries[0];
          if (entry && entry.isIntersecting) {
            const visibleHeight = entry.intersectionRect ? entry.intersectionRect.height : 0;
            setOffset(Math.max(defaultOffset, Math.round(visibleHeight + buffer)));
          } else {
            setOffset(defaultOffset);
          }
        },
        { threshold: thresholds }
      );

      intersectionObserver.observe(footerEl);
    };

    const handleResize = () => {
      const footerEl = document.querySelector("footer");
      if (footerEl) {
        recalculateOffset(footerEl);
      }
    };

    window.addEventListener("resize", handleResize, { passive: true });

    // Try finding footer immediately
    const existingFooter = document.querySelector("footer");
    if (existingFooter) {
      attachToFooter(existingFooter);
    } else {
      // If footer is lazy-loaded (React.lazy / Suspense), observe DOM mutations until footer is mounted
      if (typeof MutationObserver !== "undefined") {
        mutationObserver = new MutationObserver(() => {
          const lazyFooter = document.querySelector("footer");
          if (lazyFooter) {
            attachToFooter(lazyFooter);
            if (mutationObserver) {
              mutationObserver.disconnect();
              mutationObserver = null;
            }
          }
        });

        mutationObserver.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
        });
      }
    }

    return () => {
      isCleanedUp = true;
      window.removeEventListener("resize", handleResize);
      if (intersectionObserver) {
        intersectionObserver.disconnect();
        intersectionObserver = null;
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
    };
  }, [defaultOffset, buffer, location?.pathname, location?.search]);

  return offset;
}

export default useFooterOffset;
