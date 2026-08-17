import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Send,
  Copy,
  CheckCircle2,
  FileText,
  BookOpen,
  LoaderCircle,
  Sparkles,
  RotateCcw,
  User,
  Bot,
  ChevronRight,
} from "lucide-react";
import AdminSopReferenceModal from "./AdminSopReferenceModal";
import { chatbotApi } from "../../../../shared/api/chatbotApi";
import { useAuth } from "../../../../shared/hooks/useAuth";

const SUGGESTED_PROMPTS = [
  "Move-out clearance checklist",
  "Lost room key policy",
  "Utility late penalty rules",
  "Guest curfew & visitor policy",
  "Urgent maintenance SLAs",
];

const DEFAULT_SOPS = {
  "Move-out clearance checklist": {
    title: "Move-Out & Deposit Clearance Protocol",
    steps: [
      "Verify that all monthly rent and utility invoices are settled with zero outstanding balance.",
      "Conduct physical room and fixture inspection using the Room Clearance Checklist.",
      "Collect all physical keys, access cards, and dormitory credentials.",
      "Calculate security deposit deductions (if any damage is noted) and initiate refund voucher."
    ],
    policyLink: "Lilycrest Operations Manual §3.1 (Move-Out Governance)"
  },
  "Lost room key policy": {
    title: "Key & Lock Governance Protocol",
    steps: [
      "Verify tenant identity via government ID or system profile photo.",
      "Issue temporary master key for immediate room access and log into Front Desk Key Log.",
      "Assess standard ₱250.00 key replacement fee on the tenant's next billing cycle.",
      "Front desk duplicates the replacement key within 24 hours and updates key inventory."
    ],
    policyLink: "Lilycrest Operations Manual §7.2 (Key & Lock Governance)"
  },
  "Utility late penalty rules": {
    title: "Utility Billing Disputes & Grace Periods",
    steps: [
      "Tenants receive a standard 5-day grace period from the billing generation date.",
      "A 5% late penalty applies on the 6th day past the due date if unaddressed.",
      "If a meter reading is disputed, maintenance must conduct a physical meter re-check within 24 hours.",
      "Billing adjustments are applied as credit adjustments on the subsequent billing statement."
    ],
    policyLink: "Lilycrest Operations Manual §5.4 (Utility Billing Governance)"
  },
  "Guest curfew & visitor policy": {
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

const INITIAL_MESSAGE = {
  id: "init-1",
  sender: "assistant",
  text: "Hello! I am your Lilycrest Operations Copilot. How can I assist you with dormitory procedures, tenant policies, or operational checklists today?",
  timestamp: new Date(),
};

export default function AdminCopilotDrawer({ isOpen, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSop, setActiveSop] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend) => {
    const queryText = (textToSend || inputMessage).trim();
    if (!queryText || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: queryText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setLoading(true);

    // Instant match check from local cache
    const matchedKey = Object.keys(DEFAULT_SOPS).find(
      (k) =>
        k.toLowerCase() === queryText.toLowerCase() ||
        queryText.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(queryText.toLowerCase())
    );

    try {
      const response = await chatbotApi.queryAdminSop({
        query: queryText,
        branch: user?.branch,
      });

      if (response?.success && response?.data) {
        const data = response.data;
        const steps =
          Array.isArray(data.checklist) && data.checklist.length > 0
            ? data.checklist
            : data.answer
            ? data.answer.split("\n").filter((l) => l.trim().length > 0)
            : [];

        const botMsg = {
          id: `bot-${Date.now()}`,
          sender: "assistant",
          title: data.title || `SOP Guidance: "${queryText}"`,
          steps: steps,
          text: data.answer || null,
          policyLink: data.policyReference || "Lilycrest Operations Manual",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else if (matchedKey) {
        const fallbackSop = DEFAULT_SOPS[matchedKey];
        const botMsg = {
          id: `bot-${Date.now()}`,
          sender: "assistant",
          title: fallbackSop.title,
          steps: fallbackSop.steps,
          policyLink: fallbackSop.policyLink,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error(response?.message || "No specific SOP found");
      }
    } catch (err) {
      console.warn("Copilot query fallback triggered:", err?.message);
      if (matchedKey) {
        const fallbackSop = DEFAULT_SOPS[matchedKey];
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: "assistant",
            title: fallbackSop.title,
            steps: fallbackSop.steps,
            policyLink: fallbackSop.policyLink,
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: "assistant",
            title: `Operations Guidance: "${queryText}"`,
            steps: [
              "Review the standard Lilycrest Dormitory Operations Manual on file.",
              "Verify tenant identity, room assignment, and current contract status.",
              "If the concern involves physical damage or security, log an incident report and notify the branch manager immediately."
            ],
            policyLink: "Lilycrest Operations Manual §General Protocols",
            timestamp: new Date(),
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (msgId, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    setMessages([INITIAL_MESSAGE]);
  };

  const content = (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[var(--card)] h-full shadow-2xl flex flex-col border-l border-[var(--border)] animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <header className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[var(--primary)] border border-blue-200 dark:border-blue-800">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Admin Operations Copilot</h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full">
                  AI SOP Advisor
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Instant policy checklists & SOP answers</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleResetChat}
              title="Reset conversation"
              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Message Thread (Scrollable Body) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/15">
          {messages.map((msg) => {
            const isUser = msg.sender === "user";

            if (isUser) {
              return (
                <div key={msg.id} className="flex justify-end items-start gap-2.5">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-[var(--primary)] text-white p-3 text-xs leading-relaxed shadow-xs">
                    {msg.text}
                  </div>
                  <div className="h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0">
                    <User size={14} />
                  </div>
                </div>
              );
            }

            // Assistant Message
            const copyableText = msg.steps
              ? `${msg.title ? `${msg.title}\n\n` : ""}${msg.steps
                  .map((step, idx) => `${idx + 1}. ${step}`)
                  .join("\n")}${msg.policyLink ? `\n\nReference: ${msg.policyLink}` : ""}`
              : msg.text || "";

            return (
              <div key={msg.id} className="flex items-start gap-2.5">
                <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-[var(--primary)] shrink-0 mt-0.5 border border-blue-200 dark:border-blue-800">
                  <Bot size={15} />
                </div>
                <div className="max-w-[90%] space-y-2">
                  <div className="rounded-2xl rounded-tl-xs bg-[var(--card)] border border-[var(--border)] p-3.5 text-xs text-foreground leading-relaxed shadow-xs space-y-2.5">
                    {msg.title && (
                      <h4 className="font-bold text-xs text-foreground pb-1.5 border-b border-[var(--border)] flex items-center gap-1.5">
                        <BookOpen size={14} className="text-[var(--primary)]" />
                        {msg.title}
                      </h4>
                    )}

                    {msg.steps && msg.steps.length > 0 ? (
                      <div className="space-y-2">
                        {msg.steps.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
                            <span className="font-bold text-[var(--primary)] shrink-0">{idx + 1}.</span>
                            <span className="text-foreground">{step}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}

                    {/* Footer Actions (Policy Link & Copy) */}
                    {(msg.policyLink || msg.steps) && (
                      <div className="pt-2.5 border-t border-[var(--border)] flex items-center justify-between text-[11px] gap-2">
                        {msg.policyLink ? (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSop({
                                title: msg.title || "Policy Reference",
                                steps: msg.steps || [],
                                policyLink: msg.policyLink,
                              })
                            }
                            className="inline-flex items-center gap-1 text-[var(--primary)] font-semibold hover:underline cursor-pointer truncate max-w-[70%]"
                          >
                            <FileText size={12} className="shrink-0" />
                            <span className="truncate">{msg.policyLink}</span>
                          </button>
                        ) : (
                          <span />
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, copyableText)}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0 font-medium"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              <span className="text-emerald-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy Steps</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-[var(--primary)] shrink-0 border border-blue-200 dark:border-blue-800">
                <Bot size={15} />
              </div>
              <div className="rounded-2xl rounded-tl-xs bg-[var(--card)] border border-[var(--border)] p-3 text-xs text-muted-foreground flex items-center gap-2 shadow-xs">
                <LoaderCircle size={14} className="animate-spin text-[var(--primary)]" />
                <span>Consulting Operations Manual...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Topic Chips (Above Composer) */}
        <div className="px-3.5 py-2 border-t border-[var(--border)] bg-[var(--card)] flex items-center gap-1.5 overflow-x-auto shrink-0">
          <span className="text-[10px] font-semibold text-muted-foreground shrink-0 uppercase tracking-wider mr-1">
            Quick SOPs:
          </span>
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              disabled={loading}
              className="px-2.5 py-1 text-[11px] font-medium bg-[var(--bg)] border border-[var(--border)] rounded-full hover:border-[var(--primary)] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Bottom Message Composer */}
        <footer className="p-3 border-t border-[var(--border)] bg-[var(--card)] shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask an operational question (e.g. lost key procedure, move-out clearance)..."
                disabled={loading}
                className="w-full pl-3.5 pr-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--primary)] disabled:opacity-50 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="h-9 px-3.5 rounded-xl bg-[var(--primary)] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              {loading ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <>
                  <span>Send</span>
                  <Send size={13} />
                </>
              )}
            </button>
          </form>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground px-1">
            <span>Press Enter to send</span>
            <span>Lilycrest Ground Operations Advisor</span>
          </div>
        </footer>
      </div>

      {activeSop && (
        <AdminSopReferenceModal sop={activeSop} onClose={() => setActiveSop(null)} />
      )}
    </div>
  );

  return createPortal(content, document.body);
}


