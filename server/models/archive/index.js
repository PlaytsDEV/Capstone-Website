/**
 * ============================================================================
 * ARCHIVE SCHEMA EXTENSIONS
 * ============================================================================
 *
 * This file contains reusable schema fields for soft delete functionality.
 * Import these into your models to add archive support.
 *
 * USAGE:
 *   import { archiveFields, archiveMethods, archiveStatics } from "./archive/index.js";
 *
 *   const mySchema = new mongoose.Schema({
 *     ...archiveFields,
 *     // your other fields
 *   });
 *
 *   mySchema.methods = { ...mySchema.methods, ...archiveMethods };
 *   mySchema.statics = { ...mySchema.statics, ...archiveStatics };
 *
 * ============================================================================
 */

import mongoose from "mongoose";

// ============================================================================
// ARCHIVE FIELDS
// ============================================================================

/**
 * Standard fields for soft delete functionality.
 * Add these to any schema that needs archive support.
 */
export const archiveFields = {
  isArchived: {
    type: Boolean,
    default: false,
    index: true,
  },
  archivedAt: {
    type: Date,
    default: null,
  },
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
};

// ============================================================================
// ARCHIVE METHODS
// ============================================================================

/**
 * Instance methods for archive operations.
 * Add these to schema.methods
 */
export const archiveMethods = {
  /**
   * Soft delete this document
   * @param {ObjectId} archivedById - ID of user performing the archive
   */
  archive: async function (archivedById = null) {
    this.isArchived = true;
    this.archivedAt = new Date();
    this.archivedBy = archivedById;
    return this.save();
  },

  /**
   * Restore an archived document
   */
  restore: async function () {
    this.isArchived = false;
    this.archivedAt = null;
    this.archivedBy = null;
    return this.save();
  },
};

// ============================================================================
// ARCHIVE STATICS
// ============================================================================

/**
 * Static methods for querying archived/active documents.
 * Add these to schema.statics
 */
export const archiveStatics = {
  /**
   * Find all active (non-archived) documents
   */
  findActive: function (filter = {}) {
    return this.find({ ...filter, isArchived: false });
  },

  /**
   * Find all archived documents
   */
  findArchived: function (filter = {}) {
    return this.find({ ...filter, isArchived: true });
  },

  /**
   * Count active documents
   */
  countActive: function (filter = {}) {
    return this.countDocuments({ ...filter, isArchived: false });
  },

  /**
   * Count archived documents
   */
  countArchived: function (filter = {}) {
    return this.countDocuments({ ...filter, isArchived: true });
  },
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  archiveFields,
  archiveMethods,
  archiveStatics,
};
