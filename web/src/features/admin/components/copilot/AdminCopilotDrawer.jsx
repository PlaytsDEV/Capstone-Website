import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Search, Copy, CheckCircle2, FileText, BookOpen, LoaderCircle, AlertCircle } from "lucide-react";
import AdminSopReferenceModal from "./AdminSopReferenceModal";
import { chatbotApi } from "../../../../shared/api/chatbotApi";
import { useAuth } from "../../../../shared/hooks/useAuth";

const TOPICS = [
  "Move-out clearance",
  "Utility penalty policy",
  "Lost room key",
  "Guest curfew & visitors",
  "Urgent maintenance SLAs"
];

const DEFAULT_SOPS = {
  "Move-out clearance": {
    title: "Move-Out & Deposit Clearance Protocol",
    steps: [
      "Verify that all monthly rent and utility invoices are settled with zero outstanding balance.",
      "Conduct physical room and fixture inspection using the Room Clearance Checklist.",
      "Collect all physical keys, access cards, and dormitory credentials.",
      "Calculate security deposit deductions (if any damage is noted) and initiate refund voucher."
    ],
    policyLink: "Lilycrest Operations Manual §3.1 (Move-Out Governance)"
  },
  "Lost room key": {
    title: "Key & Lock Governance Protocol",
    steps: [
      "Verify tenant identity via government ID or system profile photo.",
      "Issue temporary master key for immediate room access and log into Front Desk Key Log.",
      "Assess standard ₱250.00 key replacement fee on the tenant's next billing cycle.",
      "Front desk duplicates the replacement key within 24 hours and updates key inventory."
    ],
    policyLink: "Lilycrest Operations Manual §7.2 (Key & Lock Governance)"
  },
  "Utility penalty policy": {
    title: "Utility Billing Disputes & Grace Periods",
    steps: [
      "Tenants receive a standard 5-day grace period from the billing generation date.",
      "A 5% late penalty applies on the 6th day past the due date if unaddressed.",
      "If a meter reading is disputed, maintenance must conduct a physical meter re-check within 24 hours.",
      "Billing adjustments are applied as credit adjustments on the subsequent billing statement."
    ],
    policyLink: "Lilycrest Operations Manual §5.4 (Utility Billing Governance)"
  },
  "Guest curfew & visitors": {
    title: "Visitor & Overnight Guest Protocol",
    steps: [
      "All visiting guests must sign in at the front desk with a valid government or student ID.",
      "Standard visiting hours conclude promptly at 10:00 PM daily.",
      "Overnight guests must be pre-registered 24 hours in advance with a ₱300.00/night guest surcharge.",
      "Unregistered overnight guests incur a formal house rule violation notice (§8.1)."
    ],
    policyLink: "Lilycrest Operations Manual §8.1 (Visitor Governance)"
  },
  "Urgent maintenance SLAs": {
    title: "Urgent Maintenance Escalation SLAs",
    steps: [
      "Emergency repairs (major water leak, electrical hazard) require front desk triage within 15 minutes.",
      "On-call certified technician dispatched within 60 minutes for high-severity tickets.",
      "Tenant must be provided regular status updates via admin chat thread every 2 hours until resolution.",
      "Post-repair sign-off signed by tenant and maintenance lead before closing the ticket."
    ],
    policyLink: "Lilycrest Operations Manual §4.2 (Facility Maintenance SLAs)"
  }
};

export default function AdminCopilotDrawer({ isOpen, onClose }) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSop, setActiveSop] = useState(null);
  const [copied, setCopied] = useState(false);
  const [currentSop, setCurrentSop] = useState(DEFAULT_SOPS["Move-out clearance"]);
  const [customAnswer, setCustomAnswer] = useState(null);

  if (!isOpen) return null;

  const handleQuery = async (queryText) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    // Check predefined defaults first for instant rendering
    if (DEFAULT_SOPS[trimmed]) {
      setCurrentSop(DEFAULT_SOPS[trimmed]);
      setCustomAnswer(null);
      return;
    }

    setLoading(true);
    setCustomAnswer(null);

    try {
      const response = await chatbotApi.queryAdminSop({
        query: trimmed,
        branch: user?.branch,
      });

      if (response?.success && response?.data) {
        const data = response.data;
        setCurrentSop({
          title: `SOP Guidance: "${trimmed}"`,
          steps: Array.isArray(data.checklist) && data.checklist.length > 0
            ? data.checklist
            : (data.answer ? data.answer.split("\n").filter(Boolean) : ["Procedure retrieved successfully."]),
          policyLink: data.policyReference || "Lilycrest Operations Manual"
        });
        setCustomAnswer(data.answer || null);
      } else {
        throw new Error(response?.message || "No specific SOP found");
      }
    } catch (err) {
      console.warn("Falling back to standard SOP manual lookup:", err?.message);
      // Fallback to closest match or default
      const matchedKey = Object.keys(DEFAULT_SOPS).find(k => 
        trimmed.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(trimmed.toLowerCase())
      );
      if (matchedKey) {
        setCurrentSop(DEFAULT_SOPS[matchedKey]);
      } else {
        setCurrentSop({
          title: `Operations Query: ${trimmed}`,
          steps: [
            "Consult the Lilycrest Standard Operating Procedures Manual on file.",
            "Verify tenant credentials and branch assignment.",
            "Contact building supervisor if immediate resolution is required."
          ],
          policyLink: "Lilycrest Operations Manual §General"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTopicClick = (topic) => {
    setSearch(topic);
    handleQuery(topic);
  };

  const handleCopy = () => {
    const textToCopy = currentSop.steps.map((step, idx) => `${idx + 1}. ${step}`).join("\n");
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const content = (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/50" onClick={onClose}>
      <div 
        className="w-full max-w-md bg-[var(--card)] h-full shadow-xl flex flex-col border-l border-[var(--border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center gap-2 text-[var(--text-main)] font-semibold">
            <BookOpen size={20} className="text-[var(--primary)]" />
            Admin Operations Copilot
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-[var(--border)] bg-[var(--card)]">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleQuery(search);
            }} 
            className="relative"
          >
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Ask Copilot or search SOPs..."
              className="w-full pl-9 pr-10 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-md text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--primary)]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {loading && (
              <LoaderCircle size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--primary)]" />
            )}
          </form>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {TOPICS.map((topic) => (
              <button 
                key={topic}
                type="button"
                onClick={() => handleTopicClick(topic)}
                className="px-2.5 py-1 text-[11px] bg-[var(--bg)] border border-[var(--border)] rounded-full hover:border-[var(--primary)] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4">
            <h4 className="font-semibold text-xs text-foreground mb-3">{currentSop.title}</h4>
            
            <div className="space-y-2">
              {currentSop.steps.map((step, idx) => (
                <div key={idx} className="flex gap-2 text-xs text-foreground leading-relaxed">
                  <span className="text-[var(--primary)] font-bold">{idx + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>

            {customAnswer && (
              <div className="mt-3 p-2.5 bg-[var(--card)] border border-[var(--border)] rounded text-[11px] text-muted-foreground whitespace-pre-wrap">
                {customAnswer}
              </div>
            )}
            
            <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
              <button 
                type="button"
                onClick={() => setActiveSop(currentSop)}
                className="text-[11px] flex items-center gap-1 text-[var(--primary)] font-medium hover:underline cursor-pointer"
              >
                <FileText size={13} />
                {currentSop.policyLink}
              </button>
              
              <button 
                type="button"
                onClick={handleCopy}
                className="text-[11px] flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {copied ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy Steps"}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {activeSop && (
        <AdminSopReferenceModal 
          sop={activeSop} 
          onClose={() => setActiveSop(null)} 
        />
      )}
    </div>
  );

  return createPortal(content, document.body);
}

