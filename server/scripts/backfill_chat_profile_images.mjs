import dotenv from "dotenv";
import { assertStagingWriteTarget } from "./stagingWriteGuard.js";
assertStagingWriteTarget(process.env, { toolName: "backfill_chat_profile_images.mjs" });

dotenv.config({ path: "./.env" });
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import { User, ChatConversation, ChatMessage, Reservation } from "../models/index.js";

async function runBackfill() {
  await connectDB();
  console.log("Starting Chat Profile Image Backfill...");

  const conversations = await ChatConversation.find({}).lean();
  console.log(`Found ${conversations.length} total chat conversations to process.`);

  let convUpdatedCount = 0;
  let msgUpdatedCount = 0;

  for (const conv of conversations) {
    let resolvedPhoto = "";

    // 1. Check if User exists by tenantId
    if (conv.tenantId && mongoose.Types.ObjectId.isValid(conv.tenantId)) {
      const user = await User.findById(conv.tenantId).select("profileImage email").lean();
      if (user?.profileImage && user.profileImage.trim()) {
        resolvedPhoto = user.profileImage.trim();
      }
    }

    // 2. Check if User exists by email
    if (!resolvedPhoto && conv.tenantEmail) {
      const userByEmail = await User.findOne({ email: conv.tenantEmail.toLowerCase().trim() })
        .select("profileImage email")
        .lean();
      if (userByEmail?.profileImage && userByEmail.profileImage.trim()) {
        resolvedPhoto = userByEmail.profileImage.trim();
      }
    }

    // 3. Fallback to Reservation selfiePhotoUrl
    if (!resolvedPhoto) {
      const resConditions = [];
      if (conv.tenantId && mongoose.Types.ObjectId.isValid(conv.tenantId)) {
        resConditions.push({ userId: conv.tenantId });
      }
      if (conv.tenantEmail) {
        resConditions.push({ email: conv.tenantEmail.toLowerCase().trim() });
      }

      if (resConditions.length > 0) {
        const resDoc = await Reservation.findOne({
          $or: resConditions,
          $and: [
            {
              $or: [
                { selfiePhotoUrl: { $exists: true, $ne: null, $ne: "" } },
                { "documentPrechecks.selfiePhoto.fileUrl": { $exists: true, $ne: null, $ne: "" } },
              ],
            },
          ],
        })
          .sort({ createdAt: -1 })
          .select("selfiePhotoUrl documentPrechecks.selfiePhoto.fileUrl")
          .lean();

        const photo = resDoc?.selfiePhotoUrl || resDoc?.documentPrechecks?.selfiePhoto?.fileUrl;
        if (photo && photo.trim()) {
          resolvedPhoto = photo.trim();
        }
      }
    }

    // 4. Fallback to matching Reservation by firstName for legacy/orphaned records
    if (!resolvedPhoto && conv.tenantName) {
      const firstWord = conv.tenantName.trim().split(/\s+/)[0];
      if (firstWord && firstWord.length >= 2) {
        const resByName = await Reservation.findOne({
          firstName: new RegExp(`^${firstWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
          selfiePhotoUrl: { $exists: true, $ne: null, $ne: "" },
        })
          .sort({ createdAt: -1 })
          .select("selfiePhotoUrl")
          .lean();

        if (resByName?.selfiePhotoUrl && resByName.selfiePhotoUrl.trim()) {
          resolvedPhoto = resByName.selfiePhotoUrl.trim();
        }
      }
    }

    if (resolvedPhoto) {
      await ChatConversation.updateOne(
        { _id: conv._id },
        { $set: { tenantProfileImage: resolvedPhoto } }
      );
      convUpdatedCount += 1;
      console.log(`[Conversation Updated] ${conv.tenantName} (${conv.tenantEmail}): ${resolvedPhoto.slice(0, 50)}...`);

      // Also update any tenant messages that had empty senderProfileImage
      const resMsg = await ChatMessage.updateMany(
        {
          conversationId: conv._id,
          senderRole: "tenant",
          $or: [
            { senderProfileImage: { $exists: false } },
            { senderProfileImage: "" },
            { senderProfileImage: null },
          ],
        },
        { $set: { senderProfileImage: resolvedPhoto } }
      );
      msgUpdatedCount += resMsg.modifiedCount;
    } else {
      console.log(`[No Photo Available] ${conv.tenantName} (${conv.tenantEmail})`);
    }
  }

  console.log(`\nBackfill complete! Updated ${convUpdatedCount} conversations and ${msgUpdatedCount} messages.`);
  process.exit(0);
}

runBackfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
