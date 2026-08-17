import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("PublicChatbotModal defines handleSendMessage and handleOpenWidget before useEffect hooks", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "PublicChatbotModal.jsx"),
    "utf8"
  );
  const modalCode = rawCode.replace(/\r\n/g, "\n");

  const handleSendMessageIndex = modalCode.indexOf("const handleSendMessage = useCallback(");
  const initialPromptEffectIndex = modalCode.indexOf("useEffect(() => {\n    if (initialPrompt && isOpen");

  assert.ok(
    handleSendMessageIndex !== -1,
    "handleSendMessage definition must exist in PublicChatbotModal"
  );
  assert.ok(
    initialPromptEffectIndex !== -1,
    "initialPrompt effect must exist in PublicChatbotModal"
  );
  assert.ok(
    handleSendMessageIndex < initialPromptEffectIndex,
    "handleSendMessage must be declared before initialPrompt useEffect to avoid TDZ ReferenceError"
  );
});

test("PublicChatbotModal configures 15-minute inactivity timeout and 13-minute warning threshold", () => {
  const rawCode = fs.readFileSync(
    path.join(__dirname, "PublicChatbotModal.jsx"),
    "utf8"
  );
  assert.match(rawCode, /INACTIVITY_TIMEOUT_MS\s*=\s*15\s*\*\s*60\s*\*\s*1000/);
  assert.match(rawCode, /WARNING_BEFORE_TIMEOUT_MS\s*=\s*2\s*\*\s*60\s*\*\s*1000/);
  assert.match(rawCode, /showInactivityWarning/);
  assert.match(rawCode, /inactivitySecondsLeft/);
  assert.match(rawCode, /Session Expiring Soon/);
  assert.match(rawCode, /Reset Now/);
  assert.match(rawCode, /Continue/);
});

test("ChatMessageList only displays quick prompts in zero-state (when no user message exists)", () => {
  const rawListCode = fs.readFileSync(
    path.join(__dirname, "ChatMessageList.jsx"),
    "utf8"
  );
  assert.match(rawListCode, /hasUserMessages\s*=\s*messages\.some/);
  assert.match(rawListCode, /showQuickPrompts\s*&&\s*!hasUserMessages\s*&&\s*!isTyping/);
  assert.match(rawListCode, /isLatestAssistant=\{idx === lastAssistantIndex\}/);
});

test("ChatMessageBubble retires older assistant action chips when not latest", () => {
  const rawBubbleCode = fs.readFileSync(
    path.join(__dirname, "ChatMessageBubble.jsx"),
    "utf8"
  );
  assert.match(rawBubbleCode, /isLatestAssistant\s*=\s*true/);
  assert.match(rawBubbleCode, /if\s*\(!isLatestAssistant\)\s*return;/);
  assert.match(rawBubbleCode, /isLatestAssistant\s*\?\s*"opacity-100"\s*:\s*"opacity-45 pointer-events-none select-none"/);
});


