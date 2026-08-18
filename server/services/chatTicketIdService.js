import ChatConversation from "../models/ChatConversation.js";
import ChatTicketCounter from "../models/ChatTicketCounter.js";

export const CHAT_TICKET_ID_PATTERN = /^INQ-\d{4}-\d{6}$/;

export function formatChatTicketId(year, sequence) {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error("Chat ticket year must be a four-digit integer.");
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999999) {
    throw new Error("Chat ticket sequence must be between 1 and 999999.");
  }
  return `INQ-${year}-${String(sequence).padStart(6, "0")}`;
}

export async function generateChatTicketId(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error("Chat ticket date is invalid.");

  const year = date.getUTCFullYear();
  const counter = await ChatTicketCounter.findOneAndUpdate(
    { _id: `inquiry:${year}` },
    { $inc: { sequence: 1 }, $setOnInsert: { year } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return formatChatTicketId(year, counter.sequence);
}

export async function ensureChatTicketId(conversation) {
  if (!conversation?._id) return conversation;
  if (CHAT_TICKET_ID_PATTERN.test(String(conversation.ticketId || ""))) return conversation;

  const ticketId = await generateChatTicketId(conversation.createdAt || new Date());
  const result = await ChatConversation.collection.updateOne(
    {
      _id: conversation._id,
      $or: [
        { ticketId: { $exists: false } },
        { ticketId: null },
        { ticketId: "" },
      ],
    },
    { $set: { ticketId } },
  );

  // Concurrent readers may both allocate a sequence, but only one can assign
  // the immutable ID. Preserve the populated/lean object supplied by the
  // caller and copy the winning persisted value onto it.
  if (result.modifiedCount === 1) {
    if (typeof conversation.toObject === "function") {
      return { ...conversation.toObject(), ticketId };
    }
    conversation.ticketId = ticketId;
    return conversation;
  }
  const winner = await ChatConversation.findById(conversation._id).select("ticketId").lean();
  if (typeof conversation.toObject === "function") {
    return { ...conversation.toObject(), ticketId: winner?.ticketId || "" };
  }
  conversation.ticketId = winner?.ticketId || "";
  return conversation;
}

export async function ensureChatTicketIds(conversations = []) {
  return Promise.all(conversations.map((conversation) => ensureChatTicketId(conversation)));
}
