import { generateChatCompletion } from './aiProviderService.js';
import { getRelevantAdminSOPs, formatSOPContext } from './adminKnowledgeBase.js';
import { sanitizeText } from './piiSanitizer.js';
import { findTenantOrRoomInfo } from './adminTenantLookupService.js';
import { generateDailyShiftBriefing } from './adminDailyBriefingService.js';

// Keywords indicating intent to look up a tenant or room
const TENANT_INTENT_REGEX = /\b(who is|search|lookup|look up|info for|find|tell me about|check tenant|tenant|balance|room|unit|rm|bed|occupant|resident)\b/i;

// Keywords indicating intent for daily morning standup / shift briefing
const BRIEFING_INTENT_REGEX = /(?:briefing|standup|morning standup|daily overview|daily summary|what'?s?\s*happening\s*today|today'?s?\s*schedule|today'?s?\s*shift\s*briefing|today'?s?\s*briefing|shift\s*briefing)/i;

/**
 * Handles Admin Assistant queries:
 * 1. Checks if the query is a Daily Briefing request.
 * 2. Checks if the query is a Tenant or Room lookup.
 * 3. Otherwise, matches against the SOP knowledge base and uses AI for guidance.
 */
export const queryAdminSopService = async ({ query, branch, userRole }) => {
  try {
    const sanitizedQuery = sanitizeText(query);

    // 1. Try Daily Shift Briefing Intent
    if (BRIEFING_INTENT_REGEX.test(sanitizedQuery)) {
      const briefingResult = await generateDailyShiftBriefing({ branch, userRole });
      if (briefingResult?.success && briefingResult?.data) {
        return {
          success: true,
          data: {
            isDailyBriefing: true,
            briefing: briefingResult.data,
            title: briefingResult.data.title,
            answer: briefingResult.data.summary,
            policyReference: "Lilycrest Shift Operations Log",
          }
        };
      }
    }

    const hasTenantIntent = TENANT_INTENT_REGEX.test(sanitizedQuery) || /^\d+[a-zA-Z]?$/.test(sanitizedQuery.trim());


    // 1. Try Tenant / Room Lookup if intent matches
    if (hasTenantIntent) {
      const lookupResult = await findTenantOrRoomInfo({
        query: sanitizedQuery,
        branch,
        userRole,
      });

      if (lookupResult?.found) {
        if (lookupResult.isSingle) {
          return {
            success: true,
            data: {
              isTenantLookup: true,
              tenant: lookupResult.tenant,
              title: `Tenant Profile: ${lookupResult.tenant.fullName}`,
              answer: lookupResult.message || `Operational profile for ${lookupResult.tenant.fullName}.`,
              policyReference: `Lilycrest Operations Directory (${lookupResult.tenant.branch})`,
            }
          };
        }

        if (lookupResult.isMultiple) {
          return {
            success: true,
            data: {
              isTenantLookup: true,
              isMultiple: true,
              count: lookupResult.count,
              candidates: lookupResult.candidates,
              title: `Tenant Search: ${lookupResult.candidates.length} Matches Found`,
              answer: lookupResult.message,
              policyReference: "Lilycrest Operations Directory",
            }
          };
        }

        if (lookupResult.isRoomSearch) {
          return {
            success: true,
            data: {
              isTenantLookup: true,
              isRoomSearch: true,
              roomDetails: lookupResult.roomDetails,
              occupants: lookupResult.occupants || [],
              title: `Room ${lookupResult.roomNumber} (${lookupResult.roomDetails?.branch || branch})`,
              answer: lookupResult.message,
              policyReference: "Lilycrest Room Inventory",
            }
          };
        }
      } else if (lookupResult?.isRoomSearch || /^(who is in|search for|find tenant|show info for)\b/i.test(sanitizedQuery)) {
        // Explicit search with no match -> return clean not-found response
        return {
          success: true,
          data: {
            isTenantLookup: true,
            notFound: true,
            title: "No Results Found",
            answer: lookupResult?.message || `No tenant or room found matching "${sanitizedQuery}".`,
            policyReference: "Lilycrest Operations Directory",
          }
        };
      }
    }

    // 2. Standard SOP Policy Knowledge Base Query
    const relevantSOPs = getRelevantAdminSOPs(sanitizedQuery);
    const sopContext = formatSOPContext(relevantSOPs);

    const systemPrompt = `You are the Lilycrest DMS Admin Operations Assistant.
You assist dormitory administrators by providing concise, structured, step-by-step guidance based ONLY on the provided Standard Operating Procedures (SOPs).
Branch Context: ${branch || 'General'}
SOP Context:
${sopContext}

Instructions:
1. Answer the query directly using bullet points or numbered steps.
2. Cite the specific SOP section (e.g., "According to §7.2...") when applicable.
3. If the query cannot be answered using the provided SOPs, state clearly that the SOP does not cover this scenario.
4. Keep the tone professional, objective, and directive. Always use formal English and term "Tenant".
5. Strictly do NOT use icons, emojis, or graphical symbols in your guidance or answers. Format with clean, plain text and standard lists only.`;

    const response = await generateChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: sanitizedQuery }
      ]
    });

    const checklist = response
      ? response
          .split('\n')
          .filter(line => /^\s*(\d+\.|\*|-)\s+/.test(line))
          .map(line => line.replace(/^\s*(\d+\.|\*|-)\s+/, '').trim())
      : [];

    return {
      success: true,
      data: {
        title: `SOP Guidance: "${sanitizedQuery}"`,
        answer: response,
        guidance: response,
        checklist: checklist.length > 0 ? checklist : (response ? response.split('\n').filter(Boolean) : []),
        policyReference: relevantSOPs[0]?.section ? `Lilycrest Operations Manual ${relevantSOPs[0].section}` : 'Lilycrest Operations Manual §General',
        citations: relevantSOPs.map(sop => sop.section)
      }
    };
  } catch (error) {
    console.error('Error in queryAdminSopService:', error);
    return {
      success: false,
      error: 'Failed to query Admin Operations Assistant Service'
    };
  }
};

