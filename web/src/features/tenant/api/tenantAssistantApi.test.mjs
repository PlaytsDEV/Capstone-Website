import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiSource = fs.readFileSync(path.join(here, "tenantAssistantApi.js"), "utf8");

test("tenantAssistantApi exports queryTenantAssistant, streamTenantAssistant, and escalateTenantAssistant", () => {
  assert.match(apiSource, /export const queryTenantAssistant/);
  assert.match(apiSource, /export const streamTenantAssistant/);
  assert.match(apiSource, /export const escalateTenantAssistant/);
  assert.match(apiSource, /export const tenantAssistantApi = \{/);
});

test("queryTenantAssistant targets /chatbot/tenant/query via authFetch", () => {
  assert.match(apiSource, /\/chatbot\/tenant\/query/);
  assert.match(apiSource, /authFetch/);
  assert.match(apiSource, /method:\s*"POST"/);
});

test("streamTenantAssistant targets /chatbot/tenant/stream with Bearer token and text/event-stream", () => {
  assert.match(apiSource, /\/chatbot\/tenant\/stream/);
  assert.match(apiSource, /getFreshToken/);
  assert.match(apiSource, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.match(apiSource, /Accept:\s*"text\/event-stream"/);
  assert.match(apiSource, /response\.body\.getReader\(\)/);
  assert.match(apiSource, /TextDecoder\("utf-8"\)/);
});

test("streamTenantAssistant parses token chunks, widgets, actions, and completion events", () => {
  assert.match(apiSource, /data:\s*/);
  assert.match(apiSource, /onToken/);
  assert.match(apiSource, /onWidget/);
  assert.match(apiSource, /onActions/);
  assert.match(apiSource, /onDone/);
  assert.match(apiSource, /onError/);
});

test("escalateTenantAssistant targets /chatbot/tenant/escalate", () => {
  assert.match(apiSource, /\/chatbot\/tenant\/escalate/);
  assert.match(apiSource, /category/);
  assert.match(apiSource, /priority/);
  assert.match(apiSource, /summary/);
  assert.match(apiSource, /lastBotMessage/);
});
