/**
 * ============================================================================
 * VISIT AVAILABILITY DIFF UTILITY
 * ============================================================================
 *
 * Computes a human-readable before→after delta for visit availability rule
 * changes. The diff is pre-computed on save (never on read) so queries remain
 * fast regardless of history volume.
 *
 * Shape of returned diff:
 * {
 *   added: { enabledWeekdays?: [...], blackoutDates?: [...] },
 *   removed: { enabledWeekdays?: [...], blackoutDates?: [...] },
 *   modified: { slots?: [{ label, type, changes }] }
 * }
 */

/**
 * Compute a diff between two serialized availability settings payloads.
 *
 * @param {Object} before - Serialized settings BEFORE the update
 * @param {Object} after  - Serialized settings AFTER the update
 * @returns {{ added: Object, removed: Object, modified: Object }}
 */
export function computeAvailabilityDiff(before, after) {
  const diff = { added: {}, removed: {}, modified: {} };

  const beforeDays = Array.isArray(before?.enabledWeekdays) ? before.enabledWeekdays : [];
  const afterDays = Array.isArray(after?.enabledWeekdays) ? after.enabledWeekdays : [];

  // ── Weekday changes ───────────────────────────────────────────────────────
  const addedDays = afterDays.filter((d) => !beforeDays.includes(d));
  const removedDays = beforeDays.filter((d) => !afterDays.includes(d));

  if (addedDays.length > 0) diff.added.enabledWeekdays = addedDays;
  if (removedDays.length > 0) diff.removed.enabledWeekdays = removedDays;

  // ── Slot changes (capacity, enabled state) ────────────────────────────────
  const beforeSlots = Array.isArray(before?.slots) ? before.slots : [];
  const afterSlots = Array.isArray(after?.slots) ? after.slots : [];
  const slotChanges = [];

  for (const afterSlot of afterSlots) {
    const beforeSlot = beforeSlots.find((s) => s.label === afterSlot.label);
    if (!beforeSlot) {
      slotChanges.push({ label: afterSlot.label, type: "added", to: { ...afterSlot } });
    } else {
      const changes = {};
      if (beforeSlot.enabled !== afterSlot.enabled) {
        changes.enabled = { from: beforeSlot.enabled, to: afterSlot.enabled };
      }
      if (Number(beforeSlot.capacity) !== Number(afterSlot.capacity)) {
        changes.capacity = {
          from: Number(beforeSlot.capacity),
          to: Number(afterSlot.capacity),
        };
      }
      if (Object.keys(changes).length > 0) {
        slotChanges.push({ label: afterSlot.label, type: "modified", changes });
      }
    }
  }

  // Detect removed slots (in before but not in after)
  for (const beforeSlot of beforeSlots) {
    if (!afterSlots.find((s) => s.label === beforeSlot.label)) {
      slotChanges.push({ label: beforeSlot.label, type: "removed", from: { ...beforeSlot } });
    }
  }

  if (slotChanges.length > 0) diff.modified.slots = slotChanges;

  // ── Blackout date changes ─────────────────────────────────────────────────
  const beforeBlackouts = Array.isArray(before?.blackoutDates) ? before.blackoutDates : [];
  const afterBlackouts = Array.isArray(after?.blackoutDates) ? after.blackoutDates : [];

  const addedBlackouts = afterBlackouts.filter(
    (d) => !beforeBlackouts.find((b) => b.date === d.date),
  );
  const removedBlackouts = beforeBlackouts.filter(
    (d) => !afterBlackouts.find((b) => b.date === d.date),
  );

  if (addedBlackouts.length > 0) diff.added.blackoutDates = addedBlackouts;
  if (removedBlackouts.length > 0) diff.removed.blackoutDates = removedBlackouts;

  return diff;
}

/**
 * Returns true if the computed diff contains any meaningful change.
 * Useful for skipping history writes when nothing actually changed.
 *
 * @param {{ added: Object, removed: Object, modified: Object }} diff
 * @returns {boolean}
 */
export function isDiffEmpty(diff) {
  return (
    Object.keys(diff.added).length === 0 &&
    Object.keys(diff.removed).length === 0 &&
    Object.keys(diff.modified).length === 0
  );
}
