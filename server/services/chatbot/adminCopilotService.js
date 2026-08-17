/**
 * adminCopilotService.js
 * Admin Copilot & SOP Service
 */

import { generateChatCompletion } from './aiProviderService.js';
import { getRelevantAdminSOPs, formatSOPContext } from './adminKnowledgeBase.js';
import { sanitizeText } from './piiSanitizer.js';

/**
 * Matches the query against the SOP knowledge base and uses AI to produce
 * concise, structured step-by-step guidance with policy citations.
 */
export const queryAdminSopService = async ({ query, branch }) => {
  try {
    const sanitizedQuery = sanitizeText(query);
    
    // Retrieve relevant SOPs
    const relevantSOPs = getRelevantAdminSOPs(sanitizedQuery);
    const sopContext = formatSOPContext(relevantSOPs);
    
    const systemPrompt = `You are the Lilycrest DMS Admin Operational Copilot.
You assist dormitory administrators by providing concise, structured, step-by-step guidance based ONLY on the provided Standard Operating Procedures (SOPs).
Branch Context: ${branch || 'General'}
SOP Context:
${sopContext}

Instructions:
1. Answer the query directly using bullet points or numbered steps.
2. Cite the specific SOP section (e.g., "According to §7.2...") when applicable.
3. If the query cannot be answered using the provided SOPs, state clearly that the SOP does not cover this scenario.
4. Keep the tone professional, objective, and directive.`;

    const response = await generateChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: sanitizedQuery }
      ]
    });
    
    return {
      success: true,
      data: {
        guidance: response,
        citations: relevantSOPs.map(sop => sop.section)
      }
    };
  } catch (error) {
    console.error('Error in queryAdminSopService:', error);
    return {
      success: false,
      error: 'Failed to query Admin SOP Service'
    };
  }
};
