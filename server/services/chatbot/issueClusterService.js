/**
 * issueClusterService.js
 * Issue Clustering Service
 */

import { generateChatCompletion } from './aiProviderService.js';
import { sanitizeObject as sanitizePii } from './piiSanitizer.js';
import MaintenanceRequest from '../../models/MaintenanceRequest.js';
import ChatConversation from '../../models/ChatConversation.js';

/**
 * Analyzes live maintenance tickets and chat inquiries to detect repeated complaints
 * on the same floor/room cluster.
 */
export const detectIssueClusters = async ({ branch, timeframeHours = 48 }) => {
  try {
    const cutoff = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);
    const filter = { createdAt: { $gte: cutoff } };
    if (branch && branch.toLowerCase() !== 'all') {
      const normalizedBranch = branch.toLowerCase().replace(/[\s_]+/g, '-');
      filter.branch = normalizedBranch;
    }

    const [maintenanceDocs, chatDocs] = await Promise.all([
      MaintenanceRequest.find(filter)
        .select('_id title description issueType category roomNumber floor branch urgency priority status createdAt')
        .limit(50)
        .lean(),
      ChatConversation.find({
        ...filter,
        status: { $in: ['open', 'in_review', 'waiting_tenant'] },
      })
        .select('_id roomNumber branch category priority lastMessage createdAt')
        .limit(50)
        .lean(),
    ]);

    const tickets = [
      ...maintenanceDocs.map((m) => ({
        id: String(m._id),
        source: 'Maintenance',
        room: m.roomNumber || 'Unknown',
        floor: m.floor ? String(m.floor) : m.roomNumber ? `Floor ${String(m.roomNumber)[0] || '1'}` : 'Unknown',
        category: m.issueType || m.category || 'General Maintenance',
        issue: m.title || m.description || 'Maintenance Issue',
        urgency: m.urgency || m.priority || 'normal',
        timestamp: m.createdAt,
      })),
      ...chatDocs.map((c) => ({
        id: String(c._id),
        source: 'Support Chat',
        room: c.roomNumber || 'Unknown',
        floor: c.roomNumber ? `Floor ${String(c.roomNumber)[0] || '1'}` : 'Unknown',
        category: (c.category || 'general_inquiry').replace(/_/g, ' '),
        issue: c.lastMessage || 'Tenant inquiry',
        urgency: c.priority || 'normal',
        timestamp: c.createdAt,
      })),
    ];

    if (tickets.length === 0) {
      return {
        success: true,
        data: {
          clustersDetected: [],
          summary: 'No active issue clusters detected in the selected timeframe.',
        },
      };
    }

    const sanitizedTickets = sanitizePii(tickets);

    const systemPrompt = `You are an AI analyzing dormitory maintenance tickets and support chats to find physical clusters of issues.
A cluster is when multiple issues of similar types occur in close physical proximity (same floor, adjacent rooms, or same utility system) within a short timeframe.

Context:
- Branch: ${branch || 'All Branches'}
- Timeframe: Last ${timeframeHours} hours

Recent Tickets Data:
${JSON.stringify(sanitizedTickets, null, 2)}

Instructions:
1. Identify any patterns or clusters (e.g., "Multiple plumbing issues on Floor 1", "Wi-Fi connectivity drop across Floor 2").
2. Output ONLY a valid JSON object with the following structure:
{
  "clustersDetected": [
    {
      "clusterType": "string (e.g., Plumbing, Electrical, Wi-Fi)",
      "location": "string (e.g., Floor 1, Pasay Wing)",
      "ticketIds": ["ticket_id_1", "ticket_id_2"],
      "severity": "Low|Medium|High|Urgent",
      "description": "Short explanation of the cluster"
    }
  ],
  "summary": "Overall summary of findings"
}`;

    const responseText = await generateChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Analyze the provided tickets for clusters.' },
      ],
      responseFormat: 'json',
    });

    let parsedResponse;
    try {
      const start = responseText.indexOf('{');
      const end = responseText.lastIndexOf('}') + 1;
      const jsonStr = responseText.slice(start, end);
      parsedResponse = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', responseText);
      parsedResponse = {
        clustersDetected: [],
        summary: 'Could not parse cluster data from AI analysis.',
      };
    }

    return {
      success: true,
      data: parsedResponse,
    };
  } catch (error) {
    console.error('Error in detectIssueClusters:', error);
    return {
      success: false,
      error: 'Failed to detect issue clusters',
    };
  }
};
