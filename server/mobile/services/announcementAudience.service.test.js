const { ObjectId } = require('mongodb');
const {
  resolveTenantBranch,
  buildTenantContext,
  resolveAnnouncementAudience,
  canTenantViewAnnouncement,
  filterAnnouncementRecipients,
} = require('./announcementAudience.service');

const tenantA = { _id: new ObjectId('64c000000000000000000001'), user_id: 'tenant-a' };
const tenantB = { _id: new ObjectId('64c000000000000000000002'), user_id: 'tenant-b' };
const roomA = new ObjectId('64d000000000000000000001');
const roomB = new ObjectId('64d000000000000000000002');

function sameId(left, right) {
  return left != null && right != null && String(left) === String(right);
}

function makeDb({ stays = [], bedhistories = [], reservations = [], rooms = [], contracts = [] } = {}) {
  const rows = { stays, bedhistories, reservations, rooms, contracts };
  return {
    collection(name) {
      if (!Object.prototype.hasOwnProperty.call(rows, name)) throw new Error(`unexpected collection: ${name}`);
      return {
        findOne: async (query) => rows[name].find((row) => {
          if (query.tenantId && !sameId(row.tenantId, query.tenantId)) return false;
          if (query.userId && !sameId(row.userId, query.userId)) return false;
          if (query._id && !sameId(row._id, query._id)) return false;
          if (query.status?.$in && !query.status.$in.includes(row.status)) return false;
          if (typeof query.status === 'string' && row.status !== query.status) return false;
          if (query.isArchived?.$ne === true && row.isArchived === true) return false;
          if (query.isCurrent?.$ne === false && row.isCurrent === false) return false;
          if (query.isCanonical?.$ne === false && row.isCanonical === false) return false;
          return true;
        }) || null,
      };
    },
  };
}

const live = (targetBranch) => ({
  targetBranch,
  publicationStatus: 'published',
  startsAt: new Date('2026-08-01'),
  isArchived: false,
});

describe('canonical tenant branch and announcement audience policy', () => {
  test('active Stay is authoritative and an older reservation cannot override it', async () => {
    const db = makeDb({
      stays: [{ tenantId: tenantA._id, branch: 'guadalupe', status: 'active' }],
      reservations: [{ userId: tenantA._id, roomId: roomA, status: 'reserved', isArchived: false }],
      rooms: [{ _id: roomA, branch: 'gil-puyat' }],
      contracts: [{ tenantId: tenantA._id, branch: 'gil-puyat', isCurrent: true }],
    });
    await expect(resolveTenantBranch(db, tenantA._id)).resolves.toEqual({ branch: 'guadalupe', source: 'stay' });
  });

  test('pre-move-in branch comes from the current reserved Room, not Reservation.branch', async () => {
    const db = makeDb({
      reservations: [{
        userId: tenantA._id,
        roomId: roomA,
        branch: 'gil-puyat',
        status: 'reserved',
        isArchived: false,
      }],
      rooms: [{ _id: roomA, branch: 'guadalupe' }],
    });
    await expect(resolveTenantBranch(db, tenantA._id)).resolves.toEqual({ branch: 'guadalupe', source: 'reserved-room' });
  });

  test('targetBranch is canonical and wins over a conflicting legacy branch field', async () => {
    expect(resolveAnnouncementAudience({ targetBranch: 'guadalupe', branch: 'gil-puyat' })).toEqual({
      kind: 'branch', branch: 'guadalupe',
    });
  });

  test('targetBranch is read from a Mongoose-style document getter, not mistaken for legacy global', () => {
    const mongooseLike = Object.create({ targetBranch: 'guadalupe' });
    mongooseLike.branch = 'gil-puyat';
    expect(resolveAnnouncementAudience(mongooseLike)).toEqual({ kind: 'branch', branch: 'guadalupe' });
  });

  test('global and exact legacy-recipient semantics are explicit', async () => {
    const db = makeDb();
    const context = await buildTenantContext(db, { tenant: tenantA });
    expect(canTenantViewAnnouncement({ announcement: live('both'), tenantContext: context })).toBe(true);
    expect(canTenantViewAnnouncement({
      announcement: { ...live('both'), is_private: true, user_id: tenantA.user_id },
      tenantContext: context,
    })).toBe(true);
    expect(canTenantViewAnnouncement({
      announcement: { ...live('both'), is_private: true, user_id: tenantB.user_id },
      tenantContext: context,
    })).toBe(false);
  });

  test('unresolved branch fails closed for branch-only content but not targetBranch=both', async () => {
    const context = await buildTenantContext(makeDb(), { tenant: tenantA });
    expect(context.branch).toBeNull();
    expect(canTenantViewAnnouncement({ announcement: live('guadalupe'), tenantContext: context })).toBe(false);
    expect(canTenantViewAnnouncement({ announcement: live('both'), tenantContext: context })).toBe(true);
  });

  test('CASE G: Guadalupe-only push recipient resolution excludes Gil Puyat', async () => {
    const db = makeDb({
      stays: [
        { tenantId: tenantA._id, branch: 'guadalupe', status: 'active' },
        { tenantId: tenantB._id, branch: 'gil-puyat', status: 'active' },
      ],
    });
    const recipients = await filterAnnouncementRecipients(db, live('guadalupe'), [tenantA, tenantB]);
    expect(recipients.map((tenant) => tenant.user_id)).toEqual(['tenant-a']);
  });
});
