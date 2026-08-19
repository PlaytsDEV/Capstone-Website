/**
 * CommonJS bridge to the canonical ESM Lily domain guard. The mobile route
 * keeps its transport module format while scope policy remains single-owned.
 */
async function classifyLilyRequest(...args) {
  const guard = await import('../../services/chatbot/tenantDomainGuard.js');
  return guard.classifyLilyRequest(...args);
}

async function lilyDomainReply() {
  const guard = await import('../../services/chatbot/tenantDomainGuard.js');
  return guard.lilyDomainReply();
}

module.exports = { classifyLilyRequest, lilyDomainReply };
