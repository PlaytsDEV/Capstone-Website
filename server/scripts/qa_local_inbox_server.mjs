import crypto from "node:crypto";
import express from "express";
import { readFixtureDefinitions } from "../services/qaFixtureService.js";
import { resolveQaLocalInbox } from "../services/email/qaLocalEmailTransport.js";
import { loadQaEnvironment } from "../utils/qaEnvironment.js";

loadQaEnvironment();
const inbox = resolveQaLocalInbox();
if (!inbox) throw new Error("QA local inbox is not configured.");
const allowedRecipients = new Map(readFixtureDefinitions().map((entry) => [entry.email, entry.name]));
const messages = [];
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  if (req.headers.authorization !== `Bearer ${inbox.token}`) return res.status(401).json({ error: "unauthorized" });
  next();
});
app.post("/messages", (req, res) => {
  const recipients = (Array.isArray(req.body?.to) ? req.body.to : [req.body?.to])
    .map((value) => String(value || "").trim().toLowerCase());
  if (!recipients.length || recipients.some((email) => !allowedRecipients.has(email))) {
    return res.status(403).json({ error: "recipient_not_a_fixture" });
  }
  messages.unshift({
    id: crypto.randomUUID(),
    fixtureNames: recipients.map((email) => allowedRecipients.get(email)),
    templateKey: String(req.body?.templateKey || ""),
    variables: req.body?.variables || {},
    subject: String(req.body?.subject || ""),
    html: String(req.body?.html || ""),
    receivedAt: new Date().toISOString(),
  });
  if (messages.length > 100) messages.length = 100;
  res.status(202).json({ accepted: true });
});
app.get("/messages/latest", (req, res) => {
  const fixture = String(req.query.fixture || "").trim().toUpperCase().replace(/_/g, "-");
  const templateKey = String(req.query.templateKey || "").trim();
  const message = messages.find((entry) => entry.fixtureNames.includes(fixture)
    && (!templateKey || entry.templateKey === templateKey));
  res.json({ message: message || null });
});

const parsed = new URL(inbox.origin);
const server = app.listen(Number(parsed.port), "127.0.0.1", () => {
  console.log(`Isolated local QA inbox ready on ${inbox.origin}`);
});
function shutdown() { server.close(() => process.exit(0)); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
