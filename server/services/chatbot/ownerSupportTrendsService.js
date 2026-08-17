/**
 * ownerSupportTrendsService.js
 * Owner Cross-Branch Intelligence Service
 */

import { generateChatCompletion } from './aiProviderService.js';

/**
 * Aggregates Gil Puyat vs Guadalupe metrics and generates an AI executive summary memo.
 */
export const getOwnerSupportTrends = async ({ timeframe = '30d', branch = 'All' }) => {
  try {
    // MOCK DATA for demonstration. In reality, fetch from MongoDB aggregations.
    const mockMetrics = {
      timeframe,
      branches: {
        'Gil Puyat': {
          ticketVolume: 145,
          avgSlaResolutionHours: 4.2,
          categoryDistribution: {
            Plumbing: 40,
            Electrical: 30,
            Admin: 20,
            Other: 10
          }
        },
        'Guadalupe': {
          ticketVolume: 89,
          avgSlaResolutionHours: 2.8,
          categoryDistribution: {
            Plumbing: 20,
            Electrical: 40,
            Admin: 20,
            Other: 20
          }
        }
      }
    };
    
    // If a specific branch is requested, filter the mock data
    if (branch !== 'All' && mockMetrics.branches[branch]) {
      const singleBranch = {};
      singleBranch[branch] = mockMetrics.branches[branch];
      mockMetrics.branches = singleBranch;
    }

    const systemPrompt = `You are an AI Executive Analyst for Lilycrest Dormitory Management System.
Generate a concise, professional executive summary memo for the Dorm Owner comparing support trends across branches.

Context:
- Timeframe: Last ${timeframe}
- Requested Branch Filter: ${branch}

Metrics Data:
${JSON.stringify(mockMetrics, null, 2)}

Instructions:
1. Provide a high-level summary of the ticket volumes and SLA resolution times.
2. Highlight key differences between Gil Puyat and Guadalupe (if applicable).
3. Identify the most critical categories requiring attention.
4. Output ONLY a valid JSON object with the following structure:
{
  "executiveSummary": "A 2-3 paragraph summary memo.",
  "keyInsights": [
    "Insight 1",
    "Insight 2"
  ],
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2"
  ],
  "rawMetrics": <insert the provided Metrics Data here>
}`;

    const responseText = await generateChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the owner support trends executive summary.' }
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
        executiveSummary: "Summary could not be generated.",
        keyInsights: [],
        recommendations: [],
        rawMetrics: mockMetrics
      };
    }
    
    return {
      success: true,
      data: parsedResponse
    };
  } catch (error) {
    console.error('Error in getOwnerSupportTrends:', error);
    return {
      success: false,
      error: 'Failed to generate owner support trends'
    };
  }
};
