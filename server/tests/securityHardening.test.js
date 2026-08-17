/**
 * ============================================================================
 * SYSTEM-WIDE SECURITY HARDENING INTEGRATION & UNIT TESTS
 * ============================================================================
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import mongoSanitize from "../middleware/mongoSanitize.js";
import { sanitizeRoomsForViewer } from "../controllers/roomsController.js";
import { verifyWebhookSignature } from "../config/paymongo.js";
import crypto from "crypto";

describe("Security Hardening Verification Suite", () => {
  describe("1. NoSQL Injection & MongoDB Operator Sanitizer", () => {
    it("strips $-prefixed keys and dotted keys from req.body, req.query, and req.params", () => {
      const req = {
        body: {
          username: { $gt: "" },
          validField: "tenant@example.com",
          nested: {
            $ne: null,
            "dangerous.key": "malicious",
            safeKey: 123,
          },
          arrayPayload: [{ $where: "sleep(5000)" }, { safe: true }],
        },
        query: {
          branch: "gil-puyat",
          $regex: ".*",
          "nested.dot": "bad",
        },
        params: {
          roomId: "507f1f77bcf86cd799439011",
          $hack: "injection",
        },
      };

      const next = jest.fn();
      mongoSanitize(req, {}, next);

      expect(next).toHaveBeenCalledTimes(1);

      // Verify req.body
      expect(req.body.username).toEqual({});
      expect(req.body.validField).toBe("tenant@example.com");
      expect(req.body.nested.$ne).toBeUndefined();
      expect(req.body.nested["dangerous.key"]).toBeUndefined();
      expect(req.body.nested.safeKey).toBe(123);
      expect(req.body.arrayPayload[0].$where).toBeUndefined();
      expect(req.body.arrayPayload[1].safe).toBe(true);

      // Verify req.query
      expect(req.query.branch).toBe("gil-puyat");
      expect(req.query.$regex).toBeUndefined();
      expect(req.query["nested.dot"]).toBeUndefined();

      // Verify req.params
      expect(req.params.roomId).toBe("507f1f77bcf86cd799439011");
      expect(req.params.$hack).toBeUndefined();
    });

    it("handles empty or primitive requests gracefully without crashing", () => {
      const next = jest.fn();
      const req = { body: null, query: undefined, params: {} };
      expect(() => mongoSanitize(req, {}, next)).not.toThrow();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("2. Public Room PII Sanitization", () => {
    const mockOccupiedRoom = {
      _id: "room-101",
      name: "Room 101",
      branch: "gil-puyat",
      beds: [
        {
          id: "bed-1",
          bedNumber: 1,
          status: "occupied",
          available: false,
          expectedVacancyDate: new Date("2026-12-01"),
          daysRemaining: 105,
          occupiedBy: {
            userId: "user-123",
            user_id: "T-1001",
            firstName: "Juan",
            lastName: "Dela Cruz",
            name: "Juan Dela Cruz",
            email: "juan@example.com",
            phone: "+639171234567",
            role: "tenant",
            status: "movedIn",
          },
        },
        {
          id: "bed-2",
          bedNumber: 2,
          status: "available",
          available: true,
          occupiedBy: null,
        },
      ],
    };

    it("scrubs all tenant PII (name, email, phone, user IDs) for unauthenticated public requests", () => {
      const publicReq = {};
      const result = sanitizeRoomsForViewer([mockOccupiedRoom], publicReq);

      const bed1 = result[0].beds[0];
      expect(bed1.status).toBe("occupied");
      expect(bed1.available).toBe(false);
      expect(bed1.expectedVacancyDate).toBeDefined();

      // PII must be completely stripped
      expect(bed1.occupiedBy.firstName).toBeNull();
      expect(bed1.occupiedBy.lastName).toBeNull();
      expect(bed1.occupiedBy.name).toBeNull();
      expect(bed1.occupiedBy.email).toBeNull();
      expect(bed1.occupiedBy.phone).toBeNull();
      expect(bed1.occupiedBy.userId).toBeNull();
      expect(bed1.occupiedBy.user_id).toBeNull();
    });

    it("allows full occupant details for authenticated admins and owners", () => {
      const adminReq = {
        authUser: {
          _id: "admin-999",
          role: "admin",
        },
      };

      const result = sanitizeRoomsForViewer([mockOccupiedRoom], adminReq);
      const bed1 = result[0].beds[0];

      expect(bed1.occupiedBy.firstName).toBe("Juan");
      expect(bed1.occupiedBy.email).toBe("juan@example.com");
      expect(bed1.occupiedBy.phone).toBe("+639171234567");
    });

    it("allows a tenant to see their own bed info while hiding other occupants' PII in shared rooms", () => {
      const tenantReq = {
        authUser: {
          _id: "user-123",
          user_id: "T-1001",
          role: "tenant",
        },
      };

      const result = sanitizeRoomsForViewer([mockOccupiedRoom], tenantReq);
      const bed1 = result[0].beds[0];

      // Tenant is Juan, so they can see their own bed details
      expect(bed1.occupiedBy.firstName).toBe("Juan");
      expect(bed1.occupiedBy.email).toBe("juan@example.com");

      // For another tenant viewing this room:
      const otherTenantReq = {
        authUser: {
          _id: "user-456",
          user_id: "T-1002",
          role: "tenant",
        },
      };

      const otherResult = sanitizeRoomsForViewer([mockOccupiedRoom], otherTenantReq);
      const otherBed1 = otherResult[0].beds[0];

      expect(otherBed1.occupiedBy.firstName).toBeNull();
      expect(otherBed1.occupiedBy.email).toBeNull();
      expect(otherBed1.occupiedBy.phone).toBeNull();
    });
  });

  describe("3. PayMongo Webhook Replay Attack Protection", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, PAYMONGO_WEBHOOK_SECRET: "whsec_test_secret_key" };
    });

    it("rejects signatures with missing or invalid timestamp", () => {
      const rawBody = JSON.stringify({ data: { id: "evt_123" } });
      const badHeader = "te=abcdef";

      expect(() => verifyWebhookSignature(rawBody, badHeader)).toThrow(
        "Missing timestamp in Paymongo-Signature header",
      );
    });

    it("rejects expired webhook signatures in production when timestamp exceeds clock drift tolerance", () => {
      process.env.NODE_ENV = "production";
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 400; // 400s ago (> 300s)
      const rawBody = JSON.stringify({ data: { id: "evt_expired" } });
      const payload = `${expiredTimestamp}.${rawBody}`;
      const sig = crypto
        .createHmac("sha256", "whsec_test_secret_key")
        .update(payload)
        .digest("hex");

      const header = `t=${expiredTimestamp},li=${sig}`;

      expect(() => verifyWebhookSignature(rawBody, header)).toThrow(
        "Webhook signature timestamp expired (possible replay attack)",
      );
    });

    it("accepts valid, fresh webhook signatures within allowable time window", () => {
      process.env.NODE_ENV = "production";
      const freshTimestamp = Math.floor(Date.now() / 1000) - 30; // 30s ago
      const bodyObj = { data: { id: "evt_fresh_123" } };
      const rawBody = JSON.stringify(bodyObj);
      const payload = `${freshTimestamp}.${rawBody}`;
      const sig = crypto
        .createHmac("sha256", "whsec_test_secret_key")
        .update(payload)
        .digest("hex");

      const header = `t=${freshTimestamp},li=${sig}`;
      const parsed = verifyWebhookSignature(rawBody, header);

      expect(parsed).toEqual(bodyObj);
    });
  });
});
