/**
 * =============================================================================
 * LILYCREST DORMITORY MANAGEMENT SYSTEM - MAIN SERVER
 * =============================================================================
 *
 * This is the main Express.js server for the Lilycrest Dormitory Management System.
 * It handles all backend API requests for two branches: Gil Puyat and Guadalupe.
 *
 * Key Features:
 * - Firebase Authentication integration for secure user management
 * - MongoDB database for storing user, room, reservation, and inquiry data
 * - RESTful API endpoints for all CRUD operations
 * - Role-based access control (tenant, admin, superAdmin)
 * - Email verification system via Firebase
 *
 * Technology Stack:
 * - Express.js: Web framework
 * - MongoDB/Mongoose: Database
 * - Firebase Admin SDK: Authentication & authorization
 * - CORS: Cross-origin resource sharing
 *
 * Author: Lilycrest Development Team
 * Last Updated: February 2026
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/usersRoutes.js";
import roomRoutes from "./routes/roomsRoutes.js";
import reservationRoutes from "./routes/reservationsRoutes.js";
import inquiryRoutes from "./routes/inquiriesRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import billingRoutes from "./api/billing.js";
import announcementRoutes from "./api/announcements.js";
import maintenanceRoutes from "./api/maintenance.js";

// Load environment variables from .env file
dotenv.config();

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

// Connect to MongoDB database
// This will auto-retry on failure (see database.js for retry logic)
connectDB();

// ============================================================================
// EXPRESS APP INITIALIZATION
// ============================================================================

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

/**
 * CORS Middleware
 * Enables cross-origin requests from the React frontend
 * - origin: Specifies which frontend URLs can access the API
 * - credentials: Allows cookies and authorization headers
 */
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:3001",
    ],
    credentials: true,
  }),
);

/**
 * Body Parser Middleware
 * Parses incoming request bodies in JSON and URL-encoded formats
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Authentication Routes (/api/auth/*)
 * Handles user registration, login, profile management, and role assignment
 */
app.use("/api/auth", authRoutes);

/**
 * User Routes (/api/users/*)
 * Handles user management operations (admin only)
 */
app.use("/api/users", userRoutes);

/**
 * Room Routes (/api/rooms/*)
 * Handles room CRUD operations and availability checks
 */
app.use("/api/rooms", roomRoutes);

/**
 * Reservation Routes (/api/reservations/*)
 * Handles booking and reservation management
 */
app.use("/api/reservations", reservationRoutes);

/**
 * Inquiry Routes (/api/inquiries/*)
 * Handles customer inquiries and contact form submissions
 */
app.use("/api/inquiries", inquiryRoutes);

/**
 * Audit Log Routes (/api/audit-logs/*)
 * Handles audit logging and security monitoring (admin only)
 */
app.use("/api/audit-logs", auditRoutes);

/**
 * Billing Routes (/api/billing/*)
 * Handles tenant billing, invoices, and payment tracking (branch-aware)
 */
app.use("/api/billing", billingRoutes);

/**
 * Announcements Routes (/api/announcements/*)
 * Handles system announcements with branch targeting and engagement tracking
 */
app.use("/api/announcements", announcementRoutes);

/**
 * Maintenance Routes (/api/maintenance/*)
 * Handles maintenance requests and tracking (branch-aware)
 */
app.use("/api/maintenance", maintenanceRoutes);

// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================

/**
 * GET /api/health
 * Simple health check endpoint to verify server is running
 * Used by monitoring services and load balancers
 */
app.get("/api/health", (req, res) => {
  try {
    res.json({
      status: "OK",
      message: "Server is running",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      status: "ERROR",
      message: "Server error",
    });
  }
});

// ============================================================================
// GLOBAL ERROR HANDLING MIDDLEWARE
// ============================================================================

/**
 * Error Handler
 * Catches all errors that weren't handled by route-specific try-catch blocks
 * - In development: Returns detailed error messages
 * - In production: Returns generic error messages (security best practice)
 */
app.use((err, req, res, next) => {
  try {
    console.error("❌ Unhandled error:", err.stack);

    res.status(err.status || 500).json({
      error: "Something went wrong!",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (handlerError) {
    // Fallback if error handler itself fails
    console.error("❌ Error handler failed:", handlerError);
    res.status(500).json({ error: "Critical server error" });
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

/**
 * Start the Express server
 * Listens on the specified PORT and logs startup information
 */
const server = app.listen(PORT, () => {
  console.log("🚀 LILYCREST DORMITORY MANAGEMENT SYSTEM");

  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 API available at http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
});

/**
 * Handle server errors (e.g., port already in use)
 */
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error("❌ ERROR: Port", PORT, "is already in use!");
    console.error("⚠️ Another server instance is running.");
    console.error("💡 Solutions:");
    console.error("   1. Stop the other server instance");
    console.error("   2. Run: npx kill-port", PORT);
    console.error(
      "   3. Change PORT in .env file to a different port (e.g., 5001)",
    );
    process.exit(1);
  } else {
    console.error("❌ Server error:", error);
    process.exit(1);
  }
});

/**
 * Graceful shutdown handling
 * Properly close server and database connections on shutdown
 */
const gracefulShutdown = () => {
  console.log("\n⏳ Shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  gracefulShutdown();
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown();
});
