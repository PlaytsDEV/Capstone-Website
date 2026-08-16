// The real 'uuid' package (v13) is ESM-only and cannot be required from this
// CJS test file — stub it, matching the pattern used by other mobile
// controller tests that transitively require a controller using it.
jest.mock('uuid', () => ({ v4: () => 'test-uuid-0000-0000-0000-000000000000' }));
// ../config/database.js is ESM (imports mongoose) and cannot be required
// from this CJS test file — mapRealBill() itself never touches the db, so a
// bare stub is enough to satisfy the controller module's top-level require.
jest.mock('../config/database', () => ({ getDb: () => null }));
// ../services/pushService.js transitively requires firebase-admin (ESM),
// same reasoning as above — mapRealBill() never sends push notifications.
jest.mock('../services/pushService', () => ({ notifyBillCreated: jest.fn() }));

const { mapRealBill } = require('./billing.controller.js');

describe('mapRealBill — move-in reservation fee credit surfaced to mobile', () => {
  test('an initial_payment bill includes move_in_financials with the paid reservation fee', () => {
    const bill = {
      _id: { toString: () => 'bill123' },
      billType: 'initial_payment',
      status: 'paid',
      dueDate: new Date('2026-01-01'),
      billingCycleStart: new Date('2025-12-01'),
      remainingAmount: 0,
      totalAmount: 15000,
      grossAmount: 18000,
      charges: {},
      initialPaymentBreakdown: {
        advanceRent: 13500,
        securityDeposit: 13500,
        approvedInitialCharges: 0,
        reservationFeeCredit: 3000,
        grossInitialAmount: 18000,
        initialPaymentTotal: 15000,
      },
    };

    const mapped = mapRealBill(bill, 'user_1');

    expect(mapped.description).toBe('Initial Payment');
    expect(mapped.move_in_financials).toEqual({
      advanceRent: 13500,
      securityDeposit: 13500,
      reservationFeeAlreadyPaid: 3000,
    });
  });

  test('a regular (non-initial) bill has no move_in_financials field at all', () => {
    const bill = {
      _id: { toString: () => 'bill456' },
      billType: 'monthly_rent',
      status: 'pending',
      dueDate: new Date('2026-02-01'),
      billingCycleStart: new Date('2026-01-01'),
      remainingAmount: 5400,
      totalAmount: 5400,
      billingMonth: '2026-02-01T00:00:00.000Z',
      charges: { rent: 5400 },
    };

    const mapped = mapRealBill(bill, 'user_1');

    expect(mapped.move_in_financials).toBeUndefined();
    expect(mapped.rent).toBe(5400);
  });

  test('an initial_payment bill with a missing initialPaymentBreakdown still returns zeroed move_in_financials, not a crash', () => {
    const bill = {
      _id: { toString: () => 'bill789' },
      billType: 'initial_payment',
      status: 'pending',
      dueDate: new Date('2026-01-01'),
      totalAmount: 0,
      charges: {},
    };

    const mapped = mapRealBill(bill, 'user_1');

    expect(mapped.move_in_financials).toEqual({
      advanceRent: 0,
      securityDeposit: 0,
      reservationFeeAlreadyPaid: 0,
    });
  });
});
