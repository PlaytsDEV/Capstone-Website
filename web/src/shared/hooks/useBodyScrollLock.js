import { useLayoutEffect } from "react";

let activeLocks = 0;
let previousBodyOverflow = "";
let previousBodyPaddingRight = "";

/**
 * Reference-counted body scroll locking hook.
 * Locks body scroll when `isLocked` is true without causing layout shift
 * when modals open and close.
 */
export default function useBodyScrollLock(isLocked) {
  useLayoutEffect(() => {
    if (!isLocked || typeof document === "undefined") return;

    if (activeLocks === 0) {
      previousBodyOverflow = document.body.style.overflow;
      previousBodyPaddingRight = document.body.style.paddingRight;

      // Check if browser natively supports and activates scrollbar-gutter
      const hasStableGutter =
        typeof window !== "undefined" &&
        typeof window.CSS !== "undefined" &&
        CSS.supports &&
        CSS.supports("scrollbar-gutter", "stable");

      // For browsers without native scrollbar-gutter support, compensate scrollbar width
      if (!hasStableGutter && typeof window !== "undefined") {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
          const currentPadding =
            parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
          document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
        }
      }

      document.body.style.overflow = "hidden";
    }
    activeLocks++;

    return () => {
      activeLocks--;
      if (activeLocks === 0) {
        document.body.style.overflow = previousBodyOverflow;
        document.body.style.paddingRight = previousBodyPaddingRight;
      }
    };
  }, [isLocked]);
}
