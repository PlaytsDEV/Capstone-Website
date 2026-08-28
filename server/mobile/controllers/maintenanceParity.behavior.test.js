const mockGetDb = jest.fn();
jest.mock('../config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
jest.mock('../services/pushService.js', () => ({ notifyMaintenanceStatusChange: jest.fn() }));
jest.mock('uuid', () => ({ v4: () => 'test-uuid-0000-0000-0000-000000000000' }));
jest.mock('../config/firebase.js', () => ({ admin: { apps: [] }, resolveFirebaseStorageBucket: () => null }));

const {
  createMaintenance,
  getMaintenanceDetail,
  getMyMaintenance,
  updateMaintenance,
  cancelMaintenance,
  reopenMaintenance,
  confirmMaintenanceResolved,
} = require('./maintenance.controller.js');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeDb({ requests = {} } = {}) {
  const updates = [];
  return {
    updates,
    collection(name) {
      if (name === 'reservations' || name === 'bedhistories' || name === 'roomoccupancyhistories' || name === 'rooms') {
        return { findOne: async () => null };
      }
      if (name === 'maintenance_requests' || name === 'maintenancerequests') {
        return {
          async findOne(query) {
            const request = requests[query.request_id || (query._id ? String(query._id) : null)];
            if (!request) return null;
            if (query.user_id && request.user_id !== query.user_id) return null;
            return name === request.__collection ? request : (name === 'maintenance_requests' ? request : null);
          },
          async find(filter) {
            return {
              async toArray() {
                return Object.values(requests).filter((req) => {
                  if (filter.user_id && req.user_id !== filter.user_id) return false;
                  if (filter.status && req.status !== filter.status) return false;
                  return true;
                });
              },
            };
          },
          async updateOne(filter, update) {
            const request = requests[filter.request_id];
            if (request) {
              Object.assign(request, update.$set);
              updates.push({ filter, update });
            }
            return { matchedCount: request ? 1 : 0 };
          },
          async insertOne(doc) {
            requests[doc.request_id] = { ...doc, __collection: 'maintenance_requests' };
          },
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

describe('Mobile API Parity & Lifecycle Audits (sk-mobile-api-parity-checker)', () => {
  beforeEach(() => {
    mockGetDb.mockReset();
  });

  describe('Checklist 1 & 2: 2-Phase Resolution Lifecycle & Confirmation/Reopen Actions', () => {
    test('resolved -> confirmed completed: sets status to completed, tenant_confirmed_resolved=true, and stores resolutionConfirmation', async () => {
      const requests = {
        m1: {
          request_id: 'm1',
          user_id: 't1',
          status: 'resolved',
          __collection: 'maintenance_requests',
        },
      };
      mockGetDb.mockReturnValue(makeDb({ requests }));

      const req = {
        user: { user_id: 't1', _id: 'mongo1' },
        params: { requestId: 'm1' },
        body: { confirmed: true, rating: 5, feedback: 'Air conditioner is working great now!' },
      };
      const res = response();
      await confirmMaintenanceResolved(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('completed');
      expect(res.body.tenant_confirmed_resolved).toBe(true);
      expect(res.body.resolutionConfirmation).toEqual(
        expect.objectContaining({
          tenantFeedback: 'Air conditioner is working great now!',
          rating: 5,
          action: 'confirm',
        })
      );
    });

    test('resolved + explicit reopen action on confirm endpoint: delegates to reopen and sets status to pending', async () => {
      const requests = {
        m1: {
          request_id: 'm1',
          user_id: 't1',
          status: 'resolved',
          reopenCount: 0,
          reopen_history: [],
          __collection: 'maintenance_requests',
        },
      };
      mockGetDb.mockReturnValue(makeDb({ requests }));

      const req = {
        user: { user_id: 't1', _id: 'mongo1' },
        params: { requestId: 'm1' },
        body: { action: 'reopen', note: 'Water is still dripping' },
      };
      const res = response();
      await confirmMaintenanceResolved(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('pending');
      expect(res.body.isReopened).toBe(true);
      expect(res.body.tenant_confirmed_resolved).toBe(false);
      expect(res.body.reopen_note).toBe('Water is still dripping');
      expect(res.body.reopenCount).toBe(1);
      expect(res.body.reopen_history).toHaveLength(1);
      expect(res.body.reopen_history[0].previous_status).toBe('resolved');
    });

    test('completed request can be reopened via reopen endpoint: increments reopenCount and resets status to pending', async () => {
      const requests = {
        m1: {
          request_id: 'm1',
          user_id: 't1',
          status: 'completed',
          reopenCount: 1,
          reopen_history: [
            { reopened_at: new Date('2026-08-01'), previous_status: 'resolved', note: 'First reopen' },
          ],
          __collection: 'maintenance_requests',
        },
      };
      mockGetDb.mockReturnValue(makeDb({ requests }));

      const req = {
        user: { user_id: 't1', _id: 'mongo1' },
        params: { requestId: 'm1' },
        body: { reopen_note: 'Issue came back after 2 weeks' },
      };
      const res = response();
      await reopenMaintenance(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('pending');
      expect(res.body.isReopened).toBe(true);
      expect(res.body.reopenCount).toBe(2);
      expect(res.body.reopen_note).toBe('Issue came back after 2 weeks');
      expect(res.body.reopen_history).toHaveLength(2);
    });
  });

  describe('Checklist 3: Tenant Output Sanitization Rules', () => {
    test('strips vendor phone numbers, private costs, internal notes, and draft completion reports', async () => {
      const requests = {
        m1: {
          request_id: 'm1',
          user_id: 't1',
          request_type: 'aircon',
          description: 'AC making strange noise',
          status: 'in_progress',
          // Internal & vendor private fields that MUST NOT leak to mobile tenant
          notes: 'INTERNAL NOTE: Call landlord before fixing',
          resolution_note: 'INTERNAL RESOLUTION: Replaced motor at discount',
          completionNote: 'INTERNAL COMPLETION',
          work_log: [{ note: 'Internal progress log', logged_at: new Date() }],
          internalLogs: [{ text: 'Secret admin audit' }],
          assignedProviderContact: '+63 917 123 4567',
          assignedProviderNotes: 'Private contractor rate: 500 PHP/hr',
          assignedProviderSource: 'directory',
          assignedProviderId: 'provider_12345',
          assigned_to: 'admin_user_99',
          assignedBy: 'admin_user_01',
          providerDetails: {
            providerType: 'EXTERNAL',
            tenantVisibleLabel: 'Authorized Air Conditioning Specialist',
            internalProviderId: 'internal_priv_99',
            privateContact: '+63 917 999 8888',
            quotedCost: 4500,
            currency: 'PHP',
            snapshotJson: { secretVendorMargin: '25%' },
          },
          completionReport: {
            reportId: 'rep_1',
            isDraft: true, // Draft report must be completely hidden
            summary: 'Preliminary findings',
          },
          estimatedCost: 5000,
          actualCost: 4500,
          costBreakdown: {
            laborCost: 2000,
            materialsCost: 2500,
            totalCost: 4500,
            isTenantChargeable: false, // Tenant is NOT chargeable, do not leak internal costs
            chargeReason: null,
          },
          attachments: [
            { uri: 'https://cdn.example.com/tenant_photo.jpg', visibility: 'tenant_admin' },
            { uri: 'https://cdn.example.com/admin_internal_receipt.pdf', visibility: 'admin_only' },
            { uri: 'https://cdn.example.com/deleted_photo.jpg', isRemoved: true },
          ],
          __collection: 'maintenance_requests',
        },
      };
      mockGetDb.mockReturnValue(makeDb({ requests }));

      const req = {
        user: { user_id: 't1', _id: 'mongo1' },
        params: { requestId: 'm1' },
      };
      const res = response();
      await getMaintenanceDetail(req, res);

      expect(res.statusCode).toBe(200);
      const payload = res.body;

      // Verify internal notes stripped
      expect(payload.notes).toBeUndefined();
      expect(payload.resolution_note).toBeUndefined();
      expect(payload.completionNote).toBeUndefined();
      expect(payload.work_log).toBeUndefined();
      expect(payload.internalLogs).toBeUndefined();

      // Verify vendor private details stripped
      expect(payload.assignedProviderContact).toBeUndefined();
      expect(payload.assignedProviderNotes).toBeUndefined();
      expect(payload.assignedProviderSource).toBeUndefined();
      expect(payload.assignedProviderId).toBeUndefined();
      expect(payload.assigned_to).toBeUndefined();
      expect(payload.assignedBy).toBeUndefined();

      // Verify providerDetails is strictly sanitized to only public fields
      expect(payload.providerDetails).toEqual({
        providerType: 'EXTERNAL',
        tenantVisibleLabel: 'Authorized Air Conditioning Specialist',
      });
      expect(payload.providerDetails.privateContact).toBeUndefined();
      expect(payload.providerDetails.quotedCost).toBeUndefined();
      expect(payload.providerDetails.internalProviderId).toBeUndefined();
      expect(payload.providerDetails.snapshotJson).toBeUndefined();

      // Verify draft completion report is hidden (null)
      expect(payload.completionReport).toBeNull();

      // Verify non-chargeable costs are not leaked
      expect(payload.estimatedCost).toBe(0);
      expect(payload.actualCost).toBe(0);
      expect(payload.costBreakdown.isTenantChargeable).toBe(false);
      expect(payload.costBreakdown.totalCost).toBe(0);

      // Verify admin_only and isRemoved attachments are filtered out
      expect(payload.attachments).toHaveLength(1);
      expect(payload.attachments[0].uri).toBe('https://cdn.example.com/tenant_photo.jpg');

      // Verify compatibility aliases are present
      expect(payload.category).toBe('aircon');
      expect(payload.title).toBe('Air Conditioning Request');
      expect(payload.photos).toHaveLength(1);
      expect(payload.images).toHaveLength(1);
    });
  });

  describe('Checklist 4: Backward Compatibility (category, title, description, photos, images)', () => {
    test('createMaintenance handles legacy category (air_conditioning), merges title + description, and normalizes medium urgency', async () => {
      mockGetDb.mockReturnValue(makeDb());
      const req = {
        user: { user_id: 't1', _id: 'mongo1' },
        body: {
          category: 'air_conditioning',
          title: 'AC unit dripping water',
          description: 'Water has been leaking over my desk since yesterday morning.',
          urgency: 'medium',
        },
      };
      const res = response();
      await createMaintenance(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.request_type).toBe('aircon');
      expect(res.body.category).toBe('aircon');
      expect(res.body.urgency).toBe('normal');
      expect(res.body.description).toBe(
        'AC unit dripping water\n\nWater has been leaking over my desk since yesterday morning.'
      );
      expect(res.body.title).toBe('Air Conditioning Request');
    });

    test('createMaintenance normalizes legacy pest_control and furniture_fixture categories', async () => {
      mockGetDb.mockReturnValue(makeDb());
      const reqPest = {
        user: { user_id: 't1', _id: 'mongo1' },
        body: {
          category: 'pest_control',
          description: 'Ants detected near the window frame on 3rd floor.',
        },
      };
      const resPest = response();
      await createMaintenance(reqPest, resPest);
      expect(resPest.statusCode).toBe(201);
      expect(resPest.body.request_type).toBe('pest');
      expect(resPest.body.category).toBe('pest');

      const reqFurn = {
        user: { user_id: 't1', _id: 'mongo1' },
        body: {
          category: 'furniture_fixture',
          description: 'Study chair caster wheel is broken and detached.',
        },
      };
      const resFurn = response();
      await createMaintenance(reqFurn, resFurn);
      expect(resFurn.statusCode).toBe(201);
      expect(resFurn.body.request_type).toBe('furniture');
      expect(resFurn.body.category).toBe('furniture');
    });

    test('updateMaintenance allows updating with legacy category and merged title/description', async () => {
      const requests = {
        m1: {
          request_id: 'm1',
          user_id: 't1',
          request_type: 'maintenance',
          description: 'Initial general description here',
          status: 'pending',
          __collection: 'maintenance_requests',
        },
      };
      mockGetDb.mockReturnValue(makeDb({ requests }));

      const req = {
        user: { user_id: 't1', _id: 'mongo1' },
        params: { requestId: 'm1' },
        body: {
          category: 'electrical',
          title: 'Outlet sparking',
          description: 'The wall socket sparks whenever the charger is plugged in.',
          urgency: 'high',
        },
      };
      const res = response();
      await updateMaintenance(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.request_type).toBe('electrical');
      expect(res.body.category).toBe('electrical');
      expect(res.body.urgency).toBe('high');
      expect(res.body.description).toBe(
        'Outlet sparking\n\nThe wall socket sparks whenever the charger is plugged in.'
      );
    });
  });
});
