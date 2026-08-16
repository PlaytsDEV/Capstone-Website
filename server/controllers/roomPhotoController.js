/**
 * =============================================================================
 * ROOM PHOTO UPLOAD CONTROLLER
 * =============================================================================
 *
 * Handles server-side uploads of room photos to Firebase Storage.
 *
 * Storage path: room-photos/{roomId}/{timestamp}-{safeFilename}
 *
 * Why server-side?
 *   Client-side Firebase Storage rules only allow access to specific paths
 *   (applicant-documents/, maintenance-attachments/). Room photos require a
 *   separate path (room-photos/) that can only be written via the Admin SDK,
 *   which bypasses Security Rules entirely.
 *
 * Endpoints:
 *   POST /api/rooms/:roomId/photos  — upload one or more photos (multipart)
 */

import sharp from "sharp";
import multer from "multer";
import path from "path";
import { getFirebaseStorage } from "../config/firebase.js";
import { AppError } from "../middleware/errorHandler.js";

// ── Constants ──────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per image
const MAX_FILES = 10;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif",
]);

// ── Multer — memory storage (no temp files on disk) ───────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ALLOWED_MIME_TYPES.has(mime) || ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          "Only image files are allowed (JPEG, PNG, WebP, HEIC).",
          400,
          "INVALID_FILE_TYPE",
        ),
      );
    }
  },
});

/** Multer middleware — accepts up to MAX_FILES images under field name "photos" */
export const uploadPhotosMiddleware = upload.array("photos", MAX_FILES);

// ── Helper ─────────────────────────────────────────────────────────────────
function sanitizeFilename(original) {
  return (original || "photo").replace(/[^a-zA-Z0-9._-]/g, "_");
}

// ── Controller ─────────────────────────────────────────────────────────────

/**
 * POST /api/rooms/:roomId/photos
 *
 * Receives multipart/form-data with field "photos" (one or many files),
 * uploads each to Firebase Storage under room-photos/{roomId}/,
 * and returns the array of public download URLs.
 */
export const uploadRoomPhotos = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    if (!roomId || typeof roomId !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(roomId)) {
      throw new AppError("Invalid room ID format.", 400, "INVALID_ROOM_ID");
    }

    const files = req.files || [];
    if (files.length === 0) {
      throw new AppError(
        "No photo files were received. Send images under the \"photos\" field.",
        400,
        "NO_FILES",
      );
    }

    const bucket = getFirebaseStorage();

    const uploadResults = await Promise.all(
      files.map(async (file) => {
        const timestamp = Date.now();
        const rawFilename = sanitizeFilename(path.parse(file.originalname || "photo").name);
        const fullStoragePath = `room-photos/${roomId}/${timestamp}-${rawFilename}.webp`;
        const thumbStoragePath = `room-photos/${roomId}/${timestamp}-${rawFilename}-thumb.webp`;

        let fullBuffer = file.buffer;
        let thumbBuffer = null;
        let contentType = "image/webp";

        try {
          // Generate full resolution WebP (1200x900 inside fit, 82% quality)
          fullBuffer = await sharp(file.buffer)
            .resize({ width: 1200, height: 900, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();

          // Generate lightweight thumbnail WebP (480x360 inside fit, 75% quality)
          thumbBuffer = await sharp(file.buffer)
            .resize({ width: 480, height: 360, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 75 })
            .toBuffer();
        } catch (sharpError) {
          // Fallback to original buffer if Sharp processing fails
          fullBuffer = file.buffer;
          thumbBuffer = null;
          contentType = file.mimetype || "image/jpeg";
        }

        const fullFileRef = bucket.file(fullStoragePath);
        await fullFileRef.save(fullBuffer, {
          metadata: {
            contentType,
            cacheControl: "public, max-age=31536000, immutable",
            metadata: { roomId, variant: "full" },
          },
        });
        await fullFileRef.makePublic();
        const fullUrl = `https://storage.googleapis.com/${bucket.name}/${fullStoragePath}`;

        let thumbUrl = fullUrl;
        if (thumbBuffer) {
          const thumbFileRef = bucket.file(thumbStoragePath);
          await thumbFileRef.save(thumbBuffer, {
            metadata: {
              contentType: "image/webp",
              cacheControl: "public, max-age=31536000, immutable",
              metadata: { roomId, variant: "thumbnail" },
            },
          });
          await thumbFileRef.makePublic();
          thumbUrl = `https://storage.googleapis.com/${bucket.name}/${thumbStoragePath}`;
        }

        return {
          url: fullUrl,
          thumbnailUrl: thumbUrl,
        };
      }),
    );

    const uploadedUrls = uploadResults.map((item) => item.url);

    res.status(200).json({
      success: true,
      data: {
        urls: uploadedUrls,
        items: uploadResults,
      },
    });
  } catch (err) {
    next(err);
  }
};
