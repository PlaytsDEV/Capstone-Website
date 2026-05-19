import express from "express";
import multer from "multer";

import { uploadAttachment } from "../controllers/attachmentController.js";
import { verifyToken } from "../middleware/auth.js";
import { ALLOWED_ATTACHMENT_MIME_TYPES } from "../services/attachmentUploadService.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    const error = new Error("This file type is not supported. Please upload a photo or PDF.");
    error.statusCode = 400;
    error.code = "UNSUPPORTED_FILE_TYPE";
    cb(error);
  },
});

router.post(
  "/",
  verifyToken,
  upload.single("file"),
  uploadAttachment,
);

router.post(
  "/upload",
  verifyToken,
  upload.single("file"),
  uploadAttachment,
);

export default router;
