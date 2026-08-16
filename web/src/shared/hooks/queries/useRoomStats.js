import { useMemo } from "react";

/**
 * getEffectiveOccupancy
 * Bed-accurate occupancy that accounts for both the DB field and actual bed statuses.
 * @param {object} room
 * @returns {number}
 */
function getEffectiveOccupancy(room) {
  if (!room) return 0;
  const occupiedFromBeds = (room.beds || []).filter(
    (b) => b.status === "occupied" || b.status === "reserved" || Boolean(b.occupiedBy?.userId)
  ).length;
  return Math.max(Number(room.currentOccupancy || 0), occupiedFromBeds);
}

/**
 * useRoomStats
 * Derives a unified room statistics object from a rooms array.
 * Uses bed-accurate occupancy (getEffectiveOccupancy) as the standard.
 *
 * @param {Array} rooms - Array of room objects from useRooms()
 * @returns {{
 *   total: number,
 *   available: number,
 *   partial: number,
 *   full: number,
 *   maintenance: number,
 *   rate: string,        // occupancy rate as "XX.X" string (percentage)
 *   totalCapacity: number,
 *   totalOccupancy: number,
 *   availableBeds: number,
 * }}
 */
export function useRoomStats(rooms) {
  return useMemo(() => {
    const safeRooms = Array.isArray(rooms) ? rooms : [];

    const total = safeRooms.length;
    const totalCapacity = safeRooms.reduce((sum, r) => sum + (r.capacity || 0), 0);

    const totalOccupancy = safeRooms.reduce(
      (sum, r) => sum + getEffectiveOccupancy(r),
      0
    );

    const availableBeds = safeRooms.reduce((sum, room) => {
      const available = Array.isArray(room.beds)
        ? room.beds.filter((bed) => bed.status === "available").length
        : Math.max((room.capacity || 0) - getEffectiveOccupancy(room), 0);
      return sum + available;
    }, 0);

    const full = safeRooms.filter((r) => {
      const mBeds = (r.beds || []).filter((b) => b.status === "maintenance").length;
      const effCap = Math.max(0, (r.capacity || 0) - mBeds);
      const effOcc = getEffectiveOccupancy(r);
      return effOcc >= effCap && effCap > 0;
    }).length;

    const partial = safeRooms.filter((r) => {
      const mBeds = (r.beds || []).filter((b) => b.status === "maintenance").length;
      const effCap = Math.max(0, (r.capacity || 0) - mBeds);
      const effOcc = getEffectiveOccupancy(r);
      return effOcc > 0 && effOcc < effCap;
    }).length;

    const available = safeRooms.filter((r) => {
      const mBeds = (r.beds || []).filter((b) => b.status === "maintenance").length;
      const effCap = Math.max(0, (r.capacity || 0) - mBeds);
      const effOcc = getEffectiveOccupancy(r);
      return effOcc < effCap && effCap > 0;
    }).length;

    const maintenance = safeRooms.filter((r) => {
      const mBeds = (r.beds || []).filter((b) => b.status === "maintenance").length;
      return mBeds > 0 || r.status === "maintenance";
    }).length;

    const rate =
      totalCapacity > 0
        ? Number(((totalOccupancy / totalCapacity) * 100).toFixed(1))
        : 0;

    return {
      total,
      totalRooms: total,
      available,
      partial,
      full,
      maintenance,
      rate,
      totalCapacity,
      totalOccupancy,
      availableBeds,
    };
  }, [rooms]);
}
