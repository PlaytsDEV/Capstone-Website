import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("PublicChatbotModal defines handleSendMessage and handleOpenWidget before useEffect hooks", () => {
  const modalCode = fs.readFileSync(
    path.join(__dirname, "PublicChatbotModal.jsx"),
    "utf8"
  );

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
