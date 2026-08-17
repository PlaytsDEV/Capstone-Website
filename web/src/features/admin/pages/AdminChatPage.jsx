import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock,
  FileDown,
  Filter,
  Inbox,
  LoaderCircle,
  Lock,
  MessageSquare,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Tag,
  User,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { chatApi } from "../../../shared/api/chatApi.js";
import { useAuth } from "../../../shared/hooks/useAuth";
import useChatSocket from "../../../shared/hooks/useChatSocket.js";
import { showConfirmation, showNotification } from "../../../shared/utils/notification";
import { BRANCH_DISPLAY_NAMES, BRANCH_OPTIONS } from "../../../shared/utils/constants";
import {
  AdminChatSkeleton,
  ChatConversationListSkeleton,
  ChatMessageFeedSkeleton,
} from "../components/AdminContentSkeletons";
import AdminPageHeader from "../../../shared/components/AdminPageHeader";
import AdminIssueClusterBanner from "../components/copilot/AdminIssueClusterBanner";
import AdminReplyDraftButton from "../components/copilot/AdminReplyDraftButton";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import "../styles/design-tokens.css";
import "../styles/admin-common.css";
import "../styles/admin-chat.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in_review", label: "In Review" },
  { value: "waiting_tenant", label: "Waiting for Tenant" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const STATUS_DESCRIPTIONS = {
  open: "Conversation is active and awaiting staff response or triage.",
  in_review: "Staff is currently investigating and working on the tenant's concern.",
  waiting_tenant: "Staff replied; awaiting response or documents from the tenant.",
  resolved: "Tenant concern has been addressed and settled successfully.",
  closed: "Permanently closes and archives the conversation thread with an audit note.",
};

const PRIORITY_DESCRIPTIONS = {
  normal: "Standard priority ticket with standard target turnaround timeline.",
  high: "High priority ticket requiring prioritized administrative attention.",
  urgent: "Critical urgent issue requiring immediate response and handling.",
};

const STATUS_SECTION_ORDER = [
  "open",
  "in_review",
  "waiting_tenant",
  "resolved",
  "closed",
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "billing_concern", label: "Billing Concern" },
  { value: "maintenance_concern", label: "Maintenance Concern" },
  { value: "reservation_concern", label: "Reservation Concern" },
  { value: "payment_concern", label: "Payment Concern" },
  { value: "general_inquiry", label: "General Inquiry" },
  { value: "urgent_issue", label: "Urgent Issue" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All priorities" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const QUICK_REPLIES = [
  "We have received your concern.",
  "Please provide more details.",
  "Your request is being processed.",
  "This issue has been resolved.",
];

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2 };

const fmtDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const fmtRelativeTime = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffSec < 45) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const AVATAR_BG_COLORS = [
  "bg-slate-700 text-white",
  "bg-blue-700 text-white",
  "bg-amber-700 text-white",
  "bg-emerald-700 text-white",
  "bg-indigo-700 text-white",
  "bg-teal-700 text-white",
];

const getAvatarBg = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_BG_COLORS.length;
  return AVATAR_BG_COLORS[index];
};

const getInitials = (name = "T") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (parts[0]?.[0] || "T").toUpperCase();
};

const getBranchLabel = (branch) => BRANCH_DISPLAY_NAMES[branch] || branch || "Unassigned";

const getRoomLabel = (conversation) =>
  [conversation?.roomNumber, conversation?.roomBed].filter(Boolean).join(" / ") ||
  "No room assigned";

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.error ||
  error?.response?.data?.detail ||
  error?.message ||
  fallback;

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return replacements[character] || character;
  });

const getStatusLabel = (status) =>
  STATUS_OPTIONS.find((item) => item.value === status)?.label || "Open";

const getCategoryLabel = (category) =>
  CATEGORY_OPTIONS.find((item) => item.value === category)?.label ||
  "General Inquiry";

const getPriorityLabel = (priority) =>
  PRIORITY_OPTIONS.find((item) => item.value === priority)?.label || "Normal";

const slugify = (value) =>
  String(value || "chat")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function addWrappedPdfText(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(String(text || ""), maxWidth);
  lines.forEach((line, index) => {
    doc.text(line, x, y + index * lineHeight);
  });
  return y + Math.max(lines.length, 1) * lineHeight;
}

export default function AdminChatPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // "all" | "unread" | "urgent" | "me"
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [accessInfo, setAccessInfo] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeNote, setCloseNote] = useState("");
  const [closeNoteError, setCloseNoteError] = useState("");

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("open");

  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [pendingPriority, setPendingPriority] = useState("normal");

  const [listLoading, setListLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [listError, setListError] = useState("");
  const [messagesError, setMessagesError] = useState("");
  const [replyError, setReplyError] = useState("");

  const [tenantTyping, setTenantTyping] = useState(null);
  const typingClearRef = useRef(null);
  const typingSendRef = useRef(null);
  const messageEndRef = useRef(null);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count += 1;
    if (priorityFilter !== "all") count += 1;
    if (categoryFilter !== "all") count += 1;
    if (isOwner && branchFilter !== "all") count += 1;
    return count;
  }, [statusFilter, priorityFilter, categoryFilter, branchFilter, isOwner]);

  const filters = useMemo(
    () => ({
      status: statusFilter,
      branch: isOwner ? branchFilter : "all",
      unread: activeTab === "unread" ? "true" : "",
      assigned: activeTab === "me" ? "me" : "",
      priority: activeTab === "urgent" ? "urgent" : priorityFilter,
      category: categoryFilter,
      search: search.trim(),
    }),
    [
      activeTab,
      branchFilter,
      categoryFilter,
      isOwner,
      priorityFilter,
      search,
      statusFilter,
    ],
  );

  const loadConversations = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setListLoading(true);
      setListError("");
      try {
        const data = await chatApi.getAdminConversations(filters);
        const nextConversations = data?.conversations || [];
        setConversations(nextConversations);
        setAccessInfo(data?.access || null);
        setSelectedConversation((current) => {
          if (!current) return current;
          return nextConversations.find((item) => item.id === current.id) || current;
        });
      } catch (error) {
        const message = getErrorMessage(error, "Failed to load conversations.");
        setListError(message);
        if (!silent) showNotification(message, "error");
      } finally {
        if (!silent) setListLoading(false);
      }
    },
    [filters],
  );

  const loadMessages = useCallback(
    async (conversationId, { silent = false } = {}) => {
      if (!conversationId) return [];
      if (!silent) setMessagesLoading(true);
      setMessagesError("");
      try {
        const data = await chatApi.getAdminMessages(conversationId);
        const nextMessages = data?.messages || [];
        setMessages(nextMessages);
        await loadConversations({ silent: true });
        return nextMessages;
      } catch (error) {
        const message = getErrorMessage(error, "Failed to load messages.");
        setMessagesError(message);
        if (!silent) showNotification(message, "error");
        return [];
      } finally {
        if (!silent) setMessagesLoading(false);
      }
    },
    [loadConversations],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadConversations();
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [loadConversations]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, tenantTyping]);

  const { isConnected: socketConnected } = useChatSocket({
    onTyping: ({ conversationId, senderRole, senderName } = {}) => {
      if (senderRole === "tenant" && selectedConversation?.id === conversationId) {
        setTenantTyping({ name: senderName, conversationId });
        window.clearTimeout(typingClearRef.current);
        typingClearRef.current = window.setTimeout(() => setTenantTyping(null), 4000);
      }
    },
    onNewMessage: ({ message, conversationId } = {}) => {
      if (!conversationId || !message) return;
      if (selectedConversation?.id === conversationId) {
        setMessages((current) => {
          if (current.some((item) => item.id === message.id)) return current;
          return [...current, message];
        });
        chatApi.markAsRead(conversationId).catch(() => {});
      }
      loadConversations({ silent: true });
    },
    onConversationUpdated: (updatedConversation) => {
      if (!updatedConversation?.id) return;
      setConversations((current) => {
        const exists = current.some((item) => item.id === updatedConversation.id);
        if (!exists) return [updatedConversation, ...current];
        return current.map((item) =>
          item.id === updatedConversation.id ? { ...item, ...updatedConversation } : item,
        );
      });
      setSelectedConversation((current) =>
        current?.id === updatedConversation.id
          ? { ...current, ...updatedConversation }
          : current,
      );
    },
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadConversations({ silent: true });
      if (selectedConversation?.id) {
        chatApi.getAdminMessages(selectedConversation.id).then((data) => {
          if (data?.messages) setMessages(data.messages);
        }).catch(() => {});
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, [loadConversations, selectedConversation?.id]);

  const handleSelectConversation = async (conversation) => {
    setSelectedConversation(conversation);
    setReplyError("");
    setReplyText("");
    setTenantTyping(null);
    await loadMessages(conversation.id);
  };

  const handleRefresh = async () => {
    await loadConversations();
    if (selectedConversation?.id) {
      await loadMessages(selectedConversation.id);
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setActiveTab("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setBranchFilter("all");
    setShowAdvancedFilters(false);
  };

  const groupedConversations = useMemo(() => {
    const groups = STATUS_SECTION_ORDER.map((status) => ({
      status,
      label: getStatusLabel(status),
      items: [],
    }));

    conversations.forEach((item) => {
      const targetGroup =
        groups.find((group) => group.status === item.status) || groups[0];
      targetGroup.items.push(item);
    });

    return groups.filter((group) => group.items.length > 0);
  }, [conversations]);

  const handleSendReply = async () => {
    if (!selectedConversation || sending) return;
    const message = replyText.trim();
    if (!message) {
      setReplyError("Please enter a reply message.");
      return;
    }

    if (message.length > 1000) {
      setReplyError("Reply exceeds maximum length of 1000 characters.");
      return;
    }

    setSending(true);
    setReplyError("");
    try {
      const data = await chatApi.sendAdminMessage(selectedConversation.id, message);
      setReplyText("");
      setMessages((current) => [...current, data.message].filter(Boolean));
      setSelectedConversation(data.conversation);
      await loadConversations({ silent: true });
    } catch (error) {
      const messageText = getErrorMessage(error, "Failed to send reply.");
      setReplyError(messageText);
      showNotification(messageText, "error");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDownReply = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const handleAssignToMe = async () => {
    if (!selectedConversation || assigning) return;
    setAssigning(true);
    try {
      const data = await chatApi.assignConversation(selectedConversation.id, "me");
      setSelectedConversation(data.conversation);
      await loadConversations({ silent: true });
      showNotification("Conversation assigned successfully.", "success");
    } catch (error) {
      showNotification(
        getErrorMessage(error, "Failed to assign conversation."),
        "error",
      );
    } finally {
      setAssigning(false);
    }
  };

  const handleOpenStatusModal = () => {
    if (!selectedConversation || selectedConversation.status === "closed") return;
    setPendingStatus(selectedConversation.status || "open");
    setStatusModalOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!selectedConversation || updatingStatus) return;
    if (pendingStatus === selectedConversation.status) {
      setStatusModalOpen(false);
      return;
    }
    if (pendingStatus === "closed") {
      setStatusModalOpen(false);
      handleOpenCloseModal();
      return;
    }

    setUpdatingStatus(true);
    try {
      const data = await chatApi.updateStatus(selectedConversation.id, pendingStatus);
      setSelectedConversation(data.conversation);
      await loadConversations({ silent: true });
      setStatusModalOpen(false);
      showNotification(
        `Conversation status changed to ${getStatusLabel(pendingStatus)}.`,
        "success",
      );
    } catch (error) {
      showNotification(
        getErrorMessage(error, "Failed to update conversation status."),
        "error",
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleOpenPriorityModal = () => {
    if (!selectedConversation || selectedConversation.status === "closed") return;
    setPendingPriority(selectedConversation.priority || "normal");
    setPriorityModalOpen(true);
  };

  const handleConfirmPriorityChange = async () => {
    if (!selectedConversation || updatingPriority) return;
    if (pendingPriority === selectedConversation.priority) {
      setPriorityModalOpen(false);
      return;
    }

    setUpdatingPriority(true);
    try {
      const data = await chatApi.updatePriority(selectedConversation.id, pendingPriority);
      setSelectedConversation(data.conversation);
      await loadConversations({ silent: true });
      setPriorityModalOpen(false);
      showNotification(
        `Conversation priority changed to ${getPriorityLabel(pendingPriority)}.`,
        "success",
      );
    } catch (error) {
      showNotification(
        getErrorMessage(error, "Failed to update conversation priority."),
        "error",
      );
    } finally {
      setUpdatingPriority(false);
    }
  };

  const handleOpenCloseModal = () => {
    setCloseNote("");
    setCloseNoteError("");
    setCloseModalOpen(true);
  };

  const handleConfirmClose = async () => {
    const note = closeNote.trim();
    if (!note) {
      setCloseNoteError("A closing / resolution note is required.");
      return;
    }
    if (note.length < 5) {
      setCloseNoteError("Closing note must be at least 5 characters long.");
      return;
    }

    setClosing(true);
    try {
      const data = await chatApi.closeConversation(selectedConversation.id, note);
      setSelectedConversation(data.conversation);
      await loadConversations({ silent: true });
      setCloseModalOpen(false);
      showNotification("Conversation resolved and closed successfully.", "success");
    } catch (error) {
      const msg = getErrorMessage(error, "Failed to close conversation.");
      setCloseNoteError(msg);
      showNotification(msg, "error");
    } finally {
      setClosing(false);
    }
  };

  const handleDownloadTranscript = async () => {
    if (!selectedConversation || downloading) return;
    setDownloading(true);
    try {
      let transcriptMessages = messages;
      if (!transcriptMessages.length) {
        const data = await chatApi.getAdminMessages(selectedConversation.id);
        transcriptMessages = data?.messages || [];
        setMessages(transcriptMessages);
      }

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 16;
      let y = 18;

      const ensureSpace = (needed = 16) => {
        if (y + needed <= pageHeight - margin) return;
        doc.addPage();
        y = margin;
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("LilyCrest Support Chat Transcript", margin, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString("en-PH")}`, margin, y);
      y += 10;

      const details = [
        ["Tenant", selectedConversation.tenantName],
        ["Branch / Room", `${getBranchLabel(selectedConversation.branch)} - ${getRoomLabel(selectedConversation)}`],
        ["Category", getCategoryLabel(selectedConversation.category)],
        ["Priority", getPriorityLabel(selectedConversation.priority)],
        ["Status", getStatusLabel(selectedConversation.status)],
        ["Assigned Admin", selectedConversation.assignedAdminName || "Unassigned"],
        ["Closed Date", fmtDateTime(selectedConversation.closedAt) || "Not closed"],
      ];

      doc.setFont("helvetica", "bold");
      doc.text("Conversation Details", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      details.forEach(([label, value]) => {
        ensureSpace(7);
        doc.text(`${label}:`, margin, y);
        y = addWrappedPdfText(doc, value || "-", margin + 38, y, pageWidth - margin * 2 - 38, 5);
      });

      if (selectedConversation.closingNote) {
        ensureSpace(12);
        doc.setFont("helvetica", "bold");
        doc.text("Closing Note", margin, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        y = addWrappedPdfText(doc, selectedConversation.closingNote, margin, y, pageWidth - margin * 2, 5);
      }

      y += 5;
      doc.setFont("helvetica", "bold");
      doc.text("Messages", margin, y);
      y += 7;
      doc.setFont("helvetica", "normal");

      if (!transcriptMessages.length) {
        doc.text("No messages yet.", margin, y);
      } else {
        transcriptMessages.forEach((message) => {
          ensureSpace(22);
          const sender = `${message.senderName || "User"} (${message.senderRole || "user"})`;
          doc.setFont("helvetica", "bold");
          doc.text(sender, margin, y);
          doc.setFont("helvetica", "normal");
          doc.text(fmtDateTime(message.createdAt), pageWidth - margin - 44, y);
          y += 6;
          y = addWrappedPdfText(doc, message.message, margin, y, pageWidth - margin * 2, 5);
          y += 4;
        });
      }

      const filename = `lilycrest-chat-${slugify(selectedConversation.tenantName)}-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
      showNotification("Chat transcript downloaded.", "success");
    } catch (error) {
      showNotification(
        getErrorMessage(error, "Failed to download transcript."),
        "error",
      );
    } finally {
      setDownloading(false);
    }
  };

  const unreadTotal = conversations.reduce(
    (total, item) => total + (item.unreadAdminCount || 0),
    0,
  );
  const urgentTotal = conversations.filter((item) => item.priority === "urgent").length;
  const assignedToMeTotal = conversations.filter(
    (item) => item.assignedAdminId && item.assignedAdminId === accessInfo?.adminId,
  ).length;
  const assignedToAnother =
    selectedConversation?.assignedAdminId &&
    accessInfo?.adminId &&
    selectedConversation.assignedAdminId !== accessInfo.adminId;

  if (listLoading && !conversations.length) {
    return <AdminChatSkeleton />;
  }

  return (
    <section className="admin-chat-page space-y-4">
      {/* ── Pattern 1 Sticky Sub-Header ── */}
      <AdminPageHeader
        title="Support Chat"
        subtitle="View tenant conversations, respond in real-time, and manage branch messaging."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted cursor-pointer"
              onClick={handleRefresh}
              disabled={listLoading || messagesLoading}
              title="Refresh conversations"
            >
              <RefreshCw size={14} className={listLoading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider border ${
                socketConnected
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
              }`}
              title={socketConnected ? "Real-time socket active" : "Polling fallback active"}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  socketConnected ? "bg-emerald-600 animate-pulse" : "bg-amber-600"
                }`}
              />
              {socketConnected ? "Live" : "Polling"}
            </span>
          </div>
        }
      />

      {/* ── Full-Width 4-Metric Summary Grid (Static Overview) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Total Threads
            </span>
            <div className="flex shrink-0 items-center justify-center text-slate-500 dark:text-slate-400">
              <MessageSquareText size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
            {conversations.length}
          </div>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Unread
            </span>
            <div className="flex shrink-0 items-center justify-center text-sky-600 dark:text-sky-400">
              <CircleAlert size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
            {unreadTotal}
          </div>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Urgent Priority
            </span>
            <div className="flex shrink-0 items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
            {urgentTotal}
          </div>
        </div>

        <div className="group relative flex flex-col justify-between min-h-[108px] rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-default">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Assigned to Me
            </span>
            <div className="flex shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-400">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground mt-2">
            {assignedToMeTotal}
          </div>
        </div>
      </div>

      {/* ── Main Chat Workspace ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)] gap-4 items-start min-h-[640px]">
        {/* Left Sidebar: Conversations & Filters */}
        <aside className="rounded-xl border border-border bg-card shadow-xs flex flex-col h-[700px] overflow-hidden">
          {/* Search & Filter Bar */}
          <div className="p-3 border-b border-border space-y-2.5 bg-card/60">
            <div className="relative flex items-center">
              <Search
                size={15}
                className="absolute left-3 text-muted-foreground pointer-events-none"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tenant, room, or message..."
                className="w-full h-9 pl-9 pr-8 rounded-lg border border-border bg-input-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Quick Segmented Tabs inside Sidebar */}
            <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-muted border border-border text-[11px] font-semibold">
              <button
                type="button"
                className={`py-1 rounded text-center transition-colors cursor-pointer ${
                  activeTab === "all"
                    ? "bg-card text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`py-1 rounded text-center transition-colors cursor-pointer ${
                  activeTab === "unread"
                    ? "bg-card text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("unread")}
              >
                Unread
              </button>
              <button
                type="button"
                className={`py-1 rounded text-center transition-colors cursor-pointer ${
                  activeTab === "urgent"
                    ? "bg-card text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("urgent")}
              >
                Urgent
              </button>
              <button
                type="button"
                className={`py-1 rounded text-center transition-colors cursor-pointer ${
                  activeTab === "me"
                    ? "bg-card text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("me")}
              >
                Assigned
              </button>
            </div>

            {/* Filter Toggle & Reset */}
            <div className="flex items-center justify-between pt-0.5">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium border transition-colors cursor-pointer ${
                  showAdvancedFilters || activeFiltersCount > 0
                    ? "bg-muted border-border text-foreground font-semibold"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <SlidersHorizontal size={13} />
                <span>Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}</span>
              </button>

              {(activeFiltersCount > 0 || search || activeTab !== "all") && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  Reset all
                </button>
              )}
            </div>

            {showAdvancedFilters && (
              <div className="pt-2 border-t border-border/70 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {STATUS_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Category
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {CATEGORY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                {isOwner && (
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Branch
                    </label>
                    <select
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      className="w-full h-8 px-2 rounded-md border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="all">All branches</option>
                      {BRANCH_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {listLoading ? (
              <ChatConversationListSkeleton count={7} />
            ) : listError ? (
              <div className="p-6 text-center text-xs text-destructive space-y-2">
                <XCircle size={22} className="mx-auto" />
                <span>{listError}</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                <Inbox size={26} className="mx-auto text-muted-foreground/60" />
                <div className="font-semibold text-foreground">No conversations found</div>
                <div>Tenant messages matching your filters will appear here.</div>
              </div>
            ) : (
              groupedConversations.map((group) => (
                <div key={group.status} className="space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>{group.label}</span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                      {group.items.length}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {group.items.map((conversation) => {
                      const isSelected = selectedConversation?.id === conversation.id;
                      const isUnread = conversation.unreadAdminCount > 0;
                      const isUrgent = conversation.priority === "urgent";

                      return (
                        <button
                          type="button"
                          key={conversation.id}
                          onClick={() => handleSelectConversation(conversation)}
                          className={`w-full text-left p-2.5 rounded-lg flex items-start gap-2.5 transition-colors cursor-pointer border ${
                            isSelected
                              ? "bg-muted/90 border-border shadow-2xs font-medium text-foreground"
                              : "border-transparent hover:bg-muted/40 text-card-foreground"
                          } ${isUnread && !isSelected ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}`}
                        >
                          {/* Circular Avatar */}
                          <ProfileAvatar
                            src={conversation.tenantProfileImage}
                            user={{
                              name: conversation.tenantName,
                              profileImage: conversation.tenantProfileImage,
                            }}
                            initials={getInitials(conversation.tenantName)}
                            size={32}
                            alt={conversation.tenantName}
                            className="shrink-0 ring-1 ring-border/40"
                          />

                          {/* Middle Info */}
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-baseline justify-between gap-1">
                              <span
                                className={`text-xs truncate ${
                                  isUnread
                                    ? "font-bold text-foreground"
                                    : "font-semibold text-foreground/90"
                                }`}
                              >
                                {conversation.tenantName}
                              </span>
                              <time className="text-[10px] text-muted-foreground shrink-0 font-normal">
                                {fmtRelativeTime(conversation.lastMessageAt)}
                              </time>
                            </div>

                            <div className="text-[11px] text-muted-foreground truncate font-normal">
                              {getBranchLabel(conversation.branch)} · {getRoomLabel(conversation)}
                            </div>

                            <p className="text-[11px] text-muted-foreground truncate line-clamp-1 leading-tight font-normal">
                              {conversation.lastMessage || "No messages yet"}
                            </p>
                          </div>

                          {/* Badges Column */}
                          <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
                            {isUnread && (
                              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                                {conversation.unreadAdminCount}
                              </span>
                            )}
                            {isUrgent && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                Urgent
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Right Pane: Conversation Details & Message Feed */}
        <section className="rounded-xl border border-border bg-card shadow-xs flex flex-col h-[720px] overflow-hidden">
          {selectedConversation ? (
            <>
              {/* Thread Header */}
              <header className="p-3.5 border-b border-border bg-card/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ProfileAvatar
                    src={selectedConversation.tenantProfileImage}
                    user={{
                      name: selectedConversation.tenantName,
                      profileImage: selectedConversation.tenantProfileImage,
                    }}
                    initials={getInitials(selectedConversation.tenantName)}
                    size={40}
                    alt={selectedConversation.tenantName}
                    className="shrink-0 ring-1 ring-border/40"
                  />
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-foreground truncate">
                        {selectedConversation.tenantName}
                      </h2>
                      <span className="text-xs font-medium text-muted-foreground">
                        {getBranchLabel(selectedConversation.branch)} · {getRoomLabel(selectedConversation)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{getCategoryLabel(selectedConversation.category)}</span>
                    </span>

                    {/* Interactive Status Badge Button */}
                    <button
                      type="button"
                      onClick={handleOpenStatusModal}
                      disabled={selectedConversation.status === "closed"}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-semibold border transition-colors bg-transparent ${
                        selectedConversation.status === "closed"
                          ? "border-border text-slate-600 dark:text-slate-400 cursor-default"
                          : selectedConversation.status === "resolved"
                          ? "border-border text-emerald-700 dark:text-emerald-400 hover:bg-muted/40 cursor-pointer"
                          : selectedConversation.status === "waiting_tenant"
                          ? "border-border text-amber-700 dark:text-amber-400 hover:bg-muted/40 cursor-pointer"
                          : selectedConversation.status === "in_review"
                          ? "border-border text-sky-700 dark:text-sky-400 hover:bg-muted/40 cursor-pointer"
                          : "border-border text-blue-700 dark:text-blue-400 hover:bg-muted/40 cursor-pointer"
                      }`}
                      title="Click to update status with confirmation"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          selectedConversation.status === "resolved"
                            ? "bg-emerald-500"
                            : selectedConversation.status === "waiting_tenant"
                            ? "bg-amber-500"
                            : selectedConversation.status === "in_review"
                            ? "bg-sky-500"
                            : selectedConversation.status === "open"
                            ? "bg-blue-500"
                            : "bg-slate-400"
                        }`}
                      />
                      <span>{getStatusLabel(selectedConversation.status)}</span>
                      {selectedConversation.status !== "closed" && (
                        <ChevronDown size={12} className="opacity-70" />
                      )}
                    </button>

                    {/* Interactive Priority Badge Button */}
                    <button
                      type="button"
                      onClick={handleOpenPriorityModal}
                      disabled={selectedConversation.status === "closed"}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-semibold border transition-colors bg-transparent ${
                        selectedConversation.status === "closed"
                          ? "border-border text-slate-600 dark:text-slate-400 cursor-default"
                          : selectedConversation.priority === "urgent"
                          ? "border-border text-rose-700 dark:text-rose-400 hover:bg-muted/40 cursor-pointer"
                          : selectedConversation.priority === "high"
                          ? "border-border text-amber-700 dark:text-amber-400 hover:bg-muted/40 cursor-pointer"
                          : "border-border text-slate-700 dark:text-slate-300 hover:bg-muted/40 cursor-pointer"
                      }`}
                      title="Click to update priority"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          selectedConversation.priority === "urgent"
                            ? "bg-rose-500"
                            : selectedConversation.priority === "high"
                            ? "bg-amber-500"
                            : "bg-slate-400"
                        }`}
                      />
                      <span>Priority: {getPriorityLabel(selectedConversation.priority)}</span>
                      {selectedConversation.status !== "closed" && (
                        <ChevronDown size={12} className="opacity-70" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Assigned Admin Indicator */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-xs">
                    <span className="text-muted-foreground">Assigned:</span>
                    <span className="font-semibold text-foreground">
                      {selectedConversation.assignedAdminName || "Unassigned"}
                    </span>
                    {!selectedConversation.assignedAdminName && selectedConversation.status !== "closed" && (
                      <button
                        type="button"
                        onClick={handleAssignToMe}
                        disabled={assigning}
                        className="ml-1 inline-flex items-center gap-1 rounded bg-muted/60 border border-border px-2 py-0.5 text-[11px] font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        {assigning ? (
                          <LoaderCircle size={11} className="animate-spin" />
                        ) : (
                          <UserCheck size={11} />
                        )}
                        <span>Assign to me</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadTranscript}
                    disabled={downloading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    {downloading ? (
                      <LoaderCircle size={14} className="animate-spin" />
                    ) : (
                      <FileDown size={14} />
                    )}
                    <span>Transcript</span>
                  </button>

                  {selectedConversation.status !== "closed" && (
                    <button
                      type="button"
                      onClick={handleOpenCloseModal}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 dark:hover:bg-rose-700 dark:hover:text-white px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                      title="Quick action: Archive and lock this conversation with a resolution note"
                    >
                      <Lock size={13} />
                      <span>Resolve & Close</span>
                    </button>
                  )}
                </div>
              </header>

              {selectedConversation?.priority === "urgent" && selectedConversation?.status !== "closed" && (
                <div className="px-4 pt-3 pb-1 border-b border-border">
                  <AdminIssueClusterBanner clusters={[{
                    type: "Maintenance Cluster",
                    description: "Multiple open tickets detected for the same unit.",
                    count: 3,
                    location: selectedConversation?.roomNumber ? `Room ${selectedConversation.roomNumber}` : `${getBranchLabel(selectedConversation?.branch)} Branch`,
                    action: "Review Room History"
                  }]} />
                </div>
              )}

              {assignedToAnother && (
                <div className="px-4 py-2 bg-card border-b border-border text-xs text-foreground flex items-center gap-2 shadow-2xs">
                  <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    Currently assigned to <strong className="font-semibold text-foreground">{selectedConversation.assignedAdminName}</strong>. Please coordinate before replying.
                  </span>
                </div>
              )}

              {/* Message Feed */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-muted/15">
                {messagesLoading ? (
                  <ChatMessageFeedSkeleton count={5} />
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8 space-y-2">
                    <MessageSquare size={32} className="text-muted-foreground/50" />
                    <div className="font-semibold text-foreground">No messages yet</div>
                    <div className="text-xs">
                      Conversation opened. Awaiting messages or replies.
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isTenant = msg.senderRole === "tenant";
                    const senderAvatarSrc = isTenant
                      ? (msg.senderProfileImage || selectedConversation.tenantProfileImage)
                      : (msg.senderProfileImage || (user?._id === msg.senderId ? user?.profileImage : ""));

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2.5 ${
                          isTenant ? "justify-start" : "justify-end flex-row-reverse"
                        }`}
                      >
                        <ProfileAvatar
                          src={senderAvatarSrc}
                          user={{
                            name: msg.senderName,
                            profileImage: senderAvatarSrc,
                          }}
                          initials={getInitials(msg.senderName)}
                          size={28}
                          alt={msg.senderName}
                          className="shrink-0 mb-1 ring-1 ring-border/40"
                        />
                        <div
                          className={`max-w-[78%] rounded-xl p-3.5 space-y-1.5 shadow-2xs ${
                            isTenant
                              ? "bg-card border border-border text-foreground"
                              : "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                          }`}
                        >
                          <div
                            className={`flex items-center justify-between gap-3 text-[11px] ${
                              isTenant
                                ? "text-muted-foreground"
                                : "text-slate-300 dark:text-slate-600"
                            }`}
                          >
                            <span className="font-bold">
                              {msg.senderName} ({msg.senderRole || "admin"})
                            </span>
                            <time>{fmtDateTime(msg.createdAt)}</time>
                          </div>
                          <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}

                {tenantTyping?.conversationId === selectedConversation?.id && (
                  <div className="flex items-center gap-2 text-xs italic text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.2s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.4s]" />
                    </span>
                    <span>{tenantTyping.name} is typing...</span>
                  </div>
                )}

                <div ref={messageEndRef} />
              </div>

              {/* Closed Banner */}
              {selectedConversation.status === "closed" ? (
                <div className="p-3.5 bg-slate-100 dark:bg-slate-900 border-t border-border text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold">This conversation is resolved & closed.</div>
                    {selectedConversation.closingNote && (
                      <div className="text-muted-foreground">
                        Resolution Note: <em>{selectedConversation.closingNote}</em>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Reply Composer */
                <footer className="p-3 border-t border-border bg-card space-y-2.5">
                  {/* Quick Replies */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {QUICK_REPLIES.map((template) => (
                      <button
                        type="button"
                        key={template}
                        onClick={() => {
                          setReplyText(template);
                          setReplyError("");
                        }}
                        className="rounded-full border border-border bg-card px-3 py-1 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap cursor-pointer shrink-0"
                      >
                        {template}
                      </button>
                    ))}
                  </div>

                  {replyError && (
                    <div className="text-xs text-destructive flex items-center gap-1">
                      <XCircle size={13} />
                      <span>{replyError}</span>
                    </div>
                  )}

                  <div>
                    <AdminReplyDraftButton
                      conversationId={selectedConversation?.id}
                      ticketCategory={selectedConversation?.category || "general_inquiry"}
                      urgency={selectedConversation?.priority || "normal"}
                      recentMessages={
                        Array.isArray(messages)
                          ? messages.slice(-6).map((m) => ({
                              senderRole: m.senderRole || (m.isStaff ? "admin" : "tenant"),
                              message: m.message || "",
                            }))
                          : []
                      }
                      tenantContext={{
                        tenantName: selectedConversation?.tenantName,
                        roomNumber: selectedConversation?.roomNumber,
                        branch: selectedConversation?.branch,
                      }}
                      branch={selectedConversation?.branch}
                      onDraftGenerated={(draft) => {
                        setReplyText(draft);
                        if (replyError) setReplyError("");
                      }}
                      disabled={sending}
                    />
                    <textarea
                      value={replyText}
                      onChange={(e) => {
                        setReplyText(e.target.value);
                        if (replyError) setReplyError("");

                        if (
                          selectedConversation?.id &&
                          selectedConversation.status !== "closed" &&
                          !typingSendRef.current
                        ) {
                          chatApi.broadcastTyping(selectedConversation.id);
                          typingSendRef.current = window.setTimeout(() => {
                            typingSendRef.current = null;
                          }, 2000);
                        }
                      }}
                      onKeyDown={handleKeyDownReply}
                      placeholder="Type a reply... (Press Enter to send, Shift+Enter for new line)"
                      rows={3}
                      maxLength={1000}
                      className="w-full rounded-lg border border-border bg-input-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border transition-colors resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] ${
                        replyText.length > 900
                          ? "text-rose-600 font-bold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {replyText.trim().length} / 1000
                    </span>

                    <button
                      type="button"
                      onClick={handleSendReply}
                      disabled={sending || !replyText.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                    >
                      {sending ? (
                        <LoaderCircle size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      <span>{sending ? "Sending..." : "Send Reply"}</span>
                    </button>
                  </div>
                </footer>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <MessageSquareText size={28} />
              </div>
              <h3 className="text-base font-bold text-foreground">
                Select a conversation to view messages
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Choose a tenant thread from the list on the left to read messages, send replies, or adjust ticket statuses.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ── Close Conversation Modal Dialog ── */}
      {closeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="flex shrink-0 items-center justify-center text-rose-600 dark:text-rose-400">
                  <Lock size={18} />
                </div>
                <h3 className="text-sm font-bold text-foreground">Resolve & Close Conversation</h3>
              </div>
              <button
                type="button"
                onClick={() => setCloseModalOpen(false)}
                disabled={closing}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Resolving and closing this conversation with{" "}
              <strong className="text-foreground">
                {selectedConversation?.tenantName}
              </strong>{" "}
              will archive the active thread and lock future replies. Please enter a formal resolution note for auditing.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground block">
                Resolution Note <span className="text-destructive">*</span>
              </label>
              <textarea
                value={closeNote}
                onChange={(e) => {
                  setCloseNote(e.target.value);
                  if (closeNoteError) setCloseNoteError("");
                }}
                placeholder="Describe how this tenant concern was resolved..."
                rows={4}
                maxLength={500}
                className="w-full rounded-lg border border-border bg-input-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border resize-none"
              />
              <div className="flex items-center justify-between text-[11px]">
                {closeNoteError ? (
                  <span className="text-destructive font-medium">{closeNoteError}</span>
                ) : (
                  <span className="text-muted-foreground">Min. 5 characters</span>
                )}
                <span className="text-muted-foreground">{closeNote.trim().length} / 500</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setCloseModalOpen(false)}
                disabled={closing}
                className="rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                disabled={closing || !closeNote.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {closing ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Lock size={14} />
                )}
                <span>{closing ? "Resolving..." : "Confirm Resolution & Close"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Status Change Confirmation Modal Dialog ── */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-primary shrink-0" />
                <h3 className="text-sm font-bold text-foreground">Update Ticket Status</h3>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                disabled={updatingStatus}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Select the new status for conversation with{" "}
              <strong className="text-foreground">{selectedConversation?.tenantName}</strong>:
            </p>

            <div className="space-y-2">
              {STATUS_OPTIONS.filter((opt) => opt.value !== "all").map((opt) => {
                const isSelected = pendingStatus === opt.value;
                const isCurrent = selectedConversation?.status === opt.value;

                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setPendingStatus(opt.value)}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 ${
                      isSelected
                        ? "bg-muted/90 border-primary/60 shadow-2xs"
                        : "bg-card border-border hover:bg-muted/40"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card"
                      }`}
                    >
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white dark:bg-slate-900" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-foreground">
                          {opt.label}
                        </span>
                        {isCurrent && (
                          <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground uppercase">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {STATUS_DESCRIPTIONS[opt.value]}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                disabled={updatingStatus}
                className="rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={updatingStatus || pendingStatus === selectedConversation?.status}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-1.5 text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {updatingStatus ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                <span>
                  {pendingStatus === "closed"
                    ? "Proceed to Close Note"
                    : "Confirm Status Change"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Priority Change Confirmation Modal Dialog ── */}
      {priorityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
                <h3 className="text-sm font-bold text-foreground">Update Ticket Priority</h3>
              </div>
              <button
                type="button"
                onClick={() => setPriorityModalOpen(false)}
                disabled={updatingPriority}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Select the priority level for conversation with{" "}
              <strong className="text-foreground">{selectedConversation?.tenantName}</strong>:
            </p>

            <div className="space-y-2">
              {PRIORITY_OPTIONS.filter((opt) => opt.value !== "all").map((opt) => {
                const isSelected = pendingPriority === opt.value;
                const isCurrent = selectedConversation?.priority === opt.value;

                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setPendingPriority(opt.value)}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 ${
                      isSelected
                        ? "bg-muted/90 border-primary/60 shadow-2xs"
                        : "bg-card border-border hover:bg-muted/40"
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card"
                      }`}
                    >
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white dark:bg-slate-900" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-foreground">
                          {opt.label} Priority
                        </span>
                        {isCurrent && (
                          <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground uppercase">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {PRIORITY_DESCRIPTIONS[opt.value]}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setPriorityModalOpen(false)}
                disabled={updatingPriority}
                className="rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPriorityChange}
                disabled={updatingPriority || pendingPriority === selectedConversation?.priority}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-1.5 text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {updatingPriority ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                <span>Confirm Priority</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
