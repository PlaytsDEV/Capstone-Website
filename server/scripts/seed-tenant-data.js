/**
 * ============================================================================
 * SEED TEST DATA FOR NEW MODELS
 * ============================================================================
 *
 * Script to populate the database with test data for:
 * - Bills
 * - Announcements
 * - Maintenance Requests
 * - Acknowledgment Accounts
 *
 * Usage: node scripts/seed-tenant-data.js
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../config/database.js";
import {
  Bill,
  Announcement,
  MaintenanceRequest,
  AcknowledgmentAccount,
  Reservation,
  User,
} from "../models/index.js";

dotenv.config();

const branches = ["gil-puyat", "guadalupe"];

const seedData = async () => {
  try {
    await connectDB();
    console.log("✅ Connected to MongoDB");

    // Get sample users and reservations
    const users = await User.find({ role: "tenant" }).limit(10);
    const reservations = await Reservation.find({
      status: "checked-in",
    }).limit(5);

    if (users.length === 0 || reservations.length === 0) {
      console.log(
        "⚠️  Not enough tenant users or active reservations found. Create some first.",
      );
      process.exit(0);
    }

    console.log(
      `Found ${users.length} users and ${reservations.length} reservations`,
    );

    // ========================================================================
    // SEED BILLS
    // ========================================================================
    console.log("\n📝 Seeding Bills...");

    const bills = [];
    for (const reservation of reservations) {
      const currentDate = new Date();
      for (let i = 0; i < 3; i++) {
        const billingMonth = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - i,
          1,
        );

        bills.push({
          reservationId: reservation._id,
          userId: reservation.userId,
          branch: reservation.branch,
          billingMonth,
          dueDate: new Date(
            billingMonth.getFullYear(),
            billingMonth.getMonth(),
            15,
          ),
          charges: {
            rent: 5000,
            electricity: 1200 + Math.floor(Math.random() * 500),
            water: 500,
            applianceFees: 800,
            corkageFees: 0,
            penalty: i > 0 ? 0 : Math.random() > 0.7 ? 500 : 0,
            discount: 0,
          },
          totalAmount: 8000 + Math.floor(Math.random() * 1000),
          status: i === 0 ? "pending" : "paid",
          paidAmount: i === 0 ? 0 : 8500,
          paymentDate:
            i === 0 ? null : new Date(billingMonth.getTime() + 86400000 * 7),
        });
      }
    }

    await Bill.insertMany(bills);
    console.log(`✅ Created ${bills.length} bills`);

    // ========================================================================
    // SEED ANNOUNCEMENTS
    // ========================================================================
    console.log("\n📢 Seeding Announcements...");

    const announcements = [
      {
        title: "Monthly Billing Reminder",
        content:
          "Your February bill is now available. Please settle your payment on or before the due date.",
        category: "reminder",
        targetBranch: "both",
        visibility: "public",
        publishedBy: users[0]._id,
        requiresAcknowledgment: false,
        isPinned: true,
      },
      {
        title: "Scheduled Maintenance: Water System",
        content:
          "Water supply will be temporarily shut off on Feb 10 from 9AM-12PM for scheduled maintenance.",
        category: "maintenance",
        targetBranch: "gil-puyat",
        visibility: "public",
        publishedBy: users[0]._id,
        requiresAcknowledgment: true,
        isPinned: true,
      },
      {
        title: "New House Policy on Visitors",
        content:
          "Effective March 1, all visitors must register at the reception desk before entering.",
        category: "policy",
        targetBranch: "both",
        visibility: "public",
        publishedBy: users[0]._id,
        requiresAcknowledgment: true,
      },
      {
        title: "Electricity Rates Update",
        content:
          "Starting March 1st, electricity rates will be adjusted to ₱12.50 per kWh.",
        category: "alert",
        targetBranch: "guadalupe",
        visibility: "public",
        publishedBy: users[0]._id,
        requiresAcknowledgment: false,
      },
      {
        title: "WiFi Maintenance Notice",
        content:
          "WiFi network will undergo maintenance on February 12 from 2AM to 6AM. Services will resume automatically.",
        category: "maintenance",
        targetBranch: "both",
        visibility: "public",
        publishedBy: users[0]._id,
        requiresAcknowledgment: false,
      },
    ];

    const createdAnnouncements = await Announcement.insertMany(announcements);
    console.log(`✅ Created ${createdAnnouncements.length} announcements`);

    // ========================================================================
    // SEED ACKNOWLEDGMENT ACCOUNTS
    // ========================================================================
    console.log("\n✓ Seeding Acknowledgment Accounts...");

    const ackAccounts = [];
    for (const announcement of createdAnnouncements) {
      if (announcement.requiresAcknowledgment) {
        for (const user of users) {
          ackAccounts.push({
            userId: user._id,
            announcementId: announcement._id,
            isRead: Math.random() > 0.3,
            readAt: Math.random() > 0.3 ? new Date() : null,
            isAcknowledged: Math.random() > 0.5,
            acknowledgedAt: Math.random() > 0.5 ? new Date() : null,
          });
        }
      }
    }

    await AcknowledgmentAccount.insertMany(ackAccounts);
    console.log(`✅ Created ${ackAccounts.length} acknowledgment records`);

    // ========================================================================
    // SEED MAINTENANCE REQUESTS
    // ========================================================================
    console.log("\n🔧 Seeding Maintenance Requests...");

    const categories = [
      "plumbing",
      "electrical",
      "hardware",
      "appliance",
      "cleaning",
      "other",
    ];
    const statuses = ["pending", "in-progress", "completed"];
    const issues = [
      { title: "Leaking faucet", category: "plumbing" },
      { title: "Broken door lock", category: "hardware" },
      { title: "Light bulb replacement", category: "electrical" },
      { title: "AC not cooling", category: "appliance" },
      { title: "Clogged drain", category: "plumbing" },
      { title: "Loose cabinet door", category: "hardware" },
      { title: "Refrigerator making noise", category: "appliance" },
      { title: "Room deep cleaning needed", category: "cleaning" },
      { title: "Water leakage from ceiling", category: "plumbing" },
      { title: "Creaky floor boards", category: "other" },
    ];

    const maintenanceRequests = [];
    for (const reservation of reservations) {
      for (let i = 0; i < 3; i++) {
        const issue = issues[Math.floor(Math.random() * issues.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const createdDate = new Date();
        createdDate.setDate(
          createdDate.getDate() - Math.floor(Math.random() * 30),
        );

        maintenanceRequests.push({
          reservationId: reservation._id,
          userId: reservation.userId,
          branch: reservation.branch,
          category: issue.category,
          title: issue.title,
          description: `${issue.title}. Please check and fix at your earliest convenience.`,
          urgency: ["low", "medium", "high"][Math.floor(Math.random() * 3)],
          status,
          assignedTo: status !== "pending" ? users[0]._id : null,
          assignedAt: status !== "pending" ? new Date() : null,
          completedAt: status === "completed" ? new Date() : null,
          resolvedAt: status === "completed" ? new Date() : null,
          completionNote:
            status === "completed"
              ? `Issue resolved and tested. Everything is working properly.`
              : "",
          createdAt: createdDate,
        });
      }
    }

    await MaintenanceRequest.insertMany(maintenanceRequests);
    console.log(
      `✅ Created ${maintenanceRequests.length} maintenance requests`,
    );

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log("\n✨ Seed completed successfully!");
    console.log("========================================");
    console.log(`Bills: ${bills.length}`);
    console.log(`Announcements: ${createdAnnouncements.length}`);
    console.log(`Acknowledgment Records: ${ackAccounts.length}`);
    console.log(`Maintenance Requests: ${maintenanceRequests.length}`);
    console.log("========================================");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error);
    process.exit(1);
  }
};

seedData();
