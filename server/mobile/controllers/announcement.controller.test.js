const mockGetDb = jest.fn();
jest.mock('../config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
jest.mock('../services/pushService.js', () => ({ notifyNewAnnouncement: jest.fn() }));
jest.mock('uuid', () => ({ v4: () => 'test-uuid-0000-0000-0000-000000000000' }));

const { getAllAnnouncements } = require('./announcement.controller.js');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeDb({ announcements = [], branchSource = null } = {}) {
  return {
    collection(name) {
      if (name === 'announcements') {
        return { find: () => ({ sort: () => ({ toArray: async () => announcements }) }) };
      }
      if (name === 'roomoccupancyhistories') {
        return { findOne: async () => (branchSource?.tier === 'occupancy' ? branchSource.doc : null) };
      }
      if (name === 'bedhistories') {
        return { findOne: async () => (branchSource?.tier === 'bedhistory' ? branchSource.doc : null) };
      }
      if (name === 'reservations') {
        return { findOne: async () => (branchSource?.tier === 'reservation' ? branchSource.doc : null) };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

describe('announcement.controller getAllAnnouncements — branch visibility', () => {
  beforeEach(() => { mockGetDb.mockReset(); });

  test('a tenant at Branch A does not receive an announcement targeted at Branch B', async () => {
    mockGetDb.mockReturnValue(makeDb({
      announcements: [
        { announcement_id: 'a1', title: 'Branch B notice', content: 'x', branch: 'gil-puyat' },
      ],
      branchSource: { tier: 'occupancy', doc: { branch: 'guadalupe' } },
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getAllAnnouncements(req, res);
    expect(res.body).toEqual([]);
  });

  test('a tenant receives an announcement targeted at their own branch', async () => {
    mockGetDb.mockReturnValue(makeDb({
      announcements: [
        { announcement_id: 'a1', title: 'Guadalupe notice', content: 'x', branch: 'guadalupe' },
      ],
      branchSource: { tier: 'occupancy', doc: { branch: 'guadalupe' } },
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getAllAnnouncements(req, res);
    expect(res.body.length).toBe(1);
    expect(res.body[0].announcement_id).toBe('a1');
  });

  test('a global announcement (no branch field) is visible to every tenant regardless of their own branch', async () => {
    mockGetDb.mockReturnValue(makeDb({
      announcements: [{ announcement_id: 'a1', title: 'Global notice', content: 'x' }],
      branchSource: { tier: 'occupancy', doc: { branch: 'guadalupe' } },
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getAllAnnouncements(req, res);
    expect(res.body.length).toBe(1);
  });

  test('a branch-restricted announcement is hidden (fails closed) when the requester branch cannot be confirmed', async () => {
    mockGetDb.mockReturnValue(makeDb({
      announcements: [{ announcement_id: 'a1', title: 'Restricted', content: 'x', branch: 'gil-puyat' }],
      branchSource: null,
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getAllAnnouncements(req, res);
    expect(res.body).toEqual([]);
  });

  test('a private (user-targeted) announcement bypasses branch filtering entirely', async () => {
    mockGetDb.mockReturnValue(makeDb({
      announcements: [{ announcement_id: 'a1', title: 'Just for you', content: 'x', is_private: true, user_id: 't1', branch: 'gil-puyat' }],
      branchSource: { tier: 'occupancy', doc: { branch: 'guadalupe' } },
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getAllAnnouncements(req, res);
    expect(res.body.length).toBe(1);
  });
});
