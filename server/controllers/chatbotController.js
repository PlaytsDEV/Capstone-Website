import { queryGeminiChatbot } from "../services/chatbot/chatbotService.js";
import Inquiry from "../models/Inquiry.js";
import { z } from "zod";

const querySchema = z.object({
  message: z.string().min(1, "Message is required").max(1000).trim(),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      text: z.string().min(1).max(2000)
    })
  ).max(50, "Conversation history is too long").default([])
});

const escalationSchema = z.object({
  name: z.string().min(1, "Name is required").max(150).trim(),
  email: z.string().email("Invalid email format").min(1, "Email is required").trim().toLowerCase(),
  phone: z.string().min(1, "Phone number is required").max(20).trim(),
  preferredBranch: z.enum(["gil_puyat", "guadalupe"]).nullable().optional(),
  message: z.string().min(1, "Message is required").max(5000).trim(),
  preferredRoomType: z.enum(["quadruple_sharing", "double_sharing", "private_room"]).nullable().optional()
});

export const handlePublicQuery = async (req, res, next) => {
  try {
    const { message, conversationHistory } = querySchema.parse(req.body);
    const data = await queryGeminiChatbot(message, conversationHistory);
    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues ? error.issues[0].message : "Validation Error" });
    }
    next(error);
  }
};

export const handleLeadEscalation = async (req, res, next) => {
  try {
    const validatedData = escalationSchema.parse(req.body);
    
    const newInquiry = new Inquiry({
      fullName: validatedData.name,
      email: validatedData.email,
      contactNumber: validatedData.phone,
      preferredBranch: validatedData.preferredBranch || null,
      message: validatedData.message,
      preferredRoomType: validatedData.preferredRoomType || null,
      source: "website",
      sourceNote: "chatbot_public",
      viewingStatus: "new",
      priority: "medium"
    });

    await newInquiry.save();

    res.status(200).json({
      success: true,
      data: {
        inquiryId: newInquiry._id,
        message: "Your inquiry has been sent to our admin team. We will contact you within 24 hours."
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.issues ? error.issues[0].message : "Validation Error" });
    }
    next(error);
  }
};
