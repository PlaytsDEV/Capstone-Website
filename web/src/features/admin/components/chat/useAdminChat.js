import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { chatApi } from "../../../../shared/api/chatApi.js";
import { useAuth } from "../../../../shared/hooks/useAuth";
import useChatSocket from "../../../../shared/hooks/useChatSocket.js";
import { showNotification } from "../../../../shared/utils/notification";
import {
  downloadChatTranscript,
  getErrorMessage,
  getStatusLabel,
  getPriorityLabel,
} from "./chatConstants";

export function useAdminChat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [branchFilter, setBranchFilter] = useState("all");
  const [conversations, setConversations] = useState([]);
  const [accessInfo, setAccessInfo] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [dismissedClusters, setDismissedClusters] = useState({});
  const [stagedAttachments, setStagedAttachments] = useState([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState(null);

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [priorityModalOpen, setPriorityModalOpen] = useState(false);

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
  const [replyError, setReplyError] = useState("");
  const [tenantTyping, setTenantTyping] = useState(null);

  const hasLoadedOnceRef = useRef(false);
  const typingClearRef = useRef(null);
  const feedContainerRef = useRef(null);
  const messageEndRef = useRef(null);

  const scrollToBottom = useCallback((behavior = "auto") => {
    const el = feedContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } else if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  const loadConversations = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        if (!hasLoadedOnceRef.current) setInitialLoading(true);
        else setIsRefreshing(true);
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
      try {
        const data = await chatApi.getAdminMessages(conversationId);
        const nextMessages = data?.messages || [];
        setMessages(nextMessages);
        await loadConversations({ silent: true });
        return nextMessages;
      } catch (error) {
        const message = getErrorMessage(error, "Failed to load messages.");
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

  useLayoutEffect(() => {
    if (!messagesLoading && messages.length > 0) {
      scrollToBottom("auto");
    }
  }, [messages, messagesLoading, scrollToBottom]);

  useEffect(() => {
    if (!messagesLoading && messages.length > 0) {
      scrollToBottom("auto");
      const rAF = requestAnimationFrame(() => scrollToBottom("auto"));
      const t1 = setTimeout(() => scrollToBottom("auto"), 50);
      const t2 = setTimeout(() => scrollToBottom("auto"), 150);
      const t3 = setTimeout(() => scrollToBottom("auto"), 300);
      return () => {
        cancelAnimationFrame(rAF);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [messages, messagesLoading, selectedConversation?.id, tenantTyping, scrollToBottom]);

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
      if (selectedConversation?.id === conversationId && readerRole === "tenant") {
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
    requestAnimationFrame(() => scrollToBottom("auto"));
    setTimeout(() => scrollToBottom("auto"), 50);
  };

  const handleRefresh = async () => {
    await loadConversations();
    if (selectedConversation?.id) {
      await loadMessages(selectedConversation.id);
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

  const handleAssignToMe = async () => {
    if (!selectedConversation || assigning) return;
    setAssigning(true);
    try {
      const data = await chatApi.assignConversation(selectedConversation.id, "me");
      setSelectedConversation(data.conversation);
      await loadConversations({ silent: true });
      showNotification("Conversation assigned successfully.", "success");
    } catch (error) {
      showNotification(getErrorMessage(error, "Failed to assign conversation."), "error");
    } finally {
      setAssigning(false);
    }
  };

  const handleConfirmStatusChange = async (pendingStatus) => {
    if (!selectedConversation || updatingStatus) return;
    if (pendingStatus === selectedConversation.status) {
      setStatusModalOpen(false);
      return;
    }
    if (pendingStatus === "closed") {
      setStatusModalOpen(false);
      setCloseModalOpen(true);
      return;
    }

    setUpdatingStatus(true);
    try {
      const data = await chatApi.updateStatus(selectedConversation.id, pendingStatus);
      setSelectedConversation(data.conversation);
      await loadConversations({ silent: true });
      setStatusModalOpen(false);
      showNotification(`Conversation status changed to ${getStatusLabel(pendingStatus)}.`, "success");
    } catch (error) {
      showNotification(getErrorMessage(error, "Failed to update conversation status."), "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleConfirmPriorityChange = async (pendingPriority) => {
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
      showNotification(`Conversation priority changed to ${getPriorityLabel(pendingPriority)}.`, "success");
    } catch (error) {
      showNotification(getErrorMessage(error, "Failed to update conversation priority."), "error");
    } finally {
      setUpdatingPriority(false);
    }
  };

  const handleConfirmClose = async (note, setNoteError) => {
    setClosing(true);
    try {
      const data = await chatApi.closeConversation(selectedConversation.id, note);
      setSelectedConversation(data.conversation);
      await loadConversations({ silent: true });
      setCloseModalOpen(false);
      showNotification("Conversation closed successfully.", "success");
    } catch (error) {
      const msg = getErrorMessage(error, "Failed to close conversation.");
      if (setNoteError) setNoteError(msg);
      showNotification(msg, "error");
    } finally {
      setClosing(false);
    }
  };

  const handleDownloadTranscript = async () => {
    if (!selectedConversation || downloading) return;
    setDownloading(true);
    try {
      await downloadChatTranscript(selectedConversation, messages);
      showNotification("Chat transcript downloaded.", "success");
    } catch (error) {
      showNotification(getErrorMessage(error, "Failed to download transcript."), "error");
    } finally {
      setDownloading(false);
    }
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

  const handleReviewRoomHistory = useCallback(() => {
    if (!selectedConversation) return;
    const searchParam = selectedConversation.roomNumber || "";
    const branchParam = selectedConversation.branch || "";
    const params = new URLSearchParams();
    if (searchParam) params.set("search", searchParam);
    if (branchParam) params.set("branch", branchParam);
    navigate(`/admin/maintenance?${params.toString()}`);
  }, [navigate, selectedConversation]);

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

  return {
    isOwner,
    user,
    branchFilter,
    setBranchFilter,
    conversations,
    accessInfo,
    selectedConversation,
    messages,
    replyText,
    setReplyText,
    stagedAttachments,
    setStagedAttachments,
    uploadingAttachments,
    sending,
    closing,
    assigning,
    updatingStatus,
    updatingPriority,
    downloading,
    listError,
    replyError,
    setReplyError,
    tenantTyping,
    dismissedClusters,
    setDismissedClusters,
    initialLoading,
    isRefreshing,
    messagesLoading,
    socketConnected,
    previewImageModal,
    setPreviewImageModal,
    closeModalOpen,
    setCloseModalOpen,
    statusModalOpen,
    setStatusModalOpen,
    priorityModalOpen,
    setPriorityModalOpen,
    unreadTotal,
    urgentTotal,
    assignedToMeTotal,
    feedContainerRef,
    messageEndRef,
    scrollToBottom,
    handleSelectConversation,
    handleRefresh,
    handleSendReply,
    handleAssignToMe,
    handleConfirmStatusChange,
    handleConfirmPriorityChange,
    handleConfirmClose,
    handleDownloadTranscript,
    handleDownloadAttachment,
    handleReviewRoomHistory,
  };
}
