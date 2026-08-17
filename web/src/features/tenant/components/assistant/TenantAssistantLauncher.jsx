import React from "react";

/**
 * Floating launcher button fixed at bottom-right of the tenant portal.
 * Opens the slide-over Tenant AI Assistant drawer.
 *
 * Adheres strictly to Lilycrest solid HSL tokens, 1px borders, and accessibility.
 */
export default function TenantAssistantLauncher({ onClick, isOpen = false }) {
  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="tenant-assistant-launcher"
      aria-label="Open Lilycrest AI Assistant"
      title="Lilycrest Tenant Assistant"
    >
      <div className="relative flex items-center justify-center font-bold text-xs">
        <span>AI</span>
        <span className="tenant-assistant-launcher-badge absolute -top-1 -right-1" />
      </div>
      <span className="hidden sm:inline-block font-semibold">Assistant</span>
    </button>
  );
}
