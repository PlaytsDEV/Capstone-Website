/**
 * ============================================================================
 * SEO HEAD — Per-page meta tag management
 * ============================================================================
 *
 * Lightweight component that sets document title and meta tags per page.
 * No external dependency needed — uses the DOM API directly.
 *
 * Usage:
 * <SEOHead title="Dashboard" description="View your tenant dashboard" />
 *
 * ============================================================================
 */

import { useEffect } from "react";

const DEFAULT_TITLE = "Lilycrest Dormitory";
const DEFAULT_DESCRIPTION =
 "Affordable, safe, and comfortable dormitory living for students and professionals.";

/**
 * @param {Object} props
 * @param {string} props.title - Page title (will be appended with " | Lilycrest")
 * @param {string} [props.description] - Meta description for the page
 * @param {Object|Array} [props.structuredData] - Schema.org JSON-LD object for AI search & Agentic Browsing
 */
export default function SEOHead({ title, description, structuredData }) {
  useEffect(() => {
    // Set document title
    document.title = title ? `${title} | ${DEFAULT_TITLE}` : DEFAULT_TITLE;

    // Set or create meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", description || DEFAULT_DESCRIPTION);

    // Inject Schema.org JSON-LD structured data for Agentic Browsing & AI Search
    let scriptEl = null;
    if (structuredData) {
      scriptEl = document.createElement("script");
      scriptEl.setAttribute("type", "application/ld+json");
      scriptEl.textContent = JSON.stringify(structuredData);
      document.head.appendChild(scriptEl);
    }

    // Cleanup: reset title and remove structured data script on unmount
    return () => {
      document.title = DEFAULT_TITLE;
      if (scriptEl && scriptEl.parentNode) {
        scriptEl.parentNode.removeChild(scriptEl);
      }
    };
  }, [title, description, structuredData]);

  return null;
}
