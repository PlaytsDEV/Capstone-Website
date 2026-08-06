import { JSDOM } from "jsdom";

// Registers a minimal jsdom document/window as Node globals so React DOM
// (via react-dom/client) can render into a real DOM tree under the native
// `node --test` runner, which has no browser environment of its own.
// Import this once, before rendering anything, in any component-mount test.
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

const { window } = dom;

const copyProps = (source, target) => {
  const descriptors = Object.getOwnPropertyNames(source)
    .filter((prop) => !(prop in target))
    .reduce((acc, prop) => ({
      ...acc,
      [prop]: Object.getOwnPropertyDescriptor(source, prop),
    }), {});
  Object.defineProperties(target, descriptors);
};

globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, "navigator", {
  value: window.navigator,
  configurable: true,
});
copyProps(window, globalThis);
