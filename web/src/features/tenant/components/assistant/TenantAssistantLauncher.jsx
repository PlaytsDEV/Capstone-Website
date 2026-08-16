import React from "react";
import { Sparkles, MessageSquare, Bot } from "lucide-react";

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
      title="Lilycrest AI Assistant (Resident Copilot)"
    >
      <div className="relative flex items-center justify-center">
        <Bot className="w-5 h-5" aria-hidden="true" />
        <span className="tenant-assistant-launcher-badge absolute -top-1 -right-1" />
      </div>
      <span className="hidden sm:inline-block">AI Assistant</span>
      <Sparkles className="w-3.5 h-3.5 text-amber-400 opacity-90 hidden sm:inline-block" aria-hidden="true" />
    </button>
  );
}
