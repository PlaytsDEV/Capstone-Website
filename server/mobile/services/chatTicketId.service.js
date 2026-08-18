const CHAT_TICKET_COUNTERS = 'chatTicketCounters';
const CHAT_TICKET_ID_PATTERN = /^INQ-\d{4}-\d{6}$/;

function formatChatTicketId(year, sequence) {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error('Chat ticket year must be a four-digit integer.');
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999999) {
    throw new Error('Chat ticket sequence must be between 1 and 999999.');
  }
  return `INQ-${year}-${String(sequence).padStart(6, '0')}`;
}

async function generateChatTicketId(db, now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error('Chat ticket date is invalid.');

  const year = date.getUTCFullYear();
  const result = await db.collection(CHAT_TICKET_COUNTERS).findOneAndUpdate(
    { _id: `inquiry:${year}` },
    { $inc: { sequence: 1 }, $setOnInsert: { year, createdAt: new Date() }, $set: { updatedAt: new Date() } },
    { upsert: true, returnDocument: 'after' },
  );
  const counter = result?.value || result;
  return formatChatTicketId(year, Number(counter?.sequence));
}

async function ensureChatTicketId(db, conversationsCollection, conversation) {
  if (!conversation?._id) return conversation;
  if (CHAT_TICKET_ID_PATTERN.test(String(conversation.ticketId || ''))) return conversation;

  const ticketId = await generateChatTicketId(db, conversation.createdAt || new Date());
  const result = await conversationsCollection.updateOne(
    {
      _id: conversation._id,
      $or: [
        { ticketId: { $exists: false } },
        { ticketId: null },
        { ticketId: '' },
      ],
    },
    { $set: { ticketId } },
  );
  if (result.modifiedCount === 1) return { ...conversation, ticketId };
  return conversationsCollection.findOne({ _id: conversation._id });
}

async function ensureChatTicketIds(db, conversationsCollection, conversations = []) {
  return Promise.all(
    conversations.map((conversation) => ensureChatTicketId(db, conversationsCollection, conversation)),
  );
}

module.exports = {
  CHAT_TICKET_ID_PATTERN,
  formatChatTicketId,
  generateChatTicketId,
  ensureChatTicketId,
  ensureChatTicketIds,
};
