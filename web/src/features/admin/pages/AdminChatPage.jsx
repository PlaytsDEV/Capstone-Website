import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock,
  Download,
  Eye,
  FileDown,
  FileText,
  Filter,
  Image as ImageIcon,
  Inbox,
  LoaderCircle,
  Lock,
  MessageSquare,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Tag,
  User,
  UserCheck,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { chatApi } from "../../../shared/api/chatApi.js";
import { useAuth } from "../../../shared/hooks/useAuth";
import useChatSocket from "../../../shared/hooks/useChatSocket.js";
import { showConfirmation, showNotification } from "../../../shared/utils/notification";
import { BRANCH_DISPLAY_NAMES, BRANCH_OPTIONS } from "../../../shared/utils/constants";
import { validateFile } from "../../../shared/utils/firebaseStorageUpload.js";
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
  waiting_tenant: "Staff replied; awaiting the tenant's YES / NO resolution confirmation.",
  resolved: "The tenant confirmed that the concern was resolved.",
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
  "Please confirm whether this resolved your concern.",
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

function ProtectedChatImage({ attachment, className, onOpen }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    chatApi.getAttachmentBlob(attachment)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setSource(objectUrl);
      })
      .catch(() => setSource(""));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment]);

  if (!source) {
    return <div className={`${className} bg-muted animate-pulse`} aria-label="Loading protected attachment" />;
  }
  return (
    <button
      type="button"
      onClick={() => onOpen?.({ ...attachment, objectUrl: source })}
      className="relative group rounded-lg overflow-hidden border border-border/40 focus:outline-none cursor-pointer block"
      title="Click to enlarge"
    >
      <img
        src={source}
        alt={attachment.name || "Attachment"}
        className={className}
      />
      <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex items-center justify-center text-white">
        <Eye size={18} />
      </span>
    </button>
  );
}

const fmtShortTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const fmtDateDivider = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
};

const isSameDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

const fmtFileSize = (bytes) => {
  if (!bytes || Number.isNaN(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const navigate = useNavigate();
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
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showAiDraft, setShowAiDraft] = useState(false);
  const [dismissedClusters, setDismissedClusters] = useState({});
  const [stagedAttachments, setStagedAttachments] = useState([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState(null);
  const fileInputRef = useRef(null);

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeNote, setCloseNote] = useState("");
  const [closeNoteError, setCloseNoteError] = useState("");

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("open");

  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [pendingPriority, setPendingPriority] = useState("normal");

  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const hasLoadedOnceRef = useRef(false);
  const typingClearRef = useRef(null);
  const typingSendRef = useRef(null);
  const messageEndRef = useRef(null);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
  }, [messages]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count += 1;
    if (priorityFilter !== "all") count += 1;
    if (categoryFilter !== "all") count += 1;
    if (isOwner && branchFilter !== "all") count += 1;
    return count;
  }, [statusFilter, priorityFilter, categoryFilter, branchFilter, isOwner]);

  const loadConversations = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        if (!hasLoadedOnceRef.current) {
          setInitialLoading(true);
        } else {
          setIsRefreshing(true);
        }
      }
      setListError("");
      try {
        const data = await chatApi.getAdminConversations({
          branch: isOwner ? branchFilter : "all",
        });
        const nextConversations = data?.conversations || [];
        setConversations(nextConversations);
        setAccessInfo(data?.access || null);
        hasLoadedOnceRef.current = true;
        setSelectedConversation((current) => {
          if (!current) return current;
          return nextConversations.find((item) => item.id === current.id) || current;
        });
      } catch (error) {
        const message = getErrorMessage(error, "Failed to load conversations.");
        setListError(message);
        if (!silent) showNotification(message, "error");
      } finally {
        if (!silent) {
          setInitialLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [branchFilter, isOwner],
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
    loadConversations();
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
        chatApi.markAdminRead(conversationId).catch(() => {});
      }
      loadConversations({ silent: true });
    },
    onMessagesRead: ({ conversationId, readerRole, readAt } = {}) => {
      if (
        selectedConversation?.id === conversationId &&
        readerRole === "tenant"
      ) {
        setMessages((current) =>
          current.map((msg) => {
            if (msg.senderRole !== "tenant" && !msg.readAt) {
              return { ...msg, readAt: readAt || new Date().toISOString() };
            }
            return msg;
          }),
        );
      }
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

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    const myAdminId = accessInfo?.adminId || user?._id || user?.id;

    return conversations.filter((item) => {
      // 1. Search filter
      if (q) {
        const matchesSearch =
          (item.ticketId || "").toLowerCase().includes(q) ||
          (item.tenantName || "").toLowerCase().includes(q) ||
          (item.tenantEmail || "").toLowerCase().includes(q) ||
          (item.roomNumber || "").toLowerCase().includes(q) ||
          (item.roomBed || "").toLowerCase().includes(q) ||
          (item.lastMessage || "").toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // 2. Active Tab filter
      if (activeTab === "unread" && !(item.unreadAdminCount > 0)) {
        return false;
      }
      if (activeTab === "urgent" && item.priority !== "urgent") {
        return false;
      }
      if (activeTab === "me") {
        if (!item.assignedAdminId || String(item.assignedAdminId) !== String(myAdminId)) {
          return false;
        }
      }

      // 3. Status filter
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      // 4. Priority filter (if not in urgent tab)
      if (activeTab !== "urgent" && priorityFilter !== "all" && item.priority !== priorityFilter) {
        return false;
      }

      // 5. Category filter
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [
    conversations,
    search,
    activeTab,
    accessInfo?.adminId,
    user?._id,
    user?.id,
    statusFilter,
    priorityFilter,
    categoryFilter,
  ]);

  const groupedConversations = useMemo(() => {
    const groups = STATUS_SECTION_ORDER.map((status) => ({
      status,
      label: getStatusLabel(status),
      items: [],
    }));

    filteredConversations.forEach((item) => {
      const targetGroup =
        groups.find((group) => group.status === item.status) || groups[0];
      targetGroup.items.push(item);
    });

    return groups.filter((group) => group.items.length > 0);
  }, [filteredConversations]);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newAttachments = [];
    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        showNotification(validation.error, "error");
        continue;
      }
      const isImage = file.type.startsWith("image/");
      const previewUrl = isImage ? URL.createObjectURL(file) : null;
      newAttachments.push({
        file,
        previewUrl,
        name: file.name,
        size: file.size,
        type: file.type,
        isImage,
      });
    }

    if (newAttachments.length > 0) {
      setStagedAttachments((prev) => [...prev, ...newAttachments].slice(0, 5));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveStagedAttachment = (index) => {
    setStagedAttachments((prev) => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDownloadAttachment = async (attachment) => {
    try {
      const blob = await chatApi.getAttachmentBlob(attachment);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.name || attachment.fileName || "attachment";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      showNotification(getErrorMessage(error, "Unable to download attachment."), "error");
    }
  };

  const handlePaste = (e) => {
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;

    const pastedImages = [];
    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.type && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const validation = validateFile(file);
          if (!validation.valid) {
            showNotification(validation.error, "error");
            continue;
          }
          const previewUrl = URL.createObjectURL(file);
          const extension = file.type.split("/")[1] || "png";
          const formattedName =
            file.name && file.name !== "image.png"
              ? file.name
              : `Pasted_Image_${Date.now()}.${extension}`;
          pastedImages.push({
            file,
            previewUrl,
            name: formattedName,
            size: file.size,
            type: file.type,
            isImage: true,
          });
        }
      }
    }

    if (pastedImages.length > 0) {
      setStagedAttachments((prev) => [...prev, ...pastedImages].slice(0, 5));
      const hasText = e.clipboardData.getData("text/plain");
      if (!hasText) {
        e.preventDefault();
      }
    }
  };

  const handleSendReply = async () => {
    if (!selectedConversation || sending || uploadingAttachments) return;
    const message = replyText.trim();
    if (!message && stagedAttachments.length === 0) {
      setReplyError("Please enter a reply message or attach a file.");
      return;
    }

    if (message.length > 1000) {
      setReplyError("Reply exceeds maximum length of 1000 characters.");
      return;
    }

    setSending(true);
    setReplyError("");
    try {
      let uploadedAttachments = [];
      if (stagedAttachments.length > 0) {
        setUploadingAttachments(true);
        const uploadPromises = stagedAttachments.map(async (item) => {
          const result = await chatApi.uploadAttachment(selectedConversation.id, item.file);
          return result.attachment;
        });
        uploadedAttachments = await Promise.all(uploadPromises);
      }

      const data = await chatApi.sendAdminMessage(
        selectedConversation.id,
        message,
        uploadedAttachments,
      );

      // Clean up local preview object URLs
      stagedAttachments.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      setStagedAttachments([]);
      setReplyText("");
      setMessages((current) => {
        const next = [...current, data.message].filter(Boolean);
        const seen = new Set();
        return next.filter((m) => {
          if (!m?.id || seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
      });
      setSelectedConversation(data.conversation);
      await loadConversations({ silent: true });
    } catch (error) {
      const messageText = getErrorMessage(error, "Failed to send reply.");
      setReplyError(messageText);
      showNotification(messageText, "error");
    } finally {
      setSending(false);
      setUploadingAttachments(false);
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
      setCloseNoteError("A closing note is required.");
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
      showNotification("Conversation closed successfully.", "success");
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
        ["Inquiry ID", selectedConversation.ticketId || "Not assigned"],
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

  const handleReviewRoomHistory = useCallback(() => {
    if (!selectedConversation) return;
    const searchParam = selectedConversation.roomNumber || "";
    const branchParam = selectedConversation.branch || "";
    const params = new URLSearchParams();
    if (searchParam) {
      params.set("search", searchParam);
    }
    if (branchParam) {
      params.set("branch", branchParam);
    }
    navigate(`/admin/maintenance?${params.toString()}`);
  }, [navigate, selectedConversation]);

  const totalThreads = conversations.length;
  const unreadTotal = useMemo(
    () => conversations.reduce((total, item) => total + (item.unreadAdminCount || 0), 0),
    [conversations],
  );
  const urgentTotal = useMemo(
    () => conversations.filter((item) => item.priority === "urgent").length,
    [conversations],
  );
  const assignedToMeTotal = useMemo(() => {
    const myAdminId = accessInfo?.adminId || user?._id || user?.id;
    return conversations.filter(
      (item) => item.assignedAdminId && String(item.assignedAdminId) === String(myAdminId),
    ).length;
  }, [conversations, accessInfo?.adminId, user?._id, user?.id]);
  const assignedToAnother =
    selectedConversation?.assignedAdminId &&
    accessInfo?.adminId &&
    selectedConversation.assignedAdminId !== accessInfo.adminId;

  if (initialLoading && !conversations.length) {
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
              disabled={isRefreshing || messagesLoading}
              title="Refresh conversations"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
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
      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)] gap-4 items-stretch h-[calc(100vh-210px)] min-h-[580px] max-h-[920px]">
        {/* Left Sidebar: Conversations & Filters */}
        <aside className="rounded-xl border border-border bg-card shadow-xs flex flex-col h-full overflow-hidden">
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
            {initialLoading ? (
              <ChatConversationListSkeleton count={7} />
            ) : listError ? (
              <div className="p-6 text-center text-xs text-destructive space-y-2">
                <XCircle size={22} className="mx-auto" />
                <span>{listError}</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                <Inbox size={26} className="mx-auto text-muted-foreground/60" />
                <div className="font-semibold text-foreground">
                  {conversations.length === 0 ? "No conversations found" : "No matching conversations"}
                </div>
                <div>
                  {conversations.length === 0
                    ? "Tenant messages will appear here."
                    : "No tenant messages match your active filter criteria."}
                </div>
                {conversations.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Reset all filters
                  </button>
                )}
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
                              {conversation.ticketId || "Inquiry ID pending"} · {getBranchLabel(conversation.branch)} · {getRoomLabel(conversation)}
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
        <section className="rounded-xl border border-border bg-card shadow-xs flex flex-col h-full overflow-hidden">
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
                      {selectedConversation.ticketId && (
                        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                          {selectedConversation.ticketId}
                        </span>
                      )}
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

              {selectedConversation?.priority === "urgent" &&
                selectedConversation?.status !== "closed" &&
                !dismissedClusters[selectedConversation?.id] && (
                  <div className="px-4 pt-3 pb-1 border-b border-border">
                    <AdminIssueClusterBanner
                      clusters={[
                        {
                          type: "Maintenance Cluster",
                          description:
                            "Multiple open tickets detected for the same unit.",
                          count: 3,
                          location: selectedConversation?.roomNumber
                            ? `Room ${selectedConversation.roomNumber}`
                            : `${getBranchLabel(selectedConversation?.branch)} Branch`,
                          action: "Review Room History",
                          onAction: handleReviewRoomHistory,
                        },
                      ]}
                      onDismiss={() => {
                        if (selectedConversation?.id) {
                          setDismissedClusters((prev) => ({
                            ...prev,
                            [selectedConversation.id]: true,
                          }));
                        }
                      }}
                    />
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
              <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-muted/15">
                {/* Thread Initialization Banner */}
                {selectedConversation && (
                  <div className="mx-auto my-3 max-w-sm rounded-xl border border-border bg-card p-3.5 text-center shadow-2xs space-y-1">
                    <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-muted text-muted-foreground mx-auto mb-0.5">
                      <MessageSquare size={16} />
                    </div>
                    <div className="text-xs font-bold text-foreground">
                      Support Thread with {selectedConversation.tenantName}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {getBranchLabel(selectedConversation.branch)} · {getRoomLabel(selectedConversation)}
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      <span>{getCategoryLabel(selectedConversation.category)}</span>
                      <span>•</span>
                      <span>{fmtDateTime(selectedConversation.createdAt)}</span>
                    </div>
                  </div>
                )}

                {messagesLoading ? (
                  <ChatMessageFeedSkeleton count={5} />
                ) : sortedMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8 space-y-2">
                    <MessageSquare size={32} className="text-muted-foreground/50" />
                    <div className="font-semibold text-foreground">No messages yet</div>
                    <div className="text-xs">
                      Conversation opened. Awaiting messages or replies.
                    </div>
                  </div>
                ) : (
                  sortedMessages.map((msg, i) => {
                    const isTenant = msg.senderRole === "tenant";
                    const senderAvatarSrc = isTenant
                      ? (msg.senderProfileImage || selectedConversation.tenantProfileImage)
                      : (msg.senderProfileImage || (user?._id === msg.senderId ? user?.profileImage : ""));

                    const prevMsg = i > 0 ? sortedMessages[i - 1] : null;
                    const nextMsg = i < sortedMessages.length - 1 ? sortedMessages[i + 1] : null;

                    const showDateDivider = !prevMsg || !isSameDay(msg.createdAt, prevMsg.createdAt);

                    const isSameSenderAsPrev = prevMsg &&
                      prevMsg.senderRole === msg.senderRole &&
                      (msg.senderRole !== "tenant" || prevMsg.senderId === msg.senderId) &&
                      isSameDay(msg.createdAt, prevMsg.createdAt) &&
                      (new Date(msg.createdAt) - new Date(prevMsg.createdAt)) < 5 * 60 * 1000;

                    const isSameSenderAsNext = nextMsg &&
                      nextMsg.senderRole === msg.senderRole &&
                      (msg.senderRole !== "tenant" || nextMsg.senderId === msg.senderId) &&
                      isSameDay(msg.createdAt, nextMsg.createdAt) &&
                      (new Date(nextMsg.createdAt) - new Date(msg.createdAt)) < 5 * 60 * 1000;

                    const isFirstInGroup = !isSameSenderAsPrev;
                    const isLastInGroup = !isSameSenderAsNext;

                    return (
                      <div key={msg.id} className="space-y-1">
                        {showDateDivider && (
                          <div className="flex items-center justify-center my-3">
                            <span className="rounded-full bg-card border border-border px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground shadow-2xs">
                              {fmtDateDivider(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        <div
                          className={`flex items-end gap-2 ${
                            isTenant ? "justify-start" : "justify-end"
                          } ${isFirstInGroup ? "mt-2.5" : "mt-0.5"}`}
                        >
                          {/* Tenant Avatar on Left: Visible on last message of group */}
                          {isTenant && (
                            <div className="w-7 shrink-0 flex justify-center">
                              {isLastInGroup ? (
                                <ProfileAvatar
                                  src={senderAvatarSrc}
                                  user={{
                                    name: msg.senderName,
                                    profileImage: senderAvatarSrc,
                                  }}
                                  initials={getInitials(msg.senderName)}
                                  size={28}
                                  alt={msg.senderName}
                                  className="mb-0.5 ring-1 ring-border/40"
                                />
                              ) : (
                                <div className="w-7 h-7" />
                              )}
                            </div>
                          )}

                          {/* Message Content & Metadata */}
                          <div className={`max-w-[75%] space-y-0.5 ${isTenant ? "text-left" : "text-right"}`}>
                            {/* Sender Header on First Message in Group */}
                            {isFirstInGroup && (
                              <div
                                className={`text-[10px] font-bold text-muted-foreground px-1 pb-0.5 ${
                                  isTenant ? "text-left" : "text-right"
                                }`}
                              >
                                {msg.senderName} ({msg.senderRole || (isTenant ? "tenant" : "admin")})
                              </div>
                            )}

                            {/* Bubble */}
                            <div
                              className={`inline-block text-left p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words shadow-2xs space-y-2 ${
                                isTenant
                                  ? `bg-card border border-border text-foreground ${
                                      isLastInGroup ? "rounded-bl-xs" : ""
                                    }`
                                  : `bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 ${
                                      isLastInGroup ? "rounded-br-xs" : ""
                                    }`
                              }`}
                            >
                              {/* Photo Attachments */}
                              {Array.isArray(msg.attachments) &&
                                msg.attachments.filter((a) =>
                                  String(a.type || a.mimeType || "").startsWith("image"),
                                ).length > 0 && (
                                  <div
                                    className={`gap-1.5 ${
                                      msg.attachments.filter((a) =>
                                        String(a.type || a.mimeType || "").startsWith("image"),
                                      ).length === 1
                                        ? "block max-w-[260px]"
                                        : "grid grid-cols-2 max-w-[320px]"
                                    }`}
                                  >
                                    {msg.attachments
                                      .filter((a) =>
                                        String(a.type || a.mimeType || "").startsWith("image"),
                                      )
                                      .map((img, imgIdx) => (
                                        <ProtectedChatImage
                                          key={imgIdx}
                                          attachment={img}
                                          className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                                          onOpen={setPreviewImageModal}
                                        />
                                      ))}
                                  </div>
                                )}

                              {/* Document / PDF Attachments */}
                              {Array.isArray(msg.attachments) &&
                                msg.attachments.filter(
                                  (a) =>
                                    !String(a.type || a.mimeType || "").startsWith("image"),
                                ).length > 0 && (
                                  <div className="space-y-1.5 max-w-[280px]">
                                    {msg.attachments
                                      .filter(
                                        (a) =>
                                          !String(a.type || a.mimeType || "").startsWith("image"),
                                      )
                                      .map((doc, docIdx) => (
                                        <button
                                          type="button"
                                          key={docIdx}
                                          onClick={() => handleDownloadAttachment(doc)}
                                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs transition-colors ${
                                            isTenant
                                              ? "bg-muted/40 hover:bg-muted border-border text-foreground"
                                              : "bg-white/10 hover:bg-white/20 border-white/20 text-white dark:bg-black/10 dark:hover:bg-black/20 dark:border-black/20 dark:text-slate-900"
                                          }`}
                                        >
                                          <FileText size={16} className="shrink-0 opacity-80" />
                                          <div className="flex-1 min-w-0">
                                            <p className="truncate font-medium text-[11px]">
                                              {doc.name || "Attached File"}
                                            </p>
                                            {doc.size > 0 && (
                                              <p className="text-[10px] opacity-70">
                                                {fmtFileSize(doc.size)}
                                              </p>
                                            )}
                                          </div>
                                          <Download size={13} className="shrink-0 opacity-70" />
                                        </button>
                                      ))}
                                  </div>
                                )}

                              {/* Text message (if present) */}
                              {msg.message ? (
                                <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                                  {msg.message}
                                </p>
                              ) : null}
                            </div>

                            {/* Timestamp & Seen Indicator on Last Message in Group */}
                            {isLastInGroup && (
                              <div
                                className={`flex items-center gap-1.5 text-[10px] text-muted-foreground px-1 pt-0.5 ${
                                  isTenant ? "justify-start" : "justify-end"
                                }`}
                              >
                                <time>{fmtShortTime(msg.createdAt)}</time>
                                {!isTenant && (
                                  <>
                                    <span>•</span>
                                    {msg.readAt ? (
                                      <span
                                        className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-semibold"
                                        title={`Seen at ${fmtDateTime(msg.readAt)}`}
                                      >
                                        <CheckCheck size={11} />
                                        <span>Seen</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                                        <Check size={11} />
                                        <span>Sent</span>
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Staff/Owner Avatar on Right: Visible on last message of group */}
                          {!isTenant && (
                            <div className="w-7 shrink-0 flex justify-center">
                              {isLastInGroup ? (
                                <ProfileAvatar
                                  src={senderAvatarSrc}
                                  user={{
                                    name: msg.senderName,
                                    profileImage: senderAvatarSrc,
                                  }}
                                  initials={getInitials(msg.senderName)}
                                  size={28}
                                  alt={msg.senderName}
                                  className="mb-0.5 ring-1 ring-border/40"
                                />
                              ) : (
                                <div className="w-7 h-7" />
                              )}
                            </div>
                          )}
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
                <footer className="p-3 border-t border-border bg-card space-y-2">
                  {/* Expandable Quick Replies (Appears AT THE TOP of the toggle buttons) */}
                  {showQuickReplies && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 border-b border-border/40 animate-in fade-in slide-in-from-bottom-1 duration-150">
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
                  )}

                  {/* Expandable AI Auto-Draft Reply (Appears AT THE TOP of the toggle buttons) */}
                  {showAiDraft && (
                    <div className="pt-0.5 pb-1 border-b border-border/40 animate-in fade-in slide-in-from-bottom-1 duration-150">
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
                    </div>
                  )}

                  {/* Collapsible Action Bar & Attachment Trigger */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setShowQuickReplies((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold border transition-colors cursor-pointer ${
                          showQuickReplies
                            ? "bg-muted border-border text-foreground shadow-2xs"
                            : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                        title="Toggle quick response templates"
                      >
                        <Zap size={13} className={showQuickReplies ? "text-amber-500" : "text-muted-foreground"} />
                        <span>Quick Replies</span>
                        {showQuickReplies ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAiDraft((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold border transition-colors cursor-pointer ${
                          showAiDraft
                            ? "bg-muted border-border text-foreground shadow-2xs"
                            : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                        title="Toggle AI Auto-Draft Assistant"
                      >
                        <Sparkles size={13} className={showAiDraft ? "text-primary" : "text-muted-foreground"} />
                        <span>AI Draft Reply</span>
                        {showAiDraft ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sending || uploadingAttachments}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer disabled:opacity-50"
                        title="Attach photos or documents (JPEG, PNG, WebP, PDF up to 5MB)"
                      >
                        <Paperclip size={13} className="text-muted-foreground" />
                        <span>Attach File / Photo</span>
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </div>
                  </div>

                  {/* Staged Attachments Tray */}
                  {stagedAttachments.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto py-1.5 px-1 bg-muted/40 rounded-lg border border-border animate-in fade-in duration-150">
                      {stagedAttachments.map((item, idx) => (
                        <div
                          key={idx}
                          className="relative group flex items-center gap-2 bg-card border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground shrink-0 shadow-2xs"
                        >
                          {item.isImage && item.previewUrl ? (
                            <img
                              src={item.previewUrl}
                              alt={item.name}
                              className="h-8 w-8 rounded object-cover border border-border/50 shrink-0"
                            />
                          ) : (
                            <FileText size={18} className="text-muted-foreground shrink-0" />
                          )}
                          <div className="max-w-[120px] truncate">
                            <p className="font-medium text-[11px] truncate">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground">{fmtFileSize(item.size)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveStagedAttachment(idx)}
                            disabled={sending || uploadingAttachments}
                            className="ml-1 p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            title="Remove attachment"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {replyError && (
                    <div className="text-xs text-destructive flex items-center gap-1">
                      <XCircle size={13} />
                      <span>{replyError}</span>
                    </div>
                  )}

                  <div>
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
                      onPaste={handlePaste}
                      placeholder="Type a reply or paste photos... (Press Enter to send, Shift+Enter for new line)"
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
                      disabled={
                        sending ||
                        uploadingAttachments ||
                        (!replyText.trim() && stagedAttachments.length === 0)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                    >
                      {sending || uploadingAttachments ? (
                        <LoaderCircle size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      <span>
                        {uploadingAttachments
                          ? "Uploading..."
                          : sending
                          ? "Sending..."
                          : "Send Reply"}
                      </span>
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
                <h3 className="text-sm font-bold text-foreground">Close Conversation</h3>
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
              Administratively closing this conversation with{" "}
              <strong className="text-foreground">
                {selectedConversation?.tenantName}
              </strong>{" "}
              will archive the active thread and lock future replies. This is separate from tenant-confirmed resolution. Please enter a closing note for auditing.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground block">
                Closing Note <span className="text-destructive">*</span>
              </label>
              <textarea
                value={closeNote}
                onChange={(e) => {
                  setCloseNote(e.target.value);
                  if (closeNoteError) setCloseNoteError("");
                }}
                placeholder="Explain why this conversation is being closed..."
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
                <span>{closing ? "Closing..." : "Confirm Close"}</span>
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
              {STATUS_OPTIONS.filter((opt) => !["all", "resolved"].includes(opt.value)).map((opt) => {
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

      {/* ── Fullscreen Image Lightbox Modal ── */}
      {previewImageModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-150"
            onClick={() => setPreviewImageModal(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close & Action Toolbar */}
              <div className="w-full flex items-center justify-between gap-3 text-white pb-2 px-1">
                <p className="text-xs text-white/90 font-medium truncate max-w-md">
                  {previewImageModal.name || previewImageModal.fileName || "Photo Preview"}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={previewImageModal.objectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={previewImageModal.name || "photo"}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold backdrop-blur-sm transition-colors text-white cursor-pointer"
                    title="Download original photo"
                  >
                    <Download size={13} />
                    <span>Download</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewImageModal(null)}
                    className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-colors cursor-pointer"
                    title="Close preview"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <img
                src={previewImageModal.objectUrl}
                alt={previewImageModal.name || "Full Preview"}
                className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl ring-1 ring-white/10"
              />
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
