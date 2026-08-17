/**
 * CommonJS bridge to the canonical ESM tenant context resolver. The vendored
 * mobile chatbot remains CommonJS, but business-state selection lives only in
 * server/services/chatbot/tenantContextResolver.js.
 */
async function resolveTenantAIContext(...args) {
  const resolver = await import('../../services/chatbot/tenantContextResolver.js');
  return resolver.resolveTenantAIContext(...args);
}

module.exports = { resolveTenantAIContext };
