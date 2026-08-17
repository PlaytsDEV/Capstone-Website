/**
 * issueClusterService.js
 * Issue Clustering Service
 */

import { generateChatCompletion } from './aiProviderService.js';
import { sanitizeObject as sanitizePii } from './piiSanitizer.js';

/**
 * Analyzes maintenance tickets and chat inquiries to detect repeated complaints
 * on the same floor/room cluster.
 */
export const detectIssueClusters = async ({ branch, timeframeHours = 24 }) => {
  try {
    // MOCK DATA for demonstration purposes:
    const mockTickets = [
      { id: 'T1', room: '101', floor: '1', category: 'Plumbing', issue: 'Leaking faucet', timestamp: new Date() },
      { id: 'T2', room: '102', floor: '1', category: 'Plumbing', issue: 'Low water pressure', timestamp: new Date() },
      { id: 'T3', room: '105', floor: '1', category: 'Plumbing', issue: 'No water', timestamp: new Date() },
      { id: 'T4', room: '201', floor: '2', category: 'Electrical', issue: 'Flickering lights', timestamp: new Date() }
    ];
    
    const sanitizedTickets = sanitizePii(mockTickets);
    
    const systemPrompt = `You are an AI analyzing dormitory maintenance tickets to find clusters of issues.
A cluster is when multiple issues of similar types occur in close physical proximity (same floor, adjacent rooms) within a short timeframe.

Context:
- Branch: ${branch || 'All Branches'}
- Timeframe: Last ${timeframeHours} hours

Recent Tickets Data:
${JSON.stringify(sanitizedTickets, null, 2)}

Instructions:
1. Identify any patterns or clusters (e.g., "Multiple plumbing issues on Floor 1").
2. Output ONLY a valid JSON object with the following structure:
{
  "clustersDetected": [
    {
      "clusterType": "string (e.g., Plumbing)",
      "location": "string (e.g., Floor 1)",
      "ticketIds": ["T1", "T2"],
      "severity": "Low|Medium|High",
      "description": "Short explanation of the cluster"
    }
  ],
  "summary": "Overall summary of findings"
}`;

    const responseText = await generateChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Analyze the provided tickets for clusters.' }
      ],
      responseFormat: 'json'
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
        summary: "Could not parse cluster data."
      };
    }
    
    return {
      success: true,
      data: parsedResponse
    };
  } catch (error) {
    console.error('Error in detectIssueClusters:', error);
    return {
      success: false,
      error: 'Failed to detect issue clusters'
    };
  }
};
