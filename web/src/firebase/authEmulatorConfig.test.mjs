import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthEmulatorConfig } from "./authEmulatorConfig.js";

test("accepts only a loopback emulator paired with a demo project", () => {
  assert.equal(
    resolveAuthEmulatorConfig({
      url: "http://127.0.0.1:9099",
      projectId: "demo-lilycrest-qa",
    }),
    "http://127.0.0.1:9099",
  );
});

test("returns null when emulator mode is not configured", () => {
  assert.equal(resolveAuthEmulatorConfig({ url: "", projectId: "live-project" }), null);
});

test("refuses non-demo projects and non-loopback URLs", () => {
  assert.throws(() => resolveAuthEmulatorConfig({
    url: "http://127.0.0.1:9099",
    projectId: "live-project",
  }));
  assert.throws(() => resolveAuthEmulatorConfig({
    url: "https://qa.example.com:9099",
    projectId: "demo-lilycrest-qa",
  }));
});

