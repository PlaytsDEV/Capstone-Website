/**
 * ============================================================================
 * PRO-RATA UTILITY ENGINE
 * ============================================================================
 * Calculates exact pro-rata utility bill distribution across room occupants.
 * Resolves centavo rounding discrepancies by allocating remainders to the
 * designated primary occupant, guaranteeing zero variance against meter totals.
 * ============================================================================
 */

/**
 * Calculates exact pro-rata utility splits across room occupants.
 * 
 * @param {Object} params
 * @param {number} params.totalMeterAmount - Total monetary value of the utility bill (e.g. 1000.00).
 * @param {Array<{ userId: string, activeDays: number, isPrimary?: boolean }>} params.occupants - List of occupants.
 * @returns {{ splits: Array<{ userId: string, activeDays: number, allocatedAmount: number, isPrimary: boolean }>, totalAllocated: number, variance: number }}
 */
export function calculateProRataUtilitySplits({ totalMeterAmount, occupants }) {
  if (!totalMeterAmount || totalMeterAmount <= 0) {
    return { splits: [], totalAllocated: 0, variance: 0 };
  }

  if (!Array.isArray(occupants) || occupants.length === 0) {
    throw new Error("Pro-rata utility calculation requires at least one occupant.");
  }

  const totalOccupantDays = occupants.reduce((sum, occ) => sum + Math.max(Number(occ.activeDays || 1), 1), 0);

  let allocatedSum = 0;
  const splits = occupants.map((occ, idx) => {
    const days = Math.max(Number(occ.activeDays || 1), 1);
    // Floor to 2 decimal places to prevent float overflow
    const unroundedShare = (days / totalOccupantDays) * totalMeterAmount;
    const baseShare = Math.floor(unroundedShare * 100) / 100;

    allocatedSum += baseShare;

    return {
      userId: occ.userId,
      activeDays: days,
      allocatedAmount: baseShare,
      isPrimary: Boolean(occ.isPrimary || idx === 0),
    };
  });

  // Calculate rounding discrepancy (centavo remainder)
  const remainder = Math.round((totalMeterAmount - allocatedSum) * 100) / 100;

  if (remainder !== 0) {
    // Allocate the centavo gap to the primary occupant (or first tenant if unassigned)
    const primaryIndex = splits.findIndex((s) => s.isPrimary);
    const targetIndex = primaryIndex >= 0 ? primaryIndex : 0;
    splits[targetIndex].allocatedAmount = Math.round((splits[targetIndex].allocatedAmount + remainder) * 100) / 100;
  }

  const finalTotalAllocated = splits.reduce((sum, s) => sum + s.allocatedAmount, 0);

  return {
    splits,
    totalAllocated: Math.round(finalTotalAllocated * 100) / 100,
    variance: Math.round((totalMeterAmount - finalTotalAllocated) * 100) / 100,
  };
}
