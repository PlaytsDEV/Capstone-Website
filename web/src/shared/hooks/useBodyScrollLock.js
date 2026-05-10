import { useLayoutEffect } from "react";

/**
 * Lock body scroll when `isLocked` is true.
 * Keeps the scrollbar gutter stable so fixed headers, dropdowns, and centered
 * modals do not visually jump when the page scrollbar is removed.
 */
export default function useBodyScrollLock(isLocked) {
  useLayoutEffect(() => {
    if (!isLocked) return;

    const scrollbarW = Math.max(
      0,
      window.innerWidth - document.documentElement.clientWidth,
    );
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlScrollbarGutter =
      document.documentElement.style.scrollbarGutter;
    const previousBodyScrollbarGutter = document.body.style.scrollbarGutter;
    const previousScrollbarCompensation = document.documentElement.style
      .getPropertyValue("--scrollbar-compensation");

    document.documentElement.style.scrollbarGutter = "stable";
    document.body.style.scrollbarGutter = "stable";
    document.documentElement.style.setProperty(
      "--scrollbar-compensation",
      `${scrollbarW}px`,
    );
    document.body.style.overflow = "hidden";

    const scrollContainers = Array.from(
      document.querySelectorAll(".tenant-layout-main, .tenant-content"),
    );
    const previousContainerStyles = scrollContainers.map((el) => ({
      el,
      overflow: el.style.overflow,
      scrollbarGutter: el.style.scrollbarGutter,
    }));
    scrollContainers.forEach((el) => {
      el.style.scrollbarGutter = "stable";
      el.style.overflow = "hidden";
    });

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.scrollbarGutter =
        previousHtmlScrollbarGutter;
      document.body.style.scrollbarGutter = previousBodyScrollbarGutter;
      if (previousScrollbarCompensation) {
        document.documentElement.style.setProperty(
          "--scrollbar-compensation",
          previousScrollbarCompensation,
        );
      } else {
        document.documentElement.style.removeProperty(
          "--scrollbar-compensation",
        );
      }
      previousContainerStyles.forEach(({ el, overflow, scrollbarGutter }) => {
        el.style.overflow = overflow;
        el.style.scrollbarGutter = scrollbarGutter;
      });
    };
  }, [isLocked]);
}
