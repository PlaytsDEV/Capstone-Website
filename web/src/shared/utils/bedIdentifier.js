/**
 * Bed Identifier Utilities
 * Formats bed IDs into human-readable Bunk labels (Bunk A — Upper, Bunk A — Lower, Bunk B — Upper, Bunk B — Lower)
 */

/**
 * Gets the Bunk Block letter ('A', 'B', etc.) for a bed based on its bunkBlock field, ID/code, or index.
 */
export const getBunkBlockLetter = (bed, index) => {
  // If bed ID or code ends with -[A-Z]-[UL] or contains bunk information (e.g., -B-U, -B-L)
  const bedIdentifier = String(bed?.code || bed?.id || bed?._id || "");
  const match = bedIdentifier.match(/[-_]([A-Z])[-_][UL]$/i) || bedIdentifier.match(/bunk[-_\s]*([A-Z])/i);
  if (match) {
    return match[1].toUpperCase();
  }

  // If index is provided and valid, use natural pairing (index 0,1 -> A; index 2,3 -> B; index 4,5 -> C)
  // unless the bed object has an explicitly differentiated bunkBlock (e.g., 'B', 'C')
  if (typeof index === "number" && index >= 0) {
    const blockIndex = Math.floor(index / 2);
    const expectedLetter = String.fromCharCode(65 + blockIndex);
    if (bed?.bunkBlock && bed.bunkBlock !== "none" && bed.bunkBlock !== "A") {
      return String(bed.bunkBlock).toUpperCase();
    }
    return expectedLetter;
  }

  if (bed?.bunkBlock && bed.bunkBlock !== "none") {
    return String(bed.bunkBlock).toUpperCase();
  }

  return "A";
};

/**
 * Gets the full display label for a bed (e.g. "Bunk A — Upper", "Bunk A — Lower")
 */
export const getBedDisplayLabel = (bed, index, roomType = "quadruple-sharing") => {
  if (!bed) return "Bed";

  if (typeof bed === "string") {
    return formatBedPosition(bed);
  }

  const normType = String(roomType || "").toLowerCase();
  if (normType === "private" || bed.position === "single") {
    return "Single Bed";
  }

  const bunkLetter = getBunkBlockLetter(bed, index);
  const pos = String(bed.position || "").toLowerCase();
  const isUpper = pos === "upper";
  const tier = isUpper ? "Upper" : pos === "lower" ? "Lower" : bed.position || "Bed";

  return `Bunk ${bunkLetter} — ${tier}`;
};

/**
 * Gets a clean short code for a bed (e.g. "101-A-U", "101-A-L", "101-B-U", "101-B-L")
 */
export const getBedShortCode = (roomNumber = "", bed, index) => {
  if (!bed) return "";
  if (typeof bed === "string") return bed;
  if (bed.code) return bed.code;

  const roomPrefix = roomNumber ? `${roomNumber}-` : "";
  const bunkLetter = getBunkBlockLetter(bed, index);
  const pos = String(bed.position || "").toLowerCase();
  const tierCode = pos === "upper" ? "U" : pos === "lower" ? "L" : "S";

  return `${roomPrefix}${bunkLetter}-${tierCode}`;
};

/**
 * Groups an array of room beds into bunk frame units for rendering UI
 * Returns: { bunks: [{ bunkBlock: "A", bunkLabel: "Bunk A", upper: BedObj, lower: BedObj }], singleBeds: [...] }
 */
export const groupBedsByBunk = (beds = []) => {
  if (!beds || beds.length === 0) return { bunks: [], singleBeds: [] };

  const singleBeds = [];
  const bunkBeds = [];

  beds.forEach((bed, index) => {
    if (!bed) return;
    const pos = String(bed.position || "").toLowerCase();
    if (pos === "single") {
      singleBeds.push(bed);
    } else {
      bunkBeds.push({ ...bed, _originalIndex: index });
    }
  });

  if (bunkBeds.length === 0) {
    return { bunks: [], singleBeds };
  }

  // Count occurrences of upper/lower per bunkBlock to detect if all beds have the same default 'A'
  const blockCounts = {};
  let hasOverlapWithinBlock = false;
  bunkBeds.forEach((b) => {
    const rawBlock = b.bunkBlock && b.bunkBlock !== "none" ? String(b.bunkBlock).toUpperCase() : null;
    if (rawBlock) {
      const pos = String(b.position || "").toLowerCase() === "upper" ? "upper" : "lower";
      blockCounts[rawBlock] = blockCounts[rawBlock] || { upper: 0, lower: 0 };
      blockCounts[rawBlock][pos] = (blockCounts[rawBlock][pos] || 0) + 1;
      if (blockCounts[rawBlock][pos] > 1) {
        hasOverlapWithinBlock = true;
      }
    }
  });

  const distinctBlocks = Object.keys(blockCounts);

  // Case 1: Beds have properly assigned, non-overlapping distinct bunk blocks (e.g. 'A', 'B')
  if (distinctBlocks.length > 1 && !hasOverlapWithinBlock) {
    const bunkMap = new Map();
    bunkBeds.forEach((bed) => {
      const block = String(bed.bunkBlock).toUpperCase();
      if (!bunkMap.has(block)) {
        bunkMap.set(block, {
          bunkBlock: block,
          bunkLabel: `Bunk ${block}`,
          upper: null,
          lower: null,
        });
      }
      const entry = bunkMap.get(block);
      const pos = String(bed.position || "").toLowerCase();
      if (pos === "upper") {
        entry.upper = bed;
      } else {
        entry.lower = bed;
      }
    });

    const bunks = Array.from(bunkMap.values()).sort((a, b) => a.bunkBlock.localeCompare(b.bunkBlock));
    return { bunks, singleBeds };
  }

  // Case 2: Beds don't have distinct non-overlapping bunk blocks (e.g. all defaulted to 'A' in DB, or raw array)
  // Pair upper & lower beds into Bunk A, Bunk B, etc. by natural index sequence
  const upperBeds = bunkBeds.filter((b) => String(b.position || "").toLowerCase() === "upper");
  const lowerBeds = bunkBeds.filter((b) => String(b.position || "").toLowerCase() === "lower");
  const maxBunks = Math.max(upperBeds.length, lowerBeds.length, Math.ceil(bunkBeds.length / 2));
  const bunks = [];

  for (let i = 0; i < maxBunks; i++) {
    const bunkLetter = String.fromCharCode(65 + i); // A, B, C...
    const upper = upperBeds[i] || null;
    const lower = lowerBeds[i] || null;

    bunks.push({
      bunkBlock: bunkLetter,
      bunkLabel: `Bunk ${bunkLetter}`,
      upper: upper ? { ...upper, bunkBlock: bunkLetter } : null,
      lower: lower ? { ...lower, bunkBlock: bunkLetter } : null,
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
  if (pos === "private room" || pos === "private" || pos === "entire room") return "Private Room";
  if (pos === "upper") return "Bunk Bed — Upper";
  if (pos === "lower") return "Bunk Bed — Lower";
  if (pos === "single") return "Single Bed";
  return String(bedOrPos);
};

/**
 * Formats a complete coded room and bed identifier string for display across the system
 * Example: "Gil Puyat — Room 305 (Bunk Bed — Upper)" or "Gil Puyat — GP - Room 803" for private rooms.
 */
export const formatCodedRoomAndBed = (roomNumberOrObj, bedOrPos, branchName = "") => {
  const roomNum = typeof roomNumberOrObj === "object" ? (roomNumberOrObj?.roomNumber || roomNumberOrObj?.name || "") : (roomNumberOrObj || "");
  const roomType = typeof roomNumberOrObj === "object" ? String(roomNumberOrObj?.type || "").toLowerCase() : "";
  const bedPosStr = String(bedOrPos || "").toLowerCase();
  const isPrivate = roomType.includes("private") || String(roomNum).toLowerCase().includes("private") || bedPosStr.includes("private");
  const bedLabel = isPrivate ? "" : formatBedPosition(bedOrPos);

  const roomStr = roomNum ? (roomNum.toString().toLowerCase().startsWith("room") ? roomNum : `Room ${roomNum}`) : "";
  const bedStr = bedLabel && bedLabel !== "No Bed Assigned" && bedLabel !== "Private Room" ? `(${bedLabel})` : "";
  
  const parts = [];
  if (branchName) parts.push(branchName);
  if (roomStr) parts.push(roomStr);
  if (bedStr) parts.push(bedStr);

  return parts.length > 0 ? parts.join(" — ") : "Unassigned";
};
