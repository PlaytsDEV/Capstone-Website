/**
 * ============================================================================
 * LILYCREST DORMITORY MANAGEMENT SYSTEM - SERVER
 * ============================================================================
 *
 * Production-grade Express.js server with:
 * - Security headers
 * - Rate limiting
 * - Request ID tracing
 * - Structured logging
 * - Compression
 * - Standardized error handling
 * - Deep health checks
 * - Graceful shutdown
 *
 * ============================================================================
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import compression from "compression";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./config/database.js";
import validateStartupConfig from "./config/startupValidation.js";
import { logDocumentPrecheckStartupStatus } from "./services/reservationDocumentPrecheckService.js";
import requestId from "./middleware/requestId.js";
import { requestLogger } from "./middleware/logger.js";
import logger from "./middleware/logger.js";
import {
  globalLimiter,
  authLimiter,
  publicLimiter,
} from "./middleware/rateLimiter.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/usersRoutes.js";
import roomRoutes from "./routes/roomsRoutes.js";
import reservationRoutes from "./routes/reservationsRoutes.js";
import inquiryRoutes from "./routes/inquiriesRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import announcementRoutes from "./routes/announcementRoutes.js";
import maintenanceRoutes from "./routes/maintenanceContractRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import attachmentRoutes from "./routes/attachmentRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import digitalTwinRoutes from "./routes/digitalTwinRoutes.js";
import utilityBillingRoutes from "./routes/utilityBillingRoutes.js";
import financialRoutes from "./routes/financialRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import branchSummaryRoutes from "./routes/branchSummaryRoutes.js";
import backupRoutes from "./routes/backupRoutes.js";
import { initSocket } from "./utils/socket.js";
import mobileRoutes from "./mobile/mobileRoutes.mjs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let server = null;
let stopBackgroundJobs = () => {};

const resolveTrustProxy = () => {
  const configured = String(process.env.TRUST_PROXY || "").trim().toLowerCase();
  if (!configured) {
    return process.env.NODE_ENV === "production" ? 1 : false;
  }

  if (configured === "true") return true;
  if (configured === "false") return false;

  const asNumber = Number(configured);
  return Number.isNaN(asNumber) ? configured : asNumber;
};

app.set("trust proxy", resolveTrustProxy());
app.use(requestId);

const normalizeOrigin = (origin = "") => String(origin || "").trim().replace(/\/+$/, "");

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const wildcardToRegex = (pattern = "") =>
  new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, ".*")}$`, "i");

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "https://www.lilycrest.space",
  "https://lilycrest.space",
];

const allowedOriginRules = [
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin)),
  ...(process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin)),
  ...DEFAULT_ALLOWED_ORIGINS,
]
  .filter(Boolean)
  .filter((origin, index, origins) => origins.indexOf(origin) === index);

const allowedOriginMatchers = allowedOriginRules.map((rule) =>
  rule.includes("*") ? wildcardToRegex(rule) : rule,
);

const isOriginAllowed = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  return allowedOriginMatchers.some((matcher) => {
    if (matcher instanceof RegExp) {
      return matcher.test(normalizedOrigin);
    }
    return matcher === normalizedOrigin;
  });
};

const isTruthyEnv = (value, fallback = false) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }

  return !["0", "false", "no", "off"].includes(
    String(value).trim().toLowerCase(),
  );
};

const shouldStartScheduler = () => isTruthyEnv(process.env.ENABLE_SCHEDULER, true);

const setUploadStaticHeaders = (res) => {
  // Uploaded files are intentionally consumed by the frontend on a separate
  // origin/subdomain, so override Helmet's default same-origin resource policy
  // only for this public static file surface.
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  if (!res.getHeader("Access-Control-Allow-Origin")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
};

const uploadStaticHeaders = (_req, res, next) => {
  setUploadStaticHeaders(res);
  next();
};

const runPermissionBackfill = async () => {
  try {
    const { backfillBranchAdminPermissions } = await import(
      "./utils/backfillAdminPermissions.js"
    );
    const updatedCount = await backfillBranchAdminPermissions();

    if (updatedCount > 0) {
      logger.info(
        { count: updatedCount },
        "Startup permission backfill completed",
      );
    }
  } catch (error) {
    logger.error({ err: error }, "Startup permission backfill failed");
  }
};

const runSchedulerStartup = async () => {
  if (!shouldStartScheduler()) {
    logger.info("Scheduler startup skipped because ENABLE_SCHEDULER is disabled");
    return;
  }

  try {
    const { startScheduler, stopScheduler } = await import("./utils/scheduler.js");
    stopBackgroundJobs = stopScheduler;
    startScheduler({
      runWarmup: isTruthyEnv(process.env.RUN_SCHEDULER_WARMUP, false),
    });
    logger.info("Scheduler started");
  } catch (error) {
    logger.error({ err: error }, "Scheduler startup failed");
  }
};

const runBackupSchedulerStartup = async () => {
  try {
    const { checkAndRunAutoBackup } = await import("./controllers/backupController.js");
    const cron = await import("node-cron");
    // Check every hour if an auto-backup is due
    cron.default.schedule("0 * * * *", () => {
      checkAndRunAutoBackup().catch((err) =>
        logger.error({ err }, "Auto-backup scheduler tick failed"),
      );
    });
    logger.info("Backup scheduler started (hourly check)");
  } catch (error) {
    logger.error({ err: error }, "Backup scheduler startup failed");
  }
};

const startBackgroundServices = (mongoConnected) => {
  if (!mongoConnected) {
    logger.warn(
      "Skipping background startup tasks because MongoDB is unavailable",
    );
    return;
  }

  setImmediate(() => {
    void Promise.allSettled([runPermissionBackfill(), runSchedulerStartup(), runBackupSchedulerStartup()]);
  });
};

app.options("*", (req, res) => {
  const { origin } = req.headers;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization,X-Request-Id,X-Device-Id,X-Session-Id",
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.sendStatus(204);
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    exposedHeaders: ["X-Request-Id"],
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use("/api/paymongo", webhookRoutes);  // payment.paid, payment.failed, source.chargeable
app.use("/api/webhooks", webhookRoutes);  // checkout_session.payment.paid
app.use(globalLimiter);
app.use(compression());
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));
app.use(
  "/uploads",
  uploadStaticHeaders,
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1d",
    fallthrough: true,
    setHeaders: setUploadStaticHeaders,
  }),
);
app.use(requestLogger);

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/inquiries", publicLimiter, inquiryRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/m/maintenance", maintenanceRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/attachments", attachmentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/digital-twin", digitalTwinRoutes);
app.use("/api/utilities", utilityBillingRoutes);
app.use("/api/financial", financialRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/branches", branchSummaryRoutes);
app.use("/api/backups", backupRoutes);

// ─── Mobile App Routes (LilyCrest-Clean backend bridge) ─────────────────────
app.use("/api/m", mobileRoutes);

app.get("/api/health", async (req, res) => {
  const checks = {};
  let healthy = true;

  try {
    const state = mongoose.connection.readyState;
    if (state === 1) {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      checks.mongodb = { status: "ok", latency: `${Date.now() - start}ms` };
    } else {
      checks.mongodb = { status: "degraded", state };
      healthy = false;
    }
  } catch (err) {
    checks.mongodb = { status: "error", error: err.message };
    healthy = false;
  }

  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  checks.memory = {
    status: heapUsedMB < 512 ? "ok" : "warning",
    heapUsed: `${heapUsedMB}MB`,
    heapTotal: `${heapTotalMB}MB`,
  };

  checks.uptime = `${Math.round(process.uptime())}s`;

  res.status(healthy ? 200 : 503).json({
    success: true,
    data: {
      status: healthy ? "healthy" : "degraded",
      checks,
      environment: process.env.NODE_ENV || "development",
    },
    meta: {
      requestId: req.id,
      timestamp: new Date().toISOString(),
    },
  });
});

app.use(globalErrorHandler);

const gracefulShutdown = (signal) => {
  logger.info({ signal }, "Shutting down gracefully");

  const finalizeShutdown = () => {
    stopBackgroundJobs();
    mongoose.connection.close(false).then(() => {
      logger.info("MongoDB connection closed");
      process.exit(0);
    });
  };

  if (!server) {
    finalizeShutdown();
    return;
  }

  server.close(() => {
    logger.info("HTTP server closed");
    finalizeShutdown();
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught Exception");
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled Rejection");
  gracefulShutdown("unhandledRejection");
});

const bootstrap = async () => {
  validateStartupConfig();
  logDocumentPrecheckStartupStatus();

  const mongoConnected = await connectDB();

  server = app.listen(PORT, () => {
    logger.info(
      {
        port: PORT,
        env: process.env.NODE_ENV || "development",
        node: process.version,
      },
      "LILYCREST DORMITORY MANAGEMENT SYSTEM started",
    );
    logger.info(`API available at http://localhost:${PORT}/api`);
    logger.info(`Health check: http://localhost:${PORT}/api/health`);

    initSocket(server, {
      allowedOrigins: allowedOriginRules,
      isOriginAllowed,
    });
    startBackgroundServices(mongoConnected);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      logger.fatal({ port: PORT }, "Port already in use");
      process.exit(1);
    }

    logger.fatal({ err: error }, "Server error");
    process.exit(1);
  });
};

bootstrap().catch((error) => {
  logger.fatal({ err: error }, "Server bootstrap failed");
  process.exit(1);
});
