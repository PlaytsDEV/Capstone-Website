/**
 * ownerSupportTrendsService.js
 * Owner Cross-Branch Intelligence Service
 */

import { generateChatCompletion } from './aiProviderService.js';
import ChatConversation from '../../models/ChatConversation.js';

const TIMEFRAME_DAYS = {
  '7d': 7,
  '30d': 30,
  '60d': 60,
  '90d': 90,
  '365d': 365,
  'all': null,
};

/**
 * Aggregates Gil Puyat vs Guadalupe metrics from live MongoDB data and generates an AI executive summary memo.
 */
export const getOwnerSupportTrends = async ({ timeframe = '30d', branch = 'All' }) => {
  try {
    const days = TIMEFRAME_DAYS[timeframe] || 30;
    const matchFilter = {};
    if (days) {
      matchFilter.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }
    if (branch && branch.toLowerCase() !== 'all') {
      const normalizedBranch = branch.toLowerCase().replace(/[\s_]+/g, '-');
      matchFilter.branch = normalizedBranch;
    }

    const conversations = await ChatConversation.find(matchFilter).lean();

    const branchesData = {
      'Gil Puyat': { ticketVolume: 0, avgSlaResolutionHours: 0, categoryDistribution: {} },
      'Guadalupe': { ticketVolume: 0, avgSlaResolutionHours: 0, categoryDistribution: {} },
    };

    const resolutionDurations = { 'Gil Puyat': [], 'Guadalupe': [] };

    for (const c of conversations) {
      const branchKey = c.branch === 'gil-puyat' ? 'Gil Puyat' : c.branch === 'guadalupe' ? 'Guadalupe' : 'Other';
      if (!branchesData[branchKey]) {
        branchesData[branchKey] = { ticketVolume: 0, avgSlaResolutionHours: 0, categoryDistribution: {} };
        resolutionDurations[branchKey] = [];
      }
      branchesData[branchKey].ticketVolume += 1;

      const rawCat = c.category || 'general_inquiry';
      const formattedCat = rawCat
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
      branchesData[branchKey].categoryDistribution[formattedCat] =
        (branchesData[branchKey].categoryDistribution[formattedCat] || 0) + 1;

      if (c.resolutionDurationMinutes) {
        resolutionDurations[branchKey].push(c.resolutionDurationMinutes / 60);
      } else if (c.resolvedAt || c.closedAt) {
        const end = new Date(c.resolvedAt || c.closedAt).getTime();
        const start = new Date(c.createdAt).getTime();
        const hours = Math.max(0, (end - start) / (1000 * 60 * 60));
        resolutionDurations[branchKey].push(hours);
      }
    }

    for (const key of Object.keys(branchesData)) {
      const list = resolutionDurations[key] || [];
      branchesData[key].avgSlaResolutionHours = list.length > 0
        ? Number((list.reduce((sum, val) => sum + val, 0) / list.length).toFixed(1))
        : 0;
    }

    const metricsData = {
      timeframe,
      branches: branchesData,
    };

    if (branch && branch.toLowerCase() !== 'all') {
      const targetKey = branch.toLowerCase().includes('puyat') ? 'Gil Puyat' : 'Guadalupe';
      if (metricsData.branches[targetKey]) {
        metricsData.branches = { [targetKey]: metricsData.branches[targetKey] };
      }
    }

    const systemPrompt = `You are an AI Executive Analyst for Lilycrest Dormitory Management System (Lilycrest DMS).
Generate a concise, professional executive summary memo for the Dorm Owner comparing support trends across branches.

Context:
- Timeframe: Last ${timeframe}
- Requested Branch Filter: ${branch}

Metrics Data:
${JSON.stringify(metricsData, null, 2)}

Instructions:
1. Provide a high-level summary of the ticket volumes and average resolution times.
2. Highlight key differences between Gil Puyat and Guadalupe (if applicable).
3. Identify the most critical categories requiring administrative attention.
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
        { role: 'user', content: 'Generate the owner support trends executive summary.' },
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
        executiveSummary: 'Summary could not be generated.',
        keyInsights: [],
        recommendations: [],
        rawMetrics: metricsData,
      };
    }

    return {
      success: true,
      data: parsedResponse,
    };
  } catch (error) {
    console.error('Error in getOwnerSupportTrends:', error);
    return {
      success: false,
      error: 'Failed to generate owner support trends',
    };
  }
};
