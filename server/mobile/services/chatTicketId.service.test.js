const {
  CHAT_TICKET_ID_PATTERN,
  formatChatTicketId,
  generateChatTicketId,
} = require('./chatTicketId.service');

describe('mobile chat ticket ID bridge', () => {
  test('shares the canonical public format', () => {
    expect(formatChatTicketId(2026, 123)).toBe('INQ-2026-000123');
    expect(CHAT_TICKET_ID_PATTERN.test('INQ-2026-000123')).toBe(true);
  });

  test('uses one atomic counter operation', async () => {
    const findOneAndUpdate = jest.fn().mockResolvedValue({
      _id: 'inquiry:2026',
      year: 2026,
      sequence: 8,
    });
    const db = { collection: jest.fn(() => ({ findOneAndUpdate })) };

    await expect(generateChatTicketId(db, new Date('2026-08-18T00:00:00.000Z')))
      .resolves.toBe('INQ-2026-000008');
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'inquiry:2026' },
      expect.objectContaining({ $inc: { sequence: 1 } }),
      expect.objectContaining({ upsert: true, returnDocument: 'after' }),
    );
  });
});
