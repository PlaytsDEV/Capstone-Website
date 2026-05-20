import express from "express";
import multer from "multer";

import { uploadAttachment } from "../controllers/attachmentController.js";
import { verifyToken } from "../middleware/auth.js";
import {
  ATTACHMENT_TYPE_ERROR_MESSAGE,
  isAllowedAttachmentFile,
} from "../services/attachmentUploadService.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedAttachmentFile(file)) {
      cb(null, true);
      return;
    }

    const error = new Error(ATTACHMENT_TYPE_ERROR_MESSAGE);
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
