import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  X,
  Send,
  RotateCcw,
  Sparkles,
  Bot,
  UserCheck,
  LoaderCircle,
  Headphones,
  ArrowRight,
  Receipt,
  FileText,
  Wrench,
  HelpCircle,
  Building2,
  AlertCircle,
  Zap,
  ShieldCheck,
  PlusCircle,
} from "lucide-react";
import { useAuth } from "../../../../shared/hooks/useAuth";
import { streamTenantAssistant } from "../../api/tenantAssistantApi";
import TenantBillingBreakdownCard from "./cards/TenantBillingBreakdownCard";
import TenantLeaseTimelineCard from "./cards/TenantLeaseTimelineCard";
import TenantMaintenanceCard from "./cards/TenantMaintenanceCard";
import TenantHumanEscalateModal from "./modals/TenantHumanEscalateModal";
import "../../styles/tenant-assistant.css";

const STORAGE_KEY = "lilycrest_tenant_assistant_msgs";

const CATEGORIZED_PROMPTS = {
  billing: [
    { icon: Zap, label: "Electricity math", prompt: "How was my submetered electricity share computed this month?" },
    { icon: Receipt, label: "Payment due date", prompt: "When is my current bill due and how do I settle it?" },
    { icon: ShieldCheck, label: "Water consumption", prompt: "Is water really free and included in my monthly rent?" },
  ],
  contracts: [
    { icon: FileText, label: "Lease expiration", prompt: "When does my current lease contract expire and how many days are left?" },
    { icon: PlusCircle, label: "Renew contract", prompt: "What are the steps to request a lease renewal?" },
    { icon: ShieldCheck, label: "Deposit refund", prompt: "How does the security deposit refund and move-out clearance work?" },
  ],
  maintenance: [
    { icon: Wrench, label: "Active tickets", prompt: "What is the current status of my room repair requests?" },
    { icon: PlusCircle, label: "Report issue", prompt: "How do I submit an urgent plumbing or air-conditioning issue?" },
    { icon: HelpCircle, label: "Technician hours", prompt: "What are the available hours for on-site technician repairs?" },
  ],
  default: [
    { icon: Wrench, label: "Active tickets", prompt: "Do I have any active maintenance tickets scheduled?" },
    { icon: PlusCircle, label: "Report issue", prompt: "How do I submit an urgent plumbing or air-conditioning issue?" },
    { icon: Receipt, label: "Bill breakdown", prompt: "Can you show my current monthly bill breakdown?" },
    { icon: Zap, label: "Electricity math", prompt: "How was my submetered electricity share computed this month?" },
    { icon: FileText, label: "Lease timeline", prompt: "How many days are left on my lease agreement?" },
    { icon: ShieldCheck, label: "Deposit refund", prompt: "How does the security deposit refund and move-out clearance work?" },
  ],
};

function formatBranch(raw) {
  if (!raw) return "Lilycrest";
  const str = String(raw).toLowerCase();
  if (str.includes("gil") || str.includes("puyat") || str.includes("pasay")) return "Gil Puyat";
  if (str.includes("guadalupe") || str.includes("makati")) return "Guadalupe";
  return raw.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TenantAssistantDrawer({ isOpen, onClose }) {
  const { user } = useAuth();
  const location = useLocation();

  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return [];
  });

  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activeWidget, setActiveWidget] = useState(null);
  const [activeActions, setActiveActions] = useState([]);
  const [isEscalateOpen, setIsEscalateOpen] = useState(false);
  const [contextSnapshot, setContextSnapshot] = useState(null);

  const bodyRef = useRef(null);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isScrolledUpRef = useRef(false);

  // Determine active route prompts
  const activeRoutePrompts = useMemo(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes("billing")) return CATEGORIZED_PROMPTS.billing;
    if (path.includes("contract")) return CATEGORIZED_PROMPTS.contracts;
    if (path.includes("maintenance")) return CATEGORIZED_PROMPTS.maintenance;
    return CATEGORIZED_PROMPTS.default;
  }, [location.pathname]);

  // Persist messages to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Ignore storage errors
    }
  }, [messages]);

  // ESC key handler to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !isEscalateOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isEscalateOpen, onClose]);

  // Auto-scroll logic with scroll-lock detection
  const scrollToBottom = (behavior = "smooth") => {
    if (bodyRef.current && !isScrolledUpRef.current) {
      bodyRef.current.scrollTo({
        top: bodyRef.current.scrollHeight,
        behavior,
      });
    }
  };

  useEffect(() => {
    scrollToBottom("auto");
  }, [messages, streamingText, activeWidget]);

  const handleScroll = () => {
    if (!bodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = bodyRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    isScrolledUpRef.current = !atBottom;
  };

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
        scrollToBottom("auto");
      }, 150);
    }
  }, [isOpen]);

  // Welcome message if conversation is empty
  const tenantDisplayName =
    `${user?.firstName || ""}`.trim() ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    user?.username ||
    "Tenant";

  const branchLabel = formatBranch(user?.branch || contextSnapshot?.branch);
  const roomLabel = user?.roomNumber || contextSnapshot?.roomNumber || "304";
  const bedLabel = user?.roomBed || contextSnapshot?.bedPosition || "Bed 1";

  const handleClearHistory = () => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    setMessages([]);
    setStreamingText("");
    setActiveWidget(null);
    setActiveActions([]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const handleSendMessage = async (textToSend) => {
    const queryText = (textToSend || inputMessage).trim();
    if (!queryText || isStreaming) return;

    setInputMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const userTurn = {
      role: "user",
      content: queryText,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userTurn];
    setMessages(newHistory);
    setIsStreaming(true);
    setStreamingText("");
    setActiveWidget(null);
    setActiveActions([]);
    isScrolledUpRef.current = false;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let accumulatedText = "";
    let streamWidget = null;
    let streamActions = null;

    try {
      await streamTenantAssistant({
        message: queryText,
        conversationHistory: newHistory.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          content: m.content,
        })),
        signal: abortController.signal,
        onToken: (token, accumulated) => {
          accumulatedText = accumulated;
          setStreamingText(accumulated);
        },
        onWidget: (widget) => {
          streamWidget = widget;
          setActiveWidget(widget);
        },
        onActions: (actions) => {
          streamActions = actions;
          setActiveActions(actions);
        },
        onDone: (result) => {
          if (result?.contextSnapshot) {
            setContextSnapshot(result.contextSnapshot);
          }
        },
        onError: (err) => {
          console.error("Tenant assistant streaming error:", err);
        },
      });

      const assistantTurn = {
        role: "assistant",
        content: accumulatedText || "I'm here to help with your stay at Lilycrest. Feel free to ask another question!",
        widget: streamWidget,
        actions: streamActions,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantTurn]);
      setStreamingText("");
    } catch (err) {
      if (err.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            isError: true,
            content: "I encountered a temporary connection issue. Please retry your question or speak directly with the Branch Admin.",
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTextareaChange = (e) => {
    setInputMessage(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleActionClick = (act) => {
    if (typeof act === "string") {
      if (act.toLowerCase().includes("admin") || act.toLowerCase().includes("escalate")) {
        setIsEscalateOpen(true);
      } else {
        handleSendMessage(act);
      }
      return;
    }

    if (act.action === "open_escalate_modal") {
      setIsEscalateOpen(true);
    } else if (act.prompt) {
      handleSendMessage(act.prompt);
    }
  };

  // Helper to format assistant text with markdown paragraphs and links
  const renderFormattedText = (text) => {
    if (!text) return null;

    const paragraphs = text.split("\n\n");
    return paragraphs.map((para, pIdx) => {
      const lines = para.split("\n");
      return (
        <p key={pIdx} className="mb-2 last:mb-0">
          {lines.map((line, lIdx) => {
            // Replace bold **text**
            const boldParts = line.split(/(\*\*.*?\*\*)/g);
            return (
              <React.Fragment key={lIdx}>
                {boldParts.map((part, bIdx) => {
                  if (part.startsWith("**") && part.endsWith("**")) {
                    return (
                      <strong key={bIdx} className="font-semibold">
                        {part.slice(2, -2)}
                      </strong>
                    );
                  }
                  return part;
                })}
                {lIdx < lines.length - 1 && <br />}
              </React.Fragment>
            );
          })}
        </p>
      );
    });
  };

  const renderWidget = (widgetPayload) => {
    if (!widgetPayload) return null;

    const type = typeof widgetPayload === "string" ? widgetPayload : widgetPayload.type;
    const widgetData = typeof widgetPayload === "object" ? widgetPayload.data || widgetPayload : contextSnapshot;

    if (type === "billing_breakdown") {
      return (
        <TenantBillingBreakdownCard
          data={widgetData?.currentBill || widgetData}
          onCloseDrawer={onClose}
        />
      );
    }

    if (type === "lease_timeline") {
      return (
        <TenantLeaseTimelineCard
          data={widgetData?.contract || widgetData}
          onCloseDrawer={onClose}
        />
      );
    }

    if (type === "maintenance_status" || type === "maintenance_tracker") {
      const ticket = widgetData?.activeMaintenance?.[0] || widgetData;
      return (
        <TenantMaintenanceCard
          data={ticket}
          onCloseDrawer={onClose}
        />
      );
    }

    return null;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`tenant-assistant-backdrop ${isOpen ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer */}
      <div
        className={`tenant-assistant-drawer ${isOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Lilycrest Tenant Assistant"
      >
        {/* Header */}
        <div className="tenant-assistant-header">
          <div className="tenant-assistant-header-top">
            <div className="tenant-assistant-header-brand">
              <div className="tenant-assistant-avatar-badge" aria-hidden="true">
                <Bot className="w-4 h-4" />
              </div>
              <span className="tenant-assistant-title">Tenant Assistant</span>
            </div>

            <div className="tenant-assistant-header-actions">
              <button
                type="button"
                onClick={() => setIsEscalateOpen(true)}
                className="tenant-assistant-escalate-btn"
                title="Speak directly with Branch Admin"
              >
                <Headphones className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                <span>Admin Help</span>
              </button>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="tenant-assistant-icon-btn"
                  aria-label="Clear chat history"
                  title="Clear conversation"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="tenant-assistant-icon-btn"
                aria-label="Close assistant drawer"
                title="Close drawer (Esc)"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="tenant-assistant-banner">
            <div className="tenant-assistant-banner-left">
              <span className="tenant-assistant-banner-branch">{branchLabel}</span>
              <span>•</span>
              <span>Room {roomLabel} ({bedLabel})</span>
            </div>
            <div className="tenant-assistant-banner-right">
              <span className="tenant-assistant-grounded-dot" />
              <span>Grounded on Stay Data</span>
            </div>
          </div>
        </div>

        {/* Message Area */}
        <div ref={bodyRef} onScroll={handleScroll} className="tenant-assistant-body">
          {/* Default Welcome Message if empty */}
          {messages.length === 0 && (
            <div className="tenant-msg-row assistant">
              <div className="tenant-msg-meta">
                <Bot className="w-3.5 h-3.5" />
                <span>Tenant Assistant</span>
              </div>
              <div className="tenant-msg-bubble">
                <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Hello, {tenantDisplayName}!
                </p>
                <p>
                  I am your <strong>Lilycrest Tenant Assistant</strong>. I have real-time access to your room assignment, submetered utility breakdown, active lease agreement, and maintenance tickets.
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Feel free to ask about your monthly billing line items, electricity share, lease renewal timeline, or report room repair concerns.
                </p>
              </div>
            </div>
          )}

          {/* Conversation History */}
          {messages.map((msg, index) => (
            <div key={index} className={`tenant-msg-row ${msg.role}`}>
              <div className="tenant-msg-meta">
                {msg.role === "assistant" ? (
                  <>
                    <Bot className="w-3.5 h-3.5" />
                    <span>Tenant Assistant</span>
                  </>
                ) : (
                  <span>You</span>
                )}
              </div>

              {msg.isError ? (
                <div className="tenant-msg-error-card">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-0.5">Connection Notice</p>
                      <p>{msg.content}</p>
                    </div>
                  </div>
                  <div className="tenant-msg-error-actions">
                    <button
                      type="button"
                      onClick={() => handleSendMessage(messages[index - 1]?.content || "Check my maintenance status")}
                      className="tenant-msg-retry-btn"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Retry Question</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEscalateOpen(true)}
                      className="tenant-msg-retry-btn"
                    >
                      <Headphones className="w-3 h-3" />
                      <span>Speak with Admin</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="tenant-msg-bubble">
                  {renderFormattedText(msg.content)}
                  {msg.widget && renderWidget(msg.widget)}
                </div>
              )}

              {/* Action pills inside assistant turn */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="tenant-action-suggestions-list">
                  {msg.actions.map((act, actIdx) => (
                    <button
                      key={actIdx}
                      type="button"
                      onClick={() => handleActionClick(act)}
                      className="tenant-action-suggestion-chip"
                    >
                      <span>{typeof act === "string" ? act : act.label}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Real-time Streaming Assistant Bubble */}
          {isStreaming && (
            <div className="tenant-msg-row assistant">
              <div className="tenant-msg-meta">
                <Bot className="w-3.5 h-3.5" />
                <span>Tenant Assistant</span>
              </div>
              <div className="tenant-msg-bubble">
                {streamingText ? (
                  renderFormattedText(streamingText)
                ) : (
                  <div className="tenant-typing-indicator" aria-label="Assistant is thinking">
                    <span className="tenant-typing-dot" />
                    <span className="tenant-typing-dot" />
                    <span className="tenant-typing-dot" />
                  </div>
                )}
                {activeWidget && renderWidget(activeWidget)}
              </div>

              {activeActions && activeActions.length > 0 && (
                <div className="tenant-action-suggestions-list">
                  {activeActions.map((act, actIdx) => (
                    <button
                      key={actIdx}
                      type="button"
                      onClick={() => handleActionClick(act)}
                      className="tenant-action-suggestion-chip"
                    >
                      <span>{typeof act === "string" ? act : act.label}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Categorized Route-Aware Quick Prompt Pills */}
        <div className="tenant-quick-prompts-container">
          <div className="tenant-quick-prompts-label">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Quick Tenant Prompts</span>
          </div>
          <div className="tenant-quick-prompts-scroll">
            {activeRoutePrompts.map((item, idx) => {
              const IconComp = item.icon || Sparkles;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(item.prompt)}
                  disabled={isStreaming}
                  className="tenant-quick-prompt-pill"
                >
                  <IconComp className="w-3.5 h-3.5 text-slate-500" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Area */}
        <div className="tenant-assistant-footer">
          <div className="tenant-assistant-input-wrapper">
            <textarea
              ref={textareaRef}
              rows={1}
              maxLength={1000}
              value={inputMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about bills, electricity, lease, or repairs..."
              disabled={isStreaming}
              className="tenant-assistant-textarea"
              aria-label="Ask Lilycrest Tenant Assistant"
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isStreaming}
              className="tenant-assistant-send-btn"
              aria-label="Send message"
              title="Send (Enter)"
            >
              {isStreaming ? (
                <LoaderCircle className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="tenant-assistant-footer-meta">
            <span>Enter to send • Shift+Enter for newline</span>
            <span>{inputMessage.length}/1000</span>
          </div>
        </div>
      </div>

      {/* Human Admin Escalation Modal */}
      <TenantHumanEscalateModal
        isOpen={isEscalateOpen}
        onClose={() => setIsEscalateOpen(false)}
        lastBotMessage={
          messages[messages.length - 1]?.role === "assistant"
            ? messages[messages.length - 1]?.content
            : ""
        }
        onEscalationSuccess={() => {
          onClose();
        }}
      />
    </>
  );
}

