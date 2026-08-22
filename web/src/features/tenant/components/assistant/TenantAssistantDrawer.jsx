import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bot,
  Headphones,
  RotateCcw,
  RotateCw,
  X,
  Sparkles,
  Send,
  LoaderCircle,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  ReceiptText,
  Zap,
  Droplet,
  FileText,
  Wrench,
  Calendar,
  UserCheck,
  Copy,
  Check,
  Square,
  CreditCard,
  Clock,
  Megaphone,
} from "lucide-react";
import { useAuth } from "../../../../shared/hooks/useAuth";
import { streamTenantAssistant } from "../../api/tenantAssistantApi";
import TenantBillingBreakdownCard from "./cards/TenantBillingBreakdownCard";
import TenantLeaseTimelineCard from "./cards/TenantLeaseTimelineCard";
import TenantMaintenanceCard from "./cards/TenantMaintenanceCard";
import TenantPaymentGuideCard from "./cards/TenantPaymentGuideCard";
import TenantHouseRulesCard from "./cards/TenantHouseRulesCard";
import TenantAnnouncementCard from "./cards/TenantAnnouncementCard";
import TenantHumanEscalateModal from "./modals/TenantHumanEscalateModal";
import TenantSupportChatView from "./TenantSupportChatView";
import "../../styles/tenant-assistant.css";

const STORAGE_KEY = "lilycrest_tenant_assistant_msgs";

const CATEGORIZED_PROMPTS = {
  applicant: [
    { label: "Reservation status", prompt: "What is my current reservation status?", icon: ShieldCheck },
    { label: "Deposit payment steps", prompt: "How do I settle the advance rent and security deposit?", icon: ReceiptText },
    { label: "Accepted KYC IDs", prompt: "What valid IDs are accepted for identity verification?", icon: FileText },
    { label: "Viewing schedule", prompt: "How can I schedule an in-person room viewing appointment?", icon: Calendar },
  ],
  billing: [
    { label: "Electricity math", prompt: "How was my submetered electricity share computed this month?", icon: Zap },
    { label: "Payment due date", prompt: "When is my current bill due and how do I settle it?", icon: Calendar },
    { label: "Water consumption", prompt: "Is water really free and included in my monthly rent?", icon: Droplet },
  ],
  contracts: [
    { label: "Lease expiration", prompt: "When does my current lease contract expire and how many days are left?", icon: Calendar },
    { label: "Renew contract", prompt: "What are the steps to request a lease renewal?", icon: FileText },
    { label: "Deposit refund", prompt: "How does the security deposit refund and move-out clearance work?", icon: ShieldCheck },
  ],
  maintenance: [
    { label: "Active tickets", prompt: "What is the current status of my room repair requests?", icon: Wrench },
    { label: "Report issue", prompt: "How do I submit an urgent plumbing or air-conditioning issue?", icon: Wrench },
    { label: "Technician hours", prompt: "What are the available hours for on-site technician repairs?", icon: UserCheck },
  ],
  default: [
    { label: "Active tickets", prompt: "Do I have any active maintenance tickets scheduled?", icon: Wrench },
    { label: "Report issue", prompt: "How do I submit an urgent plumbing or air-conditioning issue?", icon: Wrench },
    { label: "Bill breakdown", prompt: "Can you show my current monthly bill breakdown?", icon: ReceiptText },
    { label: "Electricity math", prompt: "How was my submetered electricity share computed this month?", icon: Zap },
    { label: "Lease timeline", prompt: "How many days are left on my lease agreement?", icon: FileText },
    { label: "Deposit refund", prompt: "How does the security deposit refund and move-out clearance work?", icon: ShieldCheck },
  ],
};

function formatBranch(raw) {
  if (!raw) return "Lilycrest";
  const str = String(raw).toLowerCase();
  if (str.includes("gil") || str.includes("puyat") || str.includes("pasay")) return "Gil Puyat";
  if (str.includes("guadalupe") || str.includes("makati")) return "Guadalupe";
  return raw.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TenantAssistantDrawer({ isOpen, onClose, onUnreadCountChange }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("assistant"); // "assistant" | "support"
  const [activeSupportConvId, setActiveSupportConvId] = useState(null);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);

  const handleUnreadCountChange = useCallback((count) => {
    setUnreadSupportCount(count);
    onUnreadCountChange?.(count);
  }, [onUnreadCountChange]);

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

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

  const handleCopyTranscript = async () => {
    if (!messages || messages.length === 0) return;
    const transcript = messages
      .map((m) => `${m.role === "user" ? "Tenant" : "Lilycrest Assistant"}: ${m.content}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(transcript);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      // Ignore clipboard errors
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      if (streamingText.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: streamingText.trim(),
            widget: activeWidget,
            actions: activeActions,
            timestamp: new Date().toISOString(),
          },
        ]);
        setStreamingText("");
      }
    }
  };

  const handleRefreshStayData = async () => {
    if (isRefreshing || isStreaming) return;
    try {
      setIsRefreshing(true);
      await streamTenantAssistant(
        { message: "Refresh stay data" },
        {
          onDone: (result) => {
            if (result?.contextSnapshot) {
              setContextSnapshot(result.contextSnapshot);
            }
          },
        }
      );
    } catch (err) {
      console.error("Failed to refresh stay data:", err);
    } finally {
      setIsRefreshing(false);
    }
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

    if (act.url) {
      onClose?.();
      navigate(act.url);
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

    if (type === "payment_guide" || type === "payment_options" || type === "payment_methods") {
      return (
        <TenantPaymentGuideCard
          data={widgetData}
          onCloseDrawer={onClose}
        />
      );
    }

    if (type === "house_rules" || type === "building_rules" || type === "curfew_policy") {
      return (
        <TenantHouseRulesCard
          data={widgetData}
          onCloseDrawer={onClose}
        />
      );
    }

    if (type === "recent_announcements" || type === "announcement_card" || type === "branch_advisory") {
      return (
        <TenantAnnouncementCard
          data={widgetData?.recentAnnouncements || widgetData}
          onCloseDrawer={onClose}
        />
      );
    }

    if (type === "billing_breakdown") {
      const billData = widgetData?.currentBill || (widgetData?.billId || widgetData?.billing_id ? widgetData : null);
      if (!billData) return null;
      return (
        <TenantBillingBreakdownCard
          data={billData}
          onCloseDrawer={onClose}
        />
      );
    }

    if (type === "lease_timeline") {
      const contractData = widgetData?.contract || (widgetData?.contractId ? widgetData : null);
      if (!contractData) return null;
      return (
        <TenantLeaseTimelineCard
          data={contractData}
          onCloseDrawer={onClose}
        />
      );
    }

    if (type === "maintenance_status" || type === "maintenance_tracker" || type === "maintenance_card") {
      if (isApplicant) return null;
      const ticket = widgetData?.activeMaintenance?.[0] || (widgetData?.ticketCode || widgetData?.ticketNumber ? widgetData : null);
      if (!ticket) return null;
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
              <span className="tenant-assistant-title">{isApplicant ? "Applicant Assistant" : "Tenant Assistant"}</span>
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
                  onClick={handleCopyTranscript}
                  className="tenant-assistant-icon-btn"
                  aria-label="Copy conversation transcript"
                  title={hasCopied ? "Copied to clipboard!" : "Copy conversation"}
                >
                  {hasCopied ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Copy className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              )}

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
              {isApplicant ? (
                <span>{contextSnapshot?.reservation?.status ? `Reservation: ${contextSnapshot.reservation.status.toUpperCase()}` : "Application in Progress"}</span>
              ) : (
                <span>Room {roomLabel} ({bedLabel})</span>
              )}
            </div>
            <div className="tenant-assistant-banner-right">
              <button
                type="button"
                onClick={handleRefreshStayData}
                disabled={isRefreshing || isStreaming}
                className="tenant-assistant-refresh-btn"
                title="Click to refresh live stay data"
                aria-label="Refresh live stay data"
              >
                <RotateCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-amber-500" : "text-slate-400"}`} aria-hidden="true" />
                <span>{isRefreshing ? "Refreshing..." : (isApplicant ? "Grounded on Reservation" : "Grounded on Stay Data")}</span>
              </button>
            </div>
          </div>
          <div className="tenant-assistant-tab-switcher px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("assistant")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                activeTab === "assistant"
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Assistant</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("support")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer relative ${
                activeTab === "support"
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Live Support</span>
              {unreadSupportCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold bg-rose-500 text-white rounded-full leading-none">
                  {unreadSupportCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {activeTab === "support" ? (
          <TenantSupportChatView
            initialConversationId={activeSupportConvId}
            onOpenEscalateModal={() => setIsEscalateOpen(true)}
            onSwitchToAssistant={() => setActiveTab("assistant")}
            onUnreadCountChange={handleUnreadCountChange}
          />
        ) : (
          <>
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
                          Select a suggested prompt below or type your question:
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          I am your <strong>Lilycrest Tenant Assistant</strong>. I am grounded in your live room stay data at <strong>{branchLabel}</strong>, including current billing, electricity meter usage, lease agreement, and active repair tickets.
                        </p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Select a suggested prompt below or ask about your stay:
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Message Feed */}
              {messages.map((msg, index) => (
                <div key={index} className={`tenant-msg-row ${msg.role}`}>
                  <div className="tenant-msg-meta">
                    <span>
                      {msg.role === "user"
                        ? "You"
                        : isApplicant
                        ? "Applicant Assistant"
                        : "Tenant Assistant"}
                    </span>
                  </div>
                  <div className={`tenant-msg-bubble ${msg.isError ? "error" : ""}`}>
                    {renderFormattedText(msg.content)}
                  </div>

                  {/* Render Widget if attached */}
                  {msg.widget && renderWidget(msg.widget)}

                  {/* Render Quick Actions if attached */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="tenant-assistant-actions">
                      {msg.actions.map((act, aIdx) => (
                        <button
                          key={aIdx}
                          type="button"
                          onClick={() => handleActionClick(act)}
                          className="tenant-assistant-action-chip"
                        >
                          <span>{typeof act === "string" ? act : act.label}</span>
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Live streaming bubble */}
              {isStreaming && (
                <div className="tenant-msg-row assistant">
                  <div className="tenant-msg-meta">
                    <span>{isApplicant ? "Applicant Assistant" : "Tenant Assistant"}</span>
                  </div>
                  <div className="tenant-msg-bubble">
                    {streamingText ? (
                      renderFormattedText(streamingText)
                    ) : (
                      <div className="tenant-assistant-typing">
                        <span />
                        <span />
                        <span />
                      </div>
                    )}
                  </div>

                  {activeWidget && renderWidget(activeWidget)}

                  {activeActions && activeActions.length > 0 && (
                    <div className="tenant-assistant-actions">
                      {activeActions.map((act, aIdx) => (
                        <button
                          key={aIdx}
                          type="button"
                          onClick={() => handleActionClick(act)}
                          className="tenant-assistant-action-chip"
                        >
                          <span>{typeof act === "string" ? act : act.label}</span>
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Route Prompts Bar */}
            <div className="tenant-assistant-prompts-bar">
              <div className="tenant-assistant-prompts-label">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Quick {isApplicant ? "Applicant" : "Tenant"} Prompts</span>
              </div>
              <div className="tenant-assistant-prompts-scroll">
                {activeRoutePrompts.map((p, idx) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(p.prompt)}
                      disabled={isStreaming}
                      className="tenant-assistant-prompt-chip"
                      title={p.prompt}
                    >
                      {Icon && <Icon className="w-3 h-3 mr-1 opacity-70" />}
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input Composer */}
            <div className="tenant-assistant-footer">
              <div className="tenant-assistant-input-card">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputMessage}
                  maxLength={1000}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isApplicant
                      ? "Ask about reservation, ID verification, viewing, or deposits..."
                      : "Ask about bills, electricity, lease, or repairs..."
                  }
                  disabled={isStreaming}
                  className="tenant-assistant-textarea"
                />

                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="tenant-assistant-stop-btn"
                    aria-label="Stop generating response"
                    title="Stop generating"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim()}
                    className="tenant-assistant-send-btn"
                    aria-label="Send message"
                    title="Send (Enter)"
                  >
                    <Send className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="tenant-assistant-footer-meta">
                <span>Enter to send • Shift+Enter for newline</span>
                <span>{inputMessage.length}/1000</span>
              </div>
            </div>
          </>
        )}
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
        onEscalationSuccess={(res) => {
          setActiveTab("support");
          const newConvId = res?.data?.conversationId || res?.conversationId;
          if (newConvId) {
            setActiveSupportConvId(newConvId);
          }
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Your inquiry has been escalated directly to our Branch Admin team. You can view real-time replies and continue the conversation in the Live Support tab.",
              timestamp: new Date().toISOString(),
            },
          ]);
        }}
      />
    </>
  );
};
