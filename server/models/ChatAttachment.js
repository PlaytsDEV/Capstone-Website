import mongoose from "mongoose";

const chatAttachmentSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
      index: true,
    },
    branch: { type: String, required: true, index: true },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    uploaderRole: {
      type: String,
      enum: ["tenant", "admin", "owner"],
      required: true,
    },
    originalName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0, max: 5 * 1024 * 1024 },
    provider: { type: String, required: true, trim: true },
    storagePath: { type: String, required: true, trim: true },
    storageUrl: { type: String, required: true, select: false },
  },
  { timestamps: true, collection: "chat_attachments" },
);

chatAttachmentSchema.index({ conversationId: 1, createdAt: 1 });

export default mongoose.model("ChatAttachment", chatAttachmentSchema);
