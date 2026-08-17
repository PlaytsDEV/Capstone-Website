/**
 * adminReplyDrafterService.js
 * Admin Contextual Reply Drafter
 */

import { generateChatCompletion } from './aiProviderService.js';
import { sanitizeObject } from './piiSanitizer.js';

/**
 * Generates an AI-suggested reply for an admin responding to a tenant.
 */
export const generateAdminReplyDraft = async ({ conversationId, ticketCategory, urgency, recentMessages, tenantContext, tone = 'professional', branch }) => {
  try {
    const sanitizedMessages = sanitizeObject(recentMessages);
    const sanitizedContext = sanitizeObject(tenantContext);
    
    const systemPrompt = `You are an AI assistant helping a dormitory admin write a reply to a tenant.
Your goal is to draft a polite, professional, and helpful response.

Context:
- Branch: ${branch || 'General'}
- Ticket Category: ${ticketCategory || 'General Inquiry'}
- Urgency: ${urgency || 'Normal'}
- Requested Tone: ${tone}
- Tenant Context: ${JSON.stringify(sanitizedContext || {})}

Recent Conversation History:
${JSON.stringify(sanitizedMessages, null, 2)}

Instructions:
1. Provide a direct, empathetic, and clear response draft.
2. Output ONLY a valid JSON object with the following structure:
{
  "suggestedReply": "The text of the suggested reply to the tenant.",
  "confidence": 0.95,
  "recommendedActions": [
    { "label": "Action Name", "action": "ACTION_CODE" }
  ]
}
3. Do not include markdown formatting or extra text outside the JSON.
4. Strictly do NOT use icons, emojis, or graphical symbols in the suggested reply.`;

    const responseText = await generateChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Please draft the reply based on the context.' }
      ],
      responseFormat: 'json'
    });
    
    // Parse the JSON response
    let parsedResponse;
    try {
      const start = responseText.indexOf('{');
      const end = responseText.lastIndexOf('}') + 1;
      const jsonStr = responseText.slice(start, end);
      parsedResponse = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', responseText);
      // Fallback
      parsedResponse = {
        suggestedReply: responseText,
        confidence: 0.5,
        recommendedActions: []
      };
    }
    
    return {
      success: true,
      data: parsedResponse
    };
  } catch (error) {
    console.error('Error in generateAdminReplyDraft:', error);
    return {
      success: false,
      error: 'Failed to generate reply draft'
    };
  }
};
