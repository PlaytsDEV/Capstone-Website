import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("./AdminChatPage.jsx", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../../../shared/api/chatApi.js", import.meta.url), "utf8");

test("admin chat uploads through the authenticated conversation-scoped API", () => {
  assert.match(api, /uploadAttachment:[\s\S]*FormData[\s\S]*\/chat\/admin\/conversations\/\$\{conversationId\}\/attachments/);
  assert.match(page, /chatApi\.uploadAttachment\(selectedConversation\.id, item\.file\)/);
  assert.doesNotMatch(page, /uploadToFirebaseStorage/);
});

test("chat attachment reads use protectedFetch rather than public storage URLs", () => {
  assert.match(api, /getAttachmentBlob:[\s\S]*protectedFetch\(url\)/);
  assert.match(page, /ProtectedChatImage/);
  assert.match(page, /handleDownloadAttachment/);
  assert.doesNotMatch(page, /href=\{doc\.url \|\| doc\.fileUrl\}/);
});

test("administrative close remains distinct from tenant-confirmed resolution", () => {
  assert.match(page, />Close Conversation</);
  assert.match(page, /This is separate from tenant-confirmed resolution/);
  assert.match(page, /!\["all", "resolved"\]\.includes\(opt\.value\)/);
  assert.match(page, /Please confirm whether this resolved your concern/);
});
