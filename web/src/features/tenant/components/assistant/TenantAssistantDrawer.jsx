import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../../../shared/hooks/useAuth";
import { streamTenantAssistant } from "../../api/tenantAssistantApi";
import TenantBillingBreakdownCard from "./cards/TenantBillingBreakdownCard";
import TenantLeaseTimelineCard from "./cards/TenantLeaseTimelineCard";
import TenantMaintenanceCard from "./cards/TenantMaintenanceCard";
import TenantHumanEscalateModal from "./modals/TenantHumanEscalateModal";
import "../../styles/tenant-assistant.css";

const STORAGE_KEY = "lilycrest_tenant_assistant_msgs";

const CATEGORIZED_PROMPTS = {
  applicant: [
    { label: "Reservation status", prompt: "What is my current reservation status?" },
    { label: "Deposit payment steps", prompt: "How do I settle the advance rent and security deposit?" },
    { label: "Accepted KYC IDs", prompt: "What valid IDs are accepted for identity verification?" },
    { label: "Viewing schedule", prompt: "How can I schedule an in-person room viewing appointment?" },
  ],
  billing: [
    { label: "Electricity math", prompt: "How was my submetered electricity share computed this month?" },
    { label: "Payment due date", prompt: "When is my current bill due and how do I settle it?" },
    { label: "Water consumption", prompt: "Is water really free and included in my monthly rent?" },
  ],
  contracts: [
    { label: "Lease expiration", prompt: "When does my current lease contract expire and how many days are left?" },
    { label: "Renew contract", prompt: "What are the steps to request a lease renewal?" },
    { label: "Deposit refund", prompt: "How does the security deposit refund and move-out clearance work?" },
  ],
  maintenance: [
    { label: "Active tickets", prompt: "What is the current status of my room repair requests?" },
    { label: "Report issue", prompt: "How do I submit an urgent plumbing or air-conditioning issue?" },
    { label: "Technician hours", prompt: "What are the available hours for on-site technician repairs?" },
  ],
  default: [
    { label: "Active tickets", prompt: "Do I have any active maintenance tickets scheduled?" },
    { label: "Report issue", prompt: "How do I submit an urgent plumbing or air-conditioning issue?" },
    { label: "Bill breakdown", prompt: "Can you show my current monthly bill breakdown?" },
    { label: "Electricity math", prompt: "How was my submetered electricity share computed this month?" },
    { label: "Lease timeline", prompt: "How many days are left on my lease agreement?" },
    { label: "Deposit refund", prompt: "How does the security deposit refund and move-out clearance work?" },
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

  const isApplicant = user?.role === "applicant" || contextSnapshot?.isApplicant;

  // Determine active route prompts
  const activeRoutePrompts = useMemo(() => {
    if (isApplicant) return CATEGORIZED_PROMPTS.applicant;
    const path = location.pathname.toLowerCase();
    if (path.includes("billing")) return CATEGORIZED_PROMPTS.billing;
    if (path.includes("contract")) return CATEGORIZED_PROMPTS.contracts;
    if (path.includes("maintenance")) return CATEGORIZED_PROMPTS.maintenance;
    return CATEGORIZED_PROMPTS.default;
  }, [location.pathname, isApplicant]);

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

    if (type === "maintenance_status" || type === "maintenance_tracker" || type === "maintenance_card") {
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
              <span className="tenant-assistant-title">{isApplicant ? "Applicant Assistant" : "Tenant Assistant"}</span>
            </div>

            <div className="tenant-assistant-header-actions">
              <button
                type="button"
                onClick={() => setIsEscalateOpen(true)}
                className="tenant-assistant-escalate-btn"
                title="Speak directly with Branch Admin"
              >
                <span>Admin Help</span>
              </button>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="tenant-assistant-icon-btn text-xs font-semibold px-2 py-1"
                  aria-label="Clear chat history"
                  title="Clear conversation"
                >
                  Reset
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="tenant-assistant-icon-btn text-xs font-semibold px-2 py-1"
                aria-label="Close assistant drawer"
                title="Close drawer (Esc)"
              >
                Close
              </button>
            </div>
          </div>

          <div className="tenant-assistant-banner">
            <div className="tenant-assistant-banner-left">
              <span className="tenant-assistant-banner-branch">{branchLabel}</span>
              <span>•</span>
              {isApplicant ? (
                <span>{contextSnapshot?.reservation?.status ? `Reservation: ${contextSnapshot.reservation.status.toUpperCase()}` : "Application in Progress"}</span>
              ) : (
                <span>Room {roomLabel} ({bedLabel})</span>
              )}
            </div>
            <div className="tenant-assistant-banner-right">
              <span className="tenant-assistant-grounded-dot" />
              <span>{isApplicant ? "Grounded on Reservation" : "Grounded on Stay Data"}</span>
            </div>
          </div>
        </div>

        {/* Message Area */}
        <div ref={bodyRef} onScroll={handleScroll} className="tenant-assistant-body">
          {/* Default Welcome Message if empty */}
          {messages.length === 0 && (
            <div className="tenant-msg-row assistant">
              <div className="tenant-msg-meta">
                <span>{isApplicant ? "Applicant Assistant" : "Tenant Assistant"}</span>
              </div>
              <div className="tenant-msg-bubble">
                <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Hello, {tenantDisplayName}!
                </p>
                {isApplicant ? (
                  <>
                    <p>
                      I am your <strong>Lilycrest Applicant Assistant</strong>. I have real-time access to your reservation status, viewing schedule, KYC document verification progress, and advance deposit guidelines.
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Feel free to ask about your application stage, payment requirements, valid IDs, or schedule an in-person room viewing.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      I am your <strong>Lilycrest Tenant Assistant</strong>. I have real-time access to your room assignment, submetered utility breakdown, active lease agreement, and maintenance tickets.
                    </p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Feel free to ask about your monthly billing line items, electricity share, lease renewal timeline, or report room repair concerns.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Conversation History */}
          {messages.map((msg, index) => (
            <div key={index} className={`tenant-msg-row ${msg.role}`}>
              <div className="tenant-msg-meta">
                {msg.role === "assistant" ? (
                  <span>Tenant Assistant</span>
                ) : (
                  <span>You</span>
                )}
              </div>

              {msg.isError ? (
                <div className="tenant-msg-error-card">
                  <div>
                    <p className="font-semibold mb-0.5">Connection Notice</p>
                    <p>{msg.content}</p>
                  </div>
                  <div className="tenant-msg-error-actions">
                    <button
                      type="button"
                      onClick={() => handleSendMessage(messages[index - 1]?.content || "Check my maintenance status")}
                      className="tenant-msg-retry-btn"
                    >
                      <span>Retry Question</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEscalateOpen(true)}
                      className="tenant-msg-retry-btn"
                    >
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
            <span>Quick Tenant Prompts</span>
          </div>
          <div className="tenant-quick-prompts-scroll">
            {activeRoutePrompts.map((item, idx) => {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(item.prompt)}
                  disabled={isStreaming}
                  className="tenant-quick-prompt-pill"
                >
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
              className="tenant-assistant-send-btn text-xs font-bold px-3 py-1.5"
              aria-label="Send message"
              title="Send (Enter)"
            >
              <span>{isStreaming ? "Sending..." : "Send"}</span>
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

