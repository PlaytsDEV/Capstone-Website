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

// A protected read that fails must settle on a definite, readable state. The
// original implementation only ever set the object URL, so a failed read left
// the skeleton pulsing forever — indistinguishable from a slow network and
// impossible for an admin to act on.
test("a failed protected attachment read settles on a controlled error state", () => {
  assert.match(page, /data-attachment-state="error"/);
  assert.match(page, /data-attachment-state="loading"/);
  assert.match(page, /data-attachment-state="ready"/);
  assert.match(page, /Attachment unavailable/);
  // The error branch must render before the loading branch, otherwise a
  // failure would still fall through to the pulsing skeleton.
  assert.ok(
    page.indexOf('data-attachment-state="error"')
      < page.indexOf('data-attachment-state="loading"'),
    "the error state must take precedence over the loading skeleton",
  );
  // The failure path must be reachable: the catch has to record it.
  assert.match(page, /\.catch\(\(\) => \{[\s\S]*setStatus\("error"\)/);
});

test("the failed attachment state offers a retry rather than a dead tile", () => {
  assert.match(page, /setAttempt\(\(value\) => value \+ 1\)/);
  assert.match(page, /\[attachment, attempt\]/);
});

test("administrative close remains distinct from tenant-confirmed resolution", () => {
  assert.match(page, />Close Conversation</);
  assert.match(page, /This is separate from tenant-confirmed resolution/);
  assert.match(page, /!\["all", "resolved"\]\.includes\(opt\.value\)/);
  assert.match(page, /Please confirm whether this resolved your concern/);
});
