import React from "react";
import { Bot } from "lucide-react";
import { motion } from "framer-motion";
import "../../styles/tenant-assistant.css";

/**
 * Floating launcher button fixed at bottom-right of the tenant portal.
 * Opens the slide-over Tenant AI Assistant drawer.
 *
 * Compact circular button with robot icon and live status badge.
 * Uses hardware-accelerated Framer Motion for buttery-smooth 60fps floating
 * with zero layout repaints and optimal battery/CPU efficiency.
 */
export default function TenantAssistantLauncher({ onClick, isOpen = false }) {
  if (isOpen) return null;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="tenant-assistant-launcher"
      animate={{
        y: [0, -12, 0],
      }}
      transition={{
        duration: 2.4,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      whileTap={{
        scale: 0.96,
      }}
      aria-label="Open Lilycrest AI Assistant"
      title="Lilycrest Tenant Assistant"
    >
      <div className="relative flex items-center justify-center">
        <Bot className="w-5 h-5 tenant-assistant-launcher-bot-icon" aria-hidden="true" />
        <span className="tenant-assistant-launcher-badge absolute -top-1 -right-1" />
      </div>
    </motion.button>
  );
}
