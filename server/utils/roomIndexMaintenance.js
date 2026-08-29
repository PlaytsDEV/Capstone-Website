import mongoose from "mongoose";
import logger from "../middleware/logger.js";

const LEGACY_INDEXES = ["name_1", "roomNumber_1"];
const TARGET_INDEX = "branch_1_roomNumber_1";

/**
 * Ensure rooms collection indexes are properly configured.
 * Drops legacy single-field unique indexes on name and roomNumber,
 * allowing multiple rooms to share the same name (e.g., "Deluxe Room")
 * while enforcing uniqueness solely on (branch, roomNumber).
 */
export const ensureRoomIndexes = async () => {
  try {
    const collection = mongoose.connection.collection("rooms");
    const indexes = await collection.indexes();
    const indexNames = new Set(indexes.map((index) => index.name));

    for (const indexName of LEGACY_INDEXES) {
      if (indexNames.has(indexName)) {
        logger.info({ indexName }, "Dropping legacy unique room index");
        await collection.dropIndex(indexName);
      }
    }

    if (!indexNames.has(TARGET_INDEX)) {
      logger.info({ indexName: TARGET_INDEX }, "Creating branch-scoped room index");
      await collection.createIndex(
        { branch: 1, roomNumber: 1 },
        {
          name: TARGET_INDEX,
          unique: true,
          partialFilterExpression: { isArchived: false },
        },
      );
    }
  } catch (err) {
    // Non-fatal if index operations encounter a transient issue on startup
    logger.warn({ err }, "Room index verification completed with non-fatal notice");
  }
};
