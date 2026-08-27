/**
 * ============================================================================
 * MOVE-OUT CLEARANCE CONTROLLER
 * ============================================================================
 *
 * Exposes exactly three admin actions matching the real dormitory workflow:
 * Start Move-Out, Mark Inspected, Complete Move-Out. No endpoint exposes the
 * model's internal enum directly — admins only ever click these three
 * dormitory-language buttons.
 */

import {
  openMoveOutClearance,
  markInspectionComplete,
  completeMoveOutClearance,
  getMoveOutClearance,
  listMoveOutClearances,
} from "../services/moveOutClearanceService.js";
import { getAdminInfo, resolveAdminUserId } from "./billing/_helpers.js";

const fail = (res, error) =>
  res.status(error.statusCode || 500).json({
    error: error.message || "Move-out clearance operation failed",
    code: error.code || "MOVE_OUT_CLEARANCE_OPERATION_FAILED",
  });

export const listMoveOutClearancesAction = async (req, res) => {
  try {
    const clearances = await listMoveOutClearances({
      branch: req.branchFilter || req.query.branch,
      status: req.query.status,
    });
    res.json({ clearances });
  } catch (error) {
    fail(res, error);
  }
};

export const getMoveOutClearanceAction = async (req, res) => {
  try {
    const clearance = await getMoveOutClearance(req.params.id);
    res.json({ clearance });
  } catch (error) {
    fail(res, error);
  }
};

// "Start Move-Out"
export const startMoveOutAction = async (req, res) => {
  try {
    const admin = await getAdminInfo(req);
    const actorId = await resolveAdminUserId(req, admin);
    const { reservationId, tenantId, intendedMoveOutDate } = req.body;
    const clearance = await openMoveOutClearance({
      reservationId,
      tenantId,
      intendedMoveOutDate,
      actorId,
    });
    res.json({ clearance });
  } catch (error) {
    fail(res, error);
  }
};

// "Mark Inspected"
export const markInspectedAction = async (req, res) => {
  try {
    const admin = await getAdminInfo(req);
    const actorId = await resolveAdminUserId(req, admin);
    const clearance = await markInspectionComplete({
      clearanceId: req.params.id,
      actorId,
      inspectionNotes: req.body.inspectionNotes,
    });
    res.json({ clearance });
  } catch (error) {
    fail(res, error);
  }
};

// "Complete Move-Out" — delegates to moveOutStayWorkflow via the service;
// financial logic is untouched, this just records the receipt.
export const completeMoveOutAction = async (req, res) => {
  try {
    const admin = await getAdminInfo(req);
    const actorId = await resolveAdminUserId(req, admin);
    const { clearance, reservation, depositSettlement } = await completeMoveOutClearance({
      clearanceId: req.params.id,
      payload: req.body,
      actorId,
    });
    res.json({ clearance, reservation, depositSettlement });
  } catch (error) {
    fail(res, error);
  }
};
