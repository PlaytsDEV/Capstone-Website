import { useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

const SCROLL_RATIO = 0.7;
const EDGE = 80;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function FormScrollArrows() {
  const scrollerRef = useRef(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [isLong, setIsLong] = useState(false);

  useEffect(() => {
    const scroller =
      document.querySelector(".tenant-content") ?? document.documentElement;
    scrollerRef.current = scroller;

    const update = () => {
      const scrollTop =
        scroller === document.documentElement
          ? window.scrollY
          : scroller.scrollTop;
      const { scrollHeight, clientHeight } = scroller;

      setIsLong(scrollHeight > clientHeight + 100);
      setCanScrollUp(scrollTop > EDGE);
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - EDGE);
    };

    update();

    const target =
      scroller === document.documentElement ? window : scroller;
    target.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });

    return () => {
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scroll = (dir) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const amount = scroller.clientHeight * SCROLL_RATIO * dir;
    const behavior = prefersReducedMotion() ? "instant" : "smooth";
    if (scroller === document.documentElement) {
      window.scrollBy({ top: amount, behavior });
    } else {
      scroller.scrollBy({ top: amount, behavior });
    }
  };

  if (!isLong) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <ArrowBtn
        dir={-1}
        label="Scroll up"
        active={canScrollUp}
        onClick={() => scroll(-1)}
      >
        <ChevronUp size={15} />
      </ArrowBtn>
      <ArrowBtn
        dir={1}
        label="Scroll down"
        active={canScrollDown}
        onClick={() => scroll(1)}
      >
        <ChevronDown size={15} />
      </ArrowBtn>
    </div>
  );
}

function ArrowBtn({ label, active, onClick, children }) {
  const [hovered, setHovered] = useState(false);

  const base = {
    width: 30,
    height: 30,
    borderRadius: 7,
    border: "1px solid var(--border-subtle, #E2E8F0)",
    background: hovered && active
      ? "var(--bg-hover, #F1F5F9)"
      : "var(--bg-card, #ffffff)",
    color: active
      ? "var(--text-muted, #64748B)"
      : "var(--border-subtle, #CBD5E1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: active ? "pointer" : "default",
    opacity: active ? 1 : 0.35,
    transition: "background 0.15s, opacity 0.2s, color 0.15s",
    boxShadow: "0 1px 6px rgba(0,0,0,0.09)",
    padding: 0,
    outline: "none",
    flexShrink: 0,
  };

  return (
    <button
      type="button"
      aria-label={label}
      disabled={!active}
      onClick={active ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={base}
    >
      {children}
    </button>
  );
}
