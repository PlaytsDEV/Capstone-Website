import { sendSuccess } from "../middleware/errorHandler.js";
import { uploadAttachmentFile } from "../services/attachmentUploadService.js";

export const uploadAttachment = async (req, res, next) => {
  try {
    const attachment = await uploadAttachmentFile({
      req,
      file: req.file,
    });

    sendSuccess(res, { attachment }, 201);
  } catch (error) {
    next(error);
  }
};

export default {
  uploadAttachment,
};
