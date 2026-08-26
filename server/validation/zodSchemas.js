import { z } from "zod";
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_TARGET_BRANCHES,
  ANNOUNCEMENT_VISIBILITY,
} from "../config/announcements.js";

export const setRoleSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: z.enum(["applicant", "tenant", "branch_admin", "owner"]),
});

export const updateBranchSchema = z.object({
  branch: z.enum(["gil-puyat", "guadalupe"]),
});

export const createInquirySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address"),
  phone: z.string().optional(),
  subject: z.string().trim().min(3, "Subject is required"),
  message: z.string().trim().min(5, "Message must be at least 5 characters"),
  branch: z.enum(["gil-puyat", "guadalupe", "general"]),
  source: z.string().optional(),
  sourceNote: z.string().optional(),
});

export const createMaintenanceSchema = z.object({
  category: z.string().min(1, "Category is required"),
  title: z.string().trim().min(3, "Title must be at least 3 characters"),
  description: z.string().trim().min(5, "Description must be at least 5 characters"),
});

export const createAnnouncementSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Announcement title must be between 3 and 120 characters.")
    .max(120, "Announcement title must be between 3 and 120 characters."),
  content: z
    .string()
    .trim()
    .min(5, "Announcement content must be between 5 and 2000 characters.")
    .max(2000, "Announcement content must be between 5 and 2000 characters."),
  category: z.enum([...ANNOUNCEMENT_CATEGORIES]),
  contentType: z.enum(["announcement", "policy"]).optional().default("announcement"),
  targetBranch: z.enum([...ANNOUNCEMENT_TARGET_BRANCHES]).optional().default("both"),
  visibility: z.enum([...ANNOUNCEMENT_VISIBILITY]).optional().default("tenants-only"),
  requiresAcknowledgment: z.boolean().optional().default(false),
  isPinned: z.boolean().optional().default(false),
  publicationStatus: z.enum(["draft", "scheduled", "published", "superseded"]).optional(),
  startsAt: z.union([z.string(), z.date()]).optional().nullable(),
  endsAt: z.union([z.string(), z.date()]).optional().nullable(),
  effectiveDate: z.union([z.string(), z.date()]).optional().nullable(),
  policyKey: z.string().optional().nullable(),
  version: z.union([z.number(), z.string()]).optional(),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

export const updateUserSchema = z.object({
  username: z.string().trim().min(3).max(30).optional(),
  firstName: z.string().trim().min(1, "First name is required").max(50).optional(),
  lastName: z.string().trim().min(1, "Last name is required").max(50).optional(),
  email: z.string().trim().email("Invalid email format").optional(),
  phone: z.string().optional().nullable(),
  gender: z.enum(["male", "female", "other", "prefer-not-to-say", ""]).optional(),
  dateOfBirth: z.string().optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  emergencyContact: z.string().max(100).optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  studentId: z.string().max(50).optional().nullable(),
  school: z.string().max(100).optional().nullable(),
  yearLevel: z.string().max(50).optional().nullable(),
  role: z.enum(["applicant", "tenant", "branch_admin", "owner"]).optional(),
  branch: z.enum(["gil-puyat", "guadalupe", ""]).optional().nullable(),
});

export const createRoomSchema = z.object({
  name: z.string().trim().min(1).optional(),
  roomNumber: z.string().trim().min(1, "Room number is required"),
  branch: z.enum(["gil-puyat", "guadalupe"]),
  type: z.enum(["private", "double-sharing", "quadruple-sharing"]),
  capacity: z.number().int().min(1).max(20),
  baseRate: z.number().min(0).optional(),
  floor: z.union([z.number(), z.string()]).optional(),
});

export const updateRoomSchema = createRoomSchema.partial();

export const createViolationSchema = z.object({
  tenantId: z.string().min(1, "Tenant is required"),
  violationType: z.string().min(1, "Violation category/type is required"),
  dateOfIncident: z.union([z.string(), z.date()]).optional(),
  location: z.string().optional(),
  description: z.string().trim().min(5, "Description must be at least 5 characters"),
  severity: z.enum(["minor", "moderate", "severe", "critical"]).optional().default("minor"),
  penaltyAmount: z.number().min(0).optional().default(0),
});

