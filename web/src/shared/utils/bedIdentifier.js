/**
 * Bed Identifier Utilities
 * Formats bed IDs into human-readable Bunk labels (Bunk A — Upper, Bunk A — Lower, Bunk B — Upper, Bunk B — Lower)
 */

/**
 * Gets the Bunk Block letter ('A', 'B', etc.) for a bed based on its index or bunkBlock field.
 */
export const getBunkBlockLetter = (bed, index = 0) => {
  if (bed?.bunkBlock && bed.bunkBlock !== "none") {
    return bed.bunkBlock;
  }
  // If bed ID ends with letter or index-based fallback
  const bedId = bed?.id || "";
  const match = bedId.match(/-([A-Z])-[UL]$/i);
  if (match) {
    return match[1].toUpperCase();
  }

  // Numerical fallback based on index in room beds array
  // Index 0 & 1 -> Bunk A, Index 2 & 3 -> Bunk B, Index 4 & 5 -> Bunk C
  const blockIndex = Math.floor(index / 2);
  return String.fromCharCode(65 + blockIndex); // 65 = 'A'
};

/**
 * Gets the full display label for a bed (e.g. "Bunk A — Upper", "Bunk A — Lower")
 */
export const getBedDisplayLabel = (bed, index = 0, roomType = "quadruple-sharing") => {
  if (!bed) return "Bed";

  if (roomType === "private" || bed.position === "single") {
    return "Single Bed";
  }

  const bunkLetter = getBunkBlockLetter(bed, index);
  const isUpper = bed.position === "upper";
  const tier = isUpper ? "Upper" : "Lower";

  return `Bunk ${bunkLetter} — ${tier}`;
};

/**
 * Gets a clean short code for a bed (e.g. "101-A-U", "101-A-L", "101-B-U", "101-B-L")
 */
export const getBedShortCode = (roomNumber = "", bed, index = 0) => {
  if (!bed) return "";
  if (bed.code) return bed.code;

  const roomPrefix = roomNumber ? `${roomNumber}-` : "";
  const bunkLetter = getBunkBlockLetter(bed, index);
  const tierCode = bed.position === "upper" ? "U" : "L";

  return `${roomPrefix}${bunkLetter}-${tierCode}`;
};

/**
 * Groups an array of room beds into bunk frame units for rendering UI
 * Returns: { bunks: [{ bunkBlock: "A", bunkLabel: "Bunk A", upper: BedObj, lower: BedObj }], singleBeds: [...] }
 */
export const groupBedsByBunk = (beds = []) => {
  if (!beds || beds.length === 0) return { bunks: [], singleBeds: [] };

  const upperBeds = beds.filter((b) => b.position === "upper");
  const lowerBeds = beds.filter((b) => b.position === "lower");
  const singleBeds = beds.filter((b) => b.position === "single");

  // Group pairs of upper & lower beds into bunk units
  const maxBunks = Math.max(upperBeds.length, lowerBeds.length);
  const bunks = [];

  for (let i = 0; i < maxBunks; i++) {
    const bunkLetter = String.fromCharCode(65 + i); // A, B, C...
    bunks.push({
      bunkBlock: bunkLetter,
      bunkLabel: `Bunk ${bunkLetter}`,
      upper: upperBeds[i] || null,
      lower: lowerBeds[i] || null,
    });
  }

  return { bunks, singleBeds };
};

/**
 * Formats a raw bed position string or bed object into a clean label (e.g. "Bunk Bed — Upper")
 */
export const formatBedPosition = (bedOrPos) => {
  if (!bedOrPos) return "No Bed Assigned";
  if (typeof bedOrPos === "object" && bedOrPos !== null) {
    return getBedDisplayLabel(bedOrPos);
  }
  const pos = String(bedOrPos).toLowerCase();
  if (pos === "upper") return "Bunk Bed — Upper";
  if (pos === "lower") return "Bunk Bed — Lower";
  if (pos === "single") return "Single Bed";
  return String(bedOrPos);
};

/**
 * Formats a complete coded room and bed identifier string for display across the system
 * Example: "Gil Puyat — Room 305 (Bunk Bed — Upper)"
 */
export const formatCodedRoomAndBed = (roomNumberOrObj, bedOrPos, branchName = "") => {
  const roomNum = typeof roomNumberOrObj === "object" ? (roomNumberOrObj?.roomNumber || roomNumberOrObj?.name || "") : (roomNumberOrObj || "");
  const bedLabel = formatBedPosition(bedOrPos);

  const roomStr = roomNum ? (roomNum.toString().toLowerCase().startsWith("room") ? roomNum : `Room ${roomNum}`) : "";
  const bedStr = bedLabel && bedLabel !== "No Bed Assigned" ? `(${bedLabel})` : "";
  
  const parts = [];
  if (branchName) parts.push(branchName);
  if (roomStr) parts.push(roomStr);
  if (bedStr) parts.push(bedStr);

  return parts.length > 0 ? parts.join(" — ") : "Unassigned";
};
