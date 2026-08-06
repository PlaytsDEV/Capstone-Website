import test from "node:test";
import assert from "node:assert/strict";
import {
  filterActiveReservations,
  sortByRecency,
  classifyActiveReservations,
  resolveCurrentReservation,
} from "./reservationSelection.js";

const res = (overrides = {}) => ({
  _id: "id",
  status: "reserved",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

test("filterActiveReservations excludes cancelled, archived, rejected, and isArchived", () => {
  const list = [
    res({ _id: "a", status: "reserved" }),
    res({ _id: "b", status: "cancelled" }),
    res({ _id: "c", status: "rejected" }),
    res({ _id: "d", status: "archived" }),
    res({ _id: "e", status: "reserved", isArchived: true }),
  ];
  const active = filterActiveReservations(list);
  assert.deepEqual(active.map((r) => r._id), ["a"]);
});

test("filterActiveReservations accepts extra terminal statuses", () => {
  const list = [res({ _id: "a", status: "moveOut" }), res({ _id: "b", status: "reserved" })];
  const active = filterActiveReservations(list, ["moveOut"]);
  assert.deepEqual(active.map((r) => r._id), ["b"]);
});

test("sortByRecency orders by updatedAt, falling back to createdAt, regardless of input order", () => {
  const list = [
    res({ _id: "old", createdAt: "2026-01-01T00:00:00.000Z" }),
    res({ _id: "newest", updatedAt: "2026-03-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" }),
    res({ _id: "mid", createdAt: "2026-02-01T00:00:00.000Z" }),
  ];
  const sorted = sortByRecency(list);
  assert.deepEqual(sorted.map((r) => r._id), ["newest", "mid", "old"]);
});

test("sortByRecency is deterministic for an unsorted array (order-independent output)", () => {
  const a = res({ _id: "a", createdAt: "2026-01-05T00:00:00.000Z" });
  const b = res({ _id: "b", createdAt: "2026-01-03T00:00:00.000Z" });
  const c = res({ _id: "c", createdAt: "2026-01-09T00:00:00.000Z" });
  const permutation1 = sortByRecency([a, b, c]).map((r) => r._id);
  const permutation2 = sortByRecency([c, a, b]).map((r) => r._id);
  const permutation3 = sortByRecency([b, c, a]).map((r) => r._id);
  assert.deepEqual(permutation1, ["c", "a", "b"]);
  assert.deepEqual(permutation2, ["c", "a", "b"]);
  assert.deepEqual(permutation3, ["c", "a", "b"]);
});

test("classifyActiveReservations: no active reservations -> normal new-flow (kind: none)", () => {
  const result = classifyActiveReservations([res({ status: "cancelled" })]);
  assert.equal(result.kind, "none");
  assert.equal(result.reservation, null);
});

test("classifyActiveReservations: exactly one active -> safe automatic resume (kind: single)", () => {
  const result = classifyActiveReservations([
    res({ _id: "only", status: "reserved" }),
    res({ _id: "old", status: "cancelled" }),
  ]);
  assert.equal(result.kind, "single");
  assert.equal(result.reservation._id, "only");
});

test("classifyActiveReservations: multiple active -> recovery, never a silent pick (kind: multiple)", () => {
  const result = classifyActiveReservations([
    res({ _id: "a", status: "reserved", createdAt: "2026-01-01T00:00:00.000Z" }),
    res({ _id: "b", status: "pending_application_review", createdAt: "2026-01-02T00:00:00.000Z" }),
  ]);
  assert.equal(result.kind, "multiple");
  assert.equal(result.reservation, null, "must not silently pick one of the two");
  assert.equal(result.active.length, 2);
});

test("resolveCurrentReservation: keeps a still-valid selection stable across re-resolution", () => {
  const list = [
    res({ _id: "a", createdAt: "2026-01-01T00:00:00.000Z" }),
    res({ _id: "b", createdAt: "2026-01-05T00:00:00.000Z" }),
  ];
  const { reservation, nextSelectedId } = resolveCurrentReservation(list, "a");
  assert.equal(reservation._id, "a");
  assert.equal(nextSelectedId, "a");
});

test("resolveCurrentReservation: re-syncs to the most-recent reservation when the selection becomes ineligible", () => {
  const list = [
    res({ _id: "a", status: "cancelled", createdAt: "2026-01-01T00:00:00.000Z" }),
    res({ _id: "b", status: "reserved", createdAt: "2026-01-05T00:00:00.000Z" }),
  ];
  const { reservation, nextSelectedId } = resolveCurrentReservation(list, "a");
  assert.equal(reservation._id, "b");
  assert.equal(nextSelectedId, "b");
});

test("resolveCurrentReservation: clears selection when no reservations are eligible", () => {
  const list = [res({ _id: "a", status: "cancelled" })];
  const { reservation, nextSelectedId } = resolveCurrentReservation(list, "a");
  assert.equal(reservation, null);
  assert.equal(nextSelectedId, null);
});

test("resolveCurrentReservation: re-syncs when a new reservation is created (data changes)", () => {
  const before = [res({ _id: "a", createdAt: "2026-01-01T00:00:00.000Z" })];
  const after = [
    res({ _id: "a", createdAt: "2026-01-01T00:00:00.000Z" }),
    res({ _id: "new", createdAt: "2026-02-01T00:00:00.000Z" }),
  ];
  const first = resolveCurrentReservation(before, null);
  assert.equal(first.nextSelectedId, "a");
  // Selection "a" is still valid, so it stays selected even though "new" now
  // exists and is more recent — explicit user selection is preserved.
  const second = resolveCurrentReservation(after, first.nextSelectedId);
  assert.equal(second.nextSelectedId, "a");
});
