import mongoose from "mongoose";

/**
 * User Model
 * 
 * Stores user profile and account information.
 * 
 * IMPORTANT: Firebase Authentication is the source of truth for:
 * - Authentication (password hashing, session management)
 * - Email verification status (emailVerified field)
 * 
 * This model stores:
 * - User profile data (name, phone, etc.)
 * - Branch assignment for multi-location system
 * - Role for access control
 * - Mirror of email verification status (synced from Firebase)
 */

const userSchema = new mongoose.Schema(
  {
    // Firebase UID - unique identifier linking to Firebase Auth
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    
    // User credentials
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      index: true,
    },
    
    // Personal information
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    
    phone: {
      type: String,
      trim: true,
    },
    
    // Branch assignment - users can only see data for their assigned branch
    branch: {
      type: String,
      required: true,
      enum: ["gil-puyat", "guadalupe"],
      index: true,
    },
    
    // Role-based access control
    role: {
      type: String,
      enum: ["tenant", "admin", "superAdmin"],
      default: "tenant",
    },
    
    // Profile image URL (optional)
    profileImage: {
      type: String,
    },
    
    // Account status - can be disabled by admin
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // Email verification status (synced from Firebase)
    // Firebase is the source of truth - this mirrors Firebase's emailVerified
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  },
);

const User = mongoose.model("User", userSchema);

export default User;
