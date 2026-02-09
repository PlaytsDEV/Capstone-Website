/**
 * =============================================================================
 * DATABASE CONFIGURATION
 * =============================================================================
 *
 * MongoDB database connection configuration with automatic retry logic.
 *
 * Features:
 * - Connects to MongoDB using Mongoose ODM
 * - Automatic reconnection on failure (retries every 10 seconds)
 * - Configurable timeout settings for reliability
 * - Graceful error handling
 *
 * Environment Variables Required:
 * - MONGODB_URI: MongoDB connection string (from .env file)
 *
 * Connection Options:
 * - serverSelectionTimeoutMS: How long to try selecting a server
 * - socketTimeoutMS: How long a socket can be inactive before timeout
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Connect to MongoDB Database
 *
 * This function establishes a connection to the MongoDB database.
 * If the connection fails, it will automatically retry after 10 seconds.
 * This ensures the server can start even if MongoDB is temporarily unavailable.
 *
 * @async
 * @function connectDB
 * @returns {Promise<void>} Resolves when connected, retries on failure
 */
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error(
        "❌ MongoDB connection error: MONGODB_URI is not set in environment variables",
      );
      console.log(
        "⚠️ Server will continue without MongoDB. Set MONGODB_URI in .env to enable database features.",
      );
      return;
    }

    // Attempt to connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // Wait up to 10 seconds to select a server
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    console.log("✅ MongoDB connected successfully");
    console.log(`📊 Database: ${mongoose.connection.name}`);
  } catch (error) {
    // Log connection error details
    console.error("❌ MongoDB connection error:", error.message);
    console.log(
      "⚠️ Server will continue without MongoDB. Retrying in 10 seconds...",
    );

    // Retry connection after 10 seconds
    // This allows the server to handle temporary database outages
    setTimeout(() => {
      try {
        connectDB();
      } catch (retryError) {
        console.error(
          "❌ Failed to schedule database reconnection:",
          retryError,
        );
      }
    }, 10000);
  }
};

/**
 * Handle MongoDB connection events
 * These event listeners help monitor the database connection status
 */
try {
  // Log when connection is established
  mongoose.connection.on("connected", () => {
    console.log("📡 Mongoose connected to MongoDB");
  });

  // Log when connection is disconnected
  mongoose.connection.on("disconnected", () => {
    console.log("⚠️ Mongoose disconnected from MongoDB");
  });

  // Log any errors after initial connection
  mongoose.connection.on("error", (err) => {
    console.error("❌ Mongoose connection error:", err);
  });
} catch (error) {
  console.error("❌ Failed to set up MongoDB event listeners:", error);
}

export default connectDB;
