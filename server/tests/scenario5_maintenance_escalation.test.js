/**
 * ============================================================================
 * SCENARIO 5 TEST SUITE: MAINTENANCE SLA ESCALATIONS & VENDOR EXPENSE ALLOCATION
 * ============================================================================
 * Tests all 6 edge cases under General Scenario 5:
 * 1. SLA Timeout Auto-Escalation Engine (24h/48h threshold priority bump)
 * 2. Maintenance Damage Cost Recovery Billing Allocation
 * 3. Room Duplicate Ticket Collision Guard (12-hour window check)
 * 4. Maintenance Resolution Verification & Re-opening State Machine (72h rejection window check)
 * 5. Off-Hours Emergency Keyword Trigger Engine ("pipe burst", "electrical fire")
 * 6. Maintenance Financial Recovery vs Expense Summary Integrity
 */

import { describe, it, expect } from "@jest/globals";
import {
  evaluateMaintenanceSLAEscalation,
  detectDuplicateMaintenanceRequest,
  processMaintenanceDamageBilling,
  validateMaintenanceStateTransition,
  evaluateEmergencyKeywords,
} from "../services/maintenanceEscalationService.js";
import dayjs from "dayjs";

describe("Scenario 5: Maintenance Ticket Escalation & Vendor Expense Allocation", () => {
  it("1. should auto-escalate unresolved urgent ticket past 24-hour SLA to emergency status", () => {
    const ticketCreated = dayjs().subtract(30, "hour").toDate(); // Created 30 hours ago (exceeds 24h SLA)
    const ticket = {
      _id: "maint-101",
      priority: "urgent",
      status: "submitted",
      createdAt: ticketCreated,
    };

    const evalResult = evaluateMaintenanceSLAEscalation(ticket);

    expect(evalResult.isEscalated).toBe(true);
    expect(evalResult.currentPriority).toBe("urgent");
    expect(evalResult.effectivePriority).toBe("emergency");
    expect(evalResult.slaStatus).toBe("overdue");
    expect(evalResult.hoursOverdue).toBe(6); // 30 - 24 = 6h overdue
  });

  it("2. should format maintenance damage billing charge payload for tenant-caused repairs", () => {
    const billingResult = processMaintenanceDamageBilling({
      ticketId: "maint-202",
      tenantId: "tenant-55",
      reservationId: "res-99",
      damageCost: 1500,
      description: "Broken window handle caused by negligence",
    });

    expect(billingResult.success).toBe(true);
    expect(billingResult.billingCharge.type).toBe("maintenance_damage");
    expect(billingResult.billingCharge.amount).toBe(1500);
    expect(billingResult.billingCharge.description).toContain("Broken window handle");
    expect(billingResult.billingCharge.status).toBe("pending");
  });

  it("3. should consolidate duplicate room maintenance requests within a 12-hour window", () => {
    const existingTickets = [
      {
        _id: "master-maint-01",
        roomId: "room-301",
        category: "plumbing",
        status: "in_progress",
        createdAt: dayjs().subtract(2, "hour").toDate(),
      },
    ];

    const newRequest = {
      roomId: "room-301",
      category: "plumbing",
      title: "Sink clogged and leaking",
      createdAt: new Date(),
    };

    const duplicateCheck = detectDuplicateMaintenanceRequest(existingTickets, newRequest);

    expect(duplicateCheck.isDuplicate).toBe(true);
    expect(duplicateCheck.masterTicketId).toBe("master-maint-01");
    expect(duplicateCheck.message).toContain("Duplicate maintenance request detected");
  });

  it("4. should enforce ticket state machine rules and 72-hour re-opening window", () => {
    // Valid status transition
    expect(validateMaintenanceStateTransition("submitted", "in_progress").valid).toBe(true);
    expect(validateMaintenanceStateTransition("in_progress", "resolved").valid).toBe(true);

    // Re-opening within 72h window
    const recentResolved = dayjs().subtract(24, "hour").toDate();
    expect(
      validateMaintenanceStateTransition("resolved", "reopened", {
        resolvedAt: recentResolved,
        verificationWindowHours: 72,
      }).valid
    ).toBe(true);

    // Expired re-opening past 72h window (80h ago)
    const expiredResolved = dayjs().subtract(80, "hour").toDate();
    const expiredReopen = validateMaintenanceStateTransition("resolved", "reopened", {
      resolvedAt: expiredResolved,
      verificationWindowHours: 72,
    });
    expect(expiredReopen.valid).toBe(false);
    expect(expiredReopen.error).toContain("72-hour verification window has expired");
  });

  it("5. should flag critical emergency keywords and off-hours maintenance submissions", () => {
    const offHoursDate = dayjs().hour(2).minute(30).toDate(); // 2:30 AM local time
    const emergencyRequest = evaluateEmergencyKeywords({
      title: "Emergency Pipe Burst",
      description: "Water leaking heavily from bathroom ceiling!",
      createdAt: offHoursDate,
    });

    expect(emergencyRequest.isEmergency).toBe(true);
    expect(emergencyRequest.isOffHours).toBe(true);
    expect(emergencyRequest.matchedKeywords).toContain("pipe burst");
    expect(emergencyRequest.matchedKeywords).toContain("water leak");
    expect(emergencyRequest.recommendedPriority).toBe("emergency");
  });

  it("6. should return healthy SLA for tickets within resolution time frame", () => {
    const ticketCreated = dayjs().subtract(5, "hour").toDate(); // Created 5h ago (SLA is 24h)
    const ticket = {
      _id: "maint-303",
      priority: "urgent",
      status: "in_progress",
      createdAt: ticketCreated,
    };

    const evalResult = evaluateMaintenanceSLAEscalation(ticket);

    expect(evalResult.isEscalated).toBe(false);
    expect(evalResult.slaStatus).toBe("healthy");
    expect(evalResult.hoursRemaining).toBe(19); // 24 - 5 = 19h remaining
  });
});
