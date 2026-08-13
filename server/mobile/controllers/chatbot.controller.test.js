const fs = require("fs");
const path = require("path");

describe("vendored mobile chatbot live-chat — cross-tenant ownership guard", () => {
  const source = fs.readFileSync(path.join(__dirname, "chatbot.controller.js"), "utf8");

  test("getOwnedLiveChat rejects sessions that don't belong to the requesting user", () => {
    const fn = source.split("function getOwnedLiveChat(sessionId, userId) {")[1]?.split("\nfunction ")[0] || "";
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).toMatch(/liveChat\.user_id !== userId/);
  });

  test("getLiveStatus resolves the session through the ownership guard, not the raw queue", () => {
    const fn = source.split("async function getLiveStatus(req, res) {")[1]?.split("\nasync function ")[0] || "";
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).toMatch(/getOwnedLiveChat\(/);
    expect(fn).not.toMatch(/liveChatQueue\.get\(/);
  });

  test("sendMessage's active-live-chat check is also ownership-guarded (session-id integrity)", () => {
    const fn = source.split("async function sendMessage(req, res) {")[1]?.split("\nasync function ")[0] || "";
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).toMatch(/getOwnedLiveChat\(sessionId, userId\)/);
  });
});
