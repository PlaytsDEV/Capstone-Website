import { useLayoutEffect } from "react";

let activeLocks = 0;
let previousBodyOverflow = "";

/**
 * Reference-counted body scroll locking hook.
 * Locks body scroll when `isLocked` is true without mutating scrollbar gutters
 * dynamically, preventing layout shifts when modals open or close.
 */
export default function useBodyScrollLock(isLocked) {
  useLayoutEffect(() => {
    if (!isLocked) return;

    if (activeLocks === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    activeLocks++;

    return () => {
      activeLocks--;
      if (activeLocks === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
    };
  }, [isLocked]);
}
