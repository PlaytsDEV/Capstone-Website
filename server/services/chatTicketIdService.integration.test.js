import { afterAll, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ChatConversation from '../models/ChatConversation.js';
import {
  CHAT_TICKET_ID_PATTERN,
  ensureChatTicketId,
  formatChatTicketId,
  generateChatTicketId,
} from './chatTicketIdService.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: 'chat_ticket_ids' });
  await ChatConversation.syncIndexes();
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.collection('chatTicketCounters').deleteMany({});
  await ChatConversation.deleteMany({});
});

describe('chat inquiry ticket IDs', () => {
  test('uses the public INQ-year-six-digit contract', () => {
    expect(formatChatTicketId(2026, 123)).toBe('INQ-2026-000123');
    expect(CHAT_TICKET_ID_PATTERN.test('INQ-2026-000123')).toBe(true);
  });

  test('allocates unique monotonic IDs under concurrent generation', async () => {
    const ids = await Promise.all(
      Array.from({ length: 40 }, () => generateChatTicketId(new Date('2026-08-18T00:00:00.000Z'))),
    );
    expect(new Set(ids).size).toBe(40);
    expect(ids.slice().sort()).toEqual(
      Array.from({ length: 40 }, (_, index) => formatChatTicketId(2026, index + 1)),
    );
  });

  test('lazily backfills an existing conversation once and keeps the ID stable', async () => {
    const conversation = await ChatConversation.create({
      tenantId: new mongoose.Types.ObjectId(),
      tenantName: 'QA Tenant',
      branch: 'gil-puyat',
      createdAt: new Date('2026-08-18T00:00:00.000Z'),
    });

    const first = await ensureChatTicketId(conversation);
    const second = await ensureChatTicketId(await ChatConversation.findById(conversation._id));
    expect(first.ticketId).toBe('INQ-2026-000001');
    expect(second.ticketId).toBe(first.ticketId);
    expect(await ChatConversation.countDocuments({ ticketId: first.ticketId })).toBe(1);
  });
});
