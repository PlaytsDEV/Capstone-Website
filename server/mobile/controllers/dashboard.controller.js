const { getDb } = require('../config/database');
const { ObjectId } = require('mongodb');
const { sanitizeUserForClient, normalizeUser } = require('./user.controller');

// Round to 2 decimal places, matching services/billing/billingPolicy.js
// roundMoney() — kept local (not imported) since this file is CommonJS and
// billingPolicy.js is ESM.
function roundMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

// Compute the SAME effective status/remaining-amount truth the canonical
// billing bridge uses (services/billing/billingPolicy.js getVisibleBillSnapshot:
// remainingAmount = max(totalAmount - paidAmount, 0), status derived from
// that, never from the raw stored status/remainingAmount fields). Phase 4.5
// cutover audit found this dashboard previously trusted the RAW stored
// `b.status`/`b.remainingAmount` fields directly — exactly the "stale
// stored field" risk the Phase 3.6 billing-reconciliation review flagged
// for the `bills` collection. This keeps the dashboard's "current bill"
// card consistent with what /billing/me/latest (mobileBillingRoutes.js)
// already shows for the same bill.
function effectiveBillingFields(b) {
  const totalAmount = roundMoney(b.totalAmount);
  const paidAmount = roundMoney(b.paidAmount);
  const remainingAmount = roundMoney(Math.max(totalAmount - paidAmount, 0));
  const status = b.status === 'draft' ? 'draft' : remainingAmount <= 0 ? 'paid' : (paidAmount > 0 ? 'partially_paid' : (b.status || 'unpaid'));
  return { totalAmount, paidAmount, remainingAmount, status };
}

// Convert slug like 'quadruple-sharing' → 'Quadruple Sharing'
function formatRoomType(type) {
  if (!type) return 'Standard';
  return type.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Get dashboard data
async function getDashboard(req, res) {
  try {
    const userId = req.user.user_id;   // string ID, e.g. 'user_95f39d5b4ea4'
    const mongoId = req.user._id;      // MongoDB ObjectId from auth middleware
    const db = getDb();

    // ── Room Assignment ──────────────────────────────────────────────────────
    // Try multiple sources: roomoccupancyhistories → bedhistories → reservations
    let assignment = null;
    let room = null;

    if (mongoId) {
      // Source 1: roomoccupancyhistories (legacy)
      const occupancy = await db.collection('roomoccupancyhistories').findOne({
        tenantId: mongoId,
        stayStatus: 'active',
      });

      if (occupancy) {
        const roomDoc = await db.collection('rooms').findOne({ _id: occupancy.roomId });
        const bed = roomDoc?.beds?.find((b) => b.id === occupancy.bedId);

        assignment = {
          assignment_id: occupancy._id?.toString(),
          user_id: userId,
          room_id: occupancy.roomId?.toString(),
          status: 'active',
          move_in_date: occupancy.moveInDate || null,
          move_out_date: occupancy.moveOutDate || null,
          bed_id: occupancy.bedId,
          branch: occupancy.branchId,
        };

        if (roomDoc) {
          room = {
            room_id: roomDoc._id?.toString(),
            room_number: roomDoc.roomNumber,
            room_type: formatRoomType(roomDoc.type),
            bed_type: bed
              ? bed.position === 'upper'
                ? 'Upper Bed'
                : 'Lower Bed'
              : 'N/A',
            floor: roomDoc.floor,
            capacity: roomDoc.capacity,
            price: roomDoc.monthlyPrice,
            amenities: roomDoc.amenities || [],
            policies: roomDoc.policies || [],
            description: roomDoc.description || '',
            images: roomDoc.images || [],
            name: roomDoc.name,
          };
        }
      }

      // Source 2: bedhistories (web admin creates these on move-in)
      if (!assignment) {
        const bedHistory = await db.collection('bedhistories').findOne(
          { tenantId: mongoId, status: 'active' },
          { sort: { moveInDate: -1 } }
        );

        if (bedHistory) {
          const roomOid = typeof bedHistory.roomId === 'string'
            ? new ObjectId(bedHistory.roomId)
            : bedHistory.roomId;
          const roomDoc = await db.collection('rooms').findOne({ _id: roomOid });
          const bed = roomDoc?.beds?.find((b) => b.id === bedHistory.bedId);

          assignment = {
            assignment_id: bedHistory._id?.toString(),
            user_id: userId,
            room_id: bedHistory.roomId?.toString(),
            status: 'active',
            move_in_date: bedHistory.moveInDate || bedHistory.effectiveStartDate || null,
            move_out_date: bedHistory.moveOutDate || bedHistory.effectiveEndDate || null,
            bed_id: bedHistory.bedId,
            branch: bedHistory.branch,
          };

          if (roomDoc) {
            room = {
              room_id: roomDoc._id?.toString(),
              room_number: roomDoc.roomNumber,
              room_type: formatRoomType(roomDoc.type),
              bed_type: bed
                ? bed.position === 'upper'
                  ? 'Upper Bed'
                  : 'Lower Bed'
                : 'N/A',
              floor: roomDoc.floor,
              capacity: roomDoc.capacity,
              price: roomDoc.monthlyPrice,
              amenities: roomDoc.amenities || [],
              policies: roomDoc.policies || [],
              description: roomDoc.description || '',
              images: roomDoc.images || [],
              name: roomDoc.name,
            };
          }
        }
      }

      // Source 3: reservations (web admin reservation flow — status moveIn/active)
      if (!assignment) {
        const reservation = await db.collection('reservations').findOne(
          { userId: mongoId, status: { $in: ['moveIn', 'active', 'completed', 'confirmed'] } },
          { sort: { createdAt: -1 } }
        );

        if (reservation?.roomId) {
          const roomOid = typeof reservation.roomId === 'string'
            ? new ObjectId(reservation.roomId)
            : reservation.roomId;
          const roomDoc = await db.collection('rooms').findOne({ _id: roomOid });
          const selectedBed = reservation.selectedBed || {};
          const bed = roomDoc?.beds?.find((b) => b.id === selectedBed.id);

          // Calculate contract end from move-in + lease duration
          let contractEnd = null;
          const moveIn = reservation.moveInDate || reservation.checkInDate || reservation.targetMoveInDate;
          if (moveIn && reservation.leaseDuration) {
            const endDate = new Date(moveIn);
            endDate.setMonth(endDate.getMonth() + reservation.leaseDuration);
            contractEnd = endDate;
          }

          assignment = {
            assignment_id: reservation._id?.toString(),
            user_id: userId,
            room_id: reservation.roomId?.toString(),
            status: 'active',
            move_in_date: moveIn || null,
            move_out_date: reservation.moveOutDate || contractEnd || null,
            bed_id: selectedBed.id || null,
            branch: reservation.branch,
          };

          if (roomDoc) {
            room = {
              room_id: roomDoc._id?.toString(),
              room_number: roomDoc.roomNumber,
              room_type: formatRoomType(roomDoc.type),
              bed_type: bed
                ? bed.position === 'upper'
                  ? 'Upper Bed'
                  : selectedBed.position === 'upper'
                    ? 'Upper Bed'
                    : 'Lower Bed'
                : selectedBed.position === 'upper'
                  ? 'Upper Bed'
                  : selectedBed.position === 'lower'
                    ? 'Lower Bed'
                    : 'N/A',
              floor: roomDoc.floor,
              capacity: roomDoc.capacity,
              price: roomDoc.monthlyPrice || reservation.monthlyRent,
              amenities: roomDoc.amenities || [],
              policies: roomDoc.policies || [],
              description: roomDoc.description || '',
              images: roomDoc.images || [],
              name: roomDoc.name,
            };
          }
        }
      }
    }

    // ── Billing ──────────────────────────────────────────────────────────────
    // Primary: 'bills' collection (keyed by MongoDB ObjectId userId)
    let billing = [];

    if (mongoId) {
      const bills = await db.collection('bills')
        .find({ userId: mongoId })
        .sort({ dueDate: -1 })
        .limit(10)
        .toArray();

      billing = bills.map((b) => {
        const effective = effectiveBillingFields(b);
        return {
          billing_id: b._id?.toString(),
          user_id: userId,
          description: b.billingMonth || b.description || 'Bill',
          billing_type: 'consolidated',
          due_date: b.dueDate,
          release_date: b.billingCycleStart,
          billing_period: b.billingMonth,
          status: effective.status,
          amount: effective.totalAmount,
          total: effective.totalAmount,
          gross_amount: b.grossAmount,
          remaining_amount: effective.remainingAmount,
          payment_method: b.paymentMethod,
          payment_date: b.paidAt,
          charges: b.charges,
          additional_charges: b.additionalCharges,
          reservation_id: b.reservationId?.toString(),
          created_at: b.createdAt,
        };
      });
    }

    // Fallback: old 'billing' collection (keyed by string user_id)
    if (!billing.length) {
      const oldBilling = await db.collection('billing')
        .find({ user_id: userId })
        .sort({ due_date: -1, created_at: -1 })
        .limit(10)
        .toArray();
      billing = oldBilling.map((b) => ({ ...b, _id: undefined }));
    }

    const latestBill = billing[0] || null;

    // ── Maintenance ──────────────────────────────────────────────────────────
    // Read from canonical + legacy collections and de-duplicate by request_id.
    const maintenanceQuery = {
      $or: [
        { user_id: userId },
        ...(mongoId ? [{ userId: mongoId }] : []),
      ],
      status: { $in: ['pending', 'viewed', 'in_progress'] },
    };

    const maintenanceCollections = ['maintenance_requests', 'maintenancerequests'];
    const activeMaintenanceMap = new Map();

    for (const collectionName of maintenanceCollections) {
      const docs = await db.collection(collectionName)
        .find(maintenanceQuery, { projection: { _id: 1, request_id: 1 } })
        .toArray()
        .catch(() => []);

      docs.forEach((doc) => {
        const key = doc.request_id || `${collectionName}:${String(doc._id)}`;
        const existing = activeMaintenanceMap.get(key);

        if (!existing) {
          activeMaintenanceMap.set(key, { ...doc, __source: collectionName });
          return;
        }

        // Prefer canonical collection when duplicate request IDs exist.
        if (existing.__source === 'maintenancerequests' && collectionName === 'maintenance_requests') {
          activeMaintenanceMap.set(key, { ...doc, __source: collectionName });
        }
      });
    }

    const activeMaintenanceCount = activeMaintenanceMap.size;

    res.json({
      // Phase 4.5 cutover audit found this previously leaked the entire raw
      // `users` Mongo document (minus `_id`) to the client — see the
      // identical fix/rationale in controllers/user.controller.js getMe.
      user: sanitizeUserForClient(normalizeUser(req.user)),
      assignment,
      room,
      billing,
      latest_bill: latestBill,
      active_maintenance_count: activeMaintenanceCount,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ detail: 'Failed to fetch dashboard data' });
  }
}

module.exports = {
  getDashboard,
};
