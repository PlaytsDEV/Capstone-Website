import "./domMountSetup.mjs";
import { act } from "react";
import { createRoot } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Minimal real-DOM mount helper for component tests, built directly on
// react-dom/client + jsdom rather than pulling in a full component test
// framework — this repo's test runner is plain `node --test`, and the
// handful of mount assertions these tests need (rendered markup, event
// handlers firing, re-renders on prop change) don't need more than this.
export const mount = (element) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    rerender(next) {
      act(() => {
        root.render(next);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};
