import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Send,
  Paperclip,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  ShieldCheck,
  Eye,
  FileText,
  LoaderCircle,
  RotateCcw,
  PlusCircle,
  ChevronDown,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { chatApi } from "../../../../shared/api/chatApi.js";
import { validateFile } from "../../../../shared/utils/firebaseStorageUpload.js";
import useChatSocket from "../../../../shared/hooks/useChatSocket.js";
import { useAuth } from "../../../../shared/hooks/useAuth";

const STATUS_CONFIG = {
  open: { label: "Open", dotColor: "bg-emerald-500" },
  in_review: { label: "In Review", dotColor: "bg-amber-500" },
  waiting_tenant: { label: "Waiting for Tenant", dotColor: "bg-amber-500" },
  resolved: { label: "Resolved", dotColor: "bg-emerald-500" },
  closed: { label: "Closed", dotColor: "bg-slate-400" },
};

function formatShortTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function ProtectedChatAttachment({ attachment, onOpenImage }) {
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const isImage = String(attachment.mimeType || attachment.type || "").startsWith("image/");

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    if (isImage) {
      setLoading(true);
      chatApi.getAttachmentBlob(attachment)
        .then((blob) => {
          objectUrl = URL.createObjectURL(blob);
          if (active) {
            setSource(objectUrl);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment, isImage]);

  if (isImage) {
    if (loading || !source) {
      return (
        <div className="w-40 h-28 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse flex items-center justify-center text-xs text-slate-400">
          Loading image...
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onOpenImage?.(source)}
        className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 focus:outline-none cursor-pointer block mt-1.5"
        title="Click to enlarge"
      >
        <img
          src={source}
          alt={attachment.name || "Attachment"}
          className="w-44 max-h-36 object-cover rounded-lg"
        />
        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
          <Eye size={16} />
        </span>
      </button>
    );
  }

  return (
    <a
      href={attachment.url || attachment.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-2 mt-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
    >
      <FileText className="w-4 h-4 text-slate-500" />
      <span className="truncate max-w-[180px]">{attachment.name || attachment.fileName || "Download Attachment"}</span>
    </a>
  );
}

export default function TenantSupportChatView({
  initialConversationId = null,
  onOpenEscalateModal,
  onSwitchToAssistant,
  onUnreadCountChange,
}) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(initialConversationId);
  const [messages, setMessages] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [stagedFiles, setStagedFiles] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isTypingAdmin, setIsTypingAdmin] = useState(false);
  const [typingAdminTimer, setTypingAdminTimer] = useState(null);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const messageEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load conversations for the current tenant
  const loadConversations = useCallback(async (selectTargetId = null) => {
    try {
      setIsLoadingList(true);
      const res = await chatApi.getMyConversations();
      const list = res.conversations || [];
      setConversations(list);

      // Compute total unread for tenant
      const totalUnread = list.reduce((sum, c) => sum + (Number(c.unreadTenantCount) || 0), 0);
      onUnreadCountChange?.(totalUnread);

      if (selectTargetId) {
        setSelectedConvId(selectTargetId);
      } else if (!selectedConvId && list.length > 0) {
        // Pick the most recent active or first conversation
        const active = list.find((c) => ["open", "in_review", "waiting_tenant"].includes(c.status)) || list[0];
        setSelectedConvId(active.id || active._id);
      }
    } catch (err) {
      console.error("Failed to load tenant conversations:", err);
    } finally {
      setIsLoadingList(false);
    }
  }, [selectedConvId, onUnreadCountChange]);

  useEffect(() => {
    loadConversations(initialConversationId);
  }, [initialConversationId]);

  // Load messages for selected conversation
  const loadMessages = useCallback(async (convId) => {
    if (!convId) {
      setMessages([]);
      return;
    }
    try {
      setIsLoadingMessages(true);
      const res = await chatApi.getConversationMessages(convId);
      setMessages(res.messages || []);
    } catch (err) {
      console.error("Failed to load conversation messages:", err);
      setErrorMsg("Unable to load chat messages.");
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId);
    }
  }, [selectedConvId, loadMessages]);

  // Active selected conversation object
  const activeConversation = useMemo(() => {
    return conversations.find((c) => (c.id || c._id) === selectedConvId) || null;
  }, [conversations, selectedConvId]);

  // Scroll to bottom when messages change
  const scrollToBottom = (behavior = "smooth") => {
    messageEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom("auto");
  }, [messages, isTypingAdmin]);

  // Socket real-time listeners
  useChatSocket({
    onMessageNew: (newMsg, convId) => {
      if (convId === selectedConvId || String(newMsg?.conversationId) === String(selectedConvId)) {
        setMessages((prev) => {
          const exists = prev.some((m) => (m.id || m._id) === (newMsg.id || newMsg._id));
          if (exists) return prev;
          return [...prev, newMsg];
        });
      }
      // Refresh list to update unread counts and lastMessage
      loadConversations();
    },
    onConversationUpdated: (updatedConv) => {
      setConversations((prev) =>
        prev.map((c) => ((c.id || c._id) === (updatedConv.id || updatedConv._id) ? updatedConv : c))
      );
    },
    onTyping: (payload) => {
      if (
        (payload?.conversationId === selectedConvId) &&
        (payload?.senderRole === "branch_admin" || payload?.senderRole === "owner")
      ) {
        setIsTypingAdmin(true);
        if (typingAdminTimer) clearTimeout(typingAdminTimer);
        const timer = setTimeout(() => setIsTypingAdmin(false), 3000);
        setTypingAdminTimer(timer);
      }
    },
  });

  // Handle send message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if ((!text && stagedFiles.length === 0) || isSending || !selectedConvId) return;

    try {
      setIsSending(true);
      setErrorMsg("");

      // Upload attachments first if any
      const uploadedAttachments = [];
      for (const item of stagedFiles) {
        const res = await chatApi.uploadTenantAttachment(selectedConvId, item.file);
        if (res?.attachment) {
          uploadedAttachments.push(res.attachment);
        }
      }

      const res = await chatApi.sendTenantMessage(selectedConvId, text, uploadedAttachments);
      if (res?.message) {
        setMessages((prev) => [...prev, res.message]);
      }

      setInputText("");
      setStagedFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      // Update conversation in list
      if (res?.conversation) {
        setConversations((prev) =>
          prev.map((c) => ((c.id || c._id) === selectedConvId ? res.conversation : c))
        );
      }
    } catch (err) {
      console.error("Failed to send tenant message:", err);
      setErrorMsg(err?.message || "Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Handle typing signal
  const handleTextChange = (e) => {
    setInputText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
    if (selectedConvId) {
      chatApi.broadcastTyping(selectedConvId);
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validNew = [];
    for (const file of files) {
      const validation = validateFile(file, {
        maxSizeBytes: 5 * 1024 * 1024,
        allowedTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/heic",
          "image/heif",
          "application/pdf",
        ],
      });

      if (!validation.isValid) {
        setErrorMsg(validation.error || "File must be JPEG, PNG, WebP, or PDF under 5MB.");
        continue;
      }

      validNew.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    }

    setStagedFiles((prev) => [...prev, ...validNew].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeStagedFile = (id) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Handle resolution confirmation
  const handleConfirmResolution = async (resolved) => {
    if (!selectedConvId || isResolving) return;
    try {
      setIsResolving(true);
      setErrorMsg("");
      const res = await chatApi.confirmTenantResolution(selectedConvId, resolved);
      if (res?.conversation) {
        setConversations((prev) =>
          prev.map((c) => ((c.id || c._id) === selectedConvId ? res.conversation : c))
        );
      }
      await loadMessages(selectedConvId);
    } catch (err) {
      console.error("Failed to update resolution:", err);
      setErrorMsg(err?.message || "Failed to update resolution.");
    } finally {
      setIsResolving(false);
    }
  };

  // Handle reopen
  const handleReopen = async () => {
    if (!selectedConvId || isResolving) return;
    try {
      setIsResolving(true);
      const res = await chatApi.reopenTenantConversation(selectedConvId, "Tenant reopened the conversation.");
      if (res?.conversation) {
        setConversations((prev) =>
          prev.map((c) => ((c.id || c._id) === selectedConvId ? res.conversation : c))
        );
      }
      await loadMessages(selectedConvId);
    } catch (err) {
      console.error("Failed to reopen conversation:", err);
    } finally {
      setIsResolving(false);
    }
  };

  const statusConfig = STATUS_CONFIG[activeConversation?.status] || STATUS_CONFIG.open;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      {/* Ticket Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
              {activeConversation?.ticketId || (selectedConvId ? `TICKET #${String(selectedConvId).slice(-6).toUpperCase()}` : "Support Chat")}
            </span>
            {activeConversation && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300">
                <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
                {statusConfig.label}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[280px]">
            {activeConversation?.assignedAdminName ? `Assigned to: ${activeConversation.assignedAdminName}` : "Awaiting branch staff triage"}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {conversations.length > 1 && (
            <select
              value={selectedConvId || ""}
              onChange={(e) => setSelectedConvId(e.target.value)}
              className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 focus:outline-none"
              title="Switch ticket"
            >
              {conversations.map((c) => (
                <option key={c.id || c._id} value={c.id || c._id}>
                  {c.ticketId || String(c.id || c._id).slice(-6)} ({c.status})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={onOpenEscalateModal}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Create new support request"
            aria-label="New ticket"
          >
            <PlusCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Resolution Confirmation Banner (When status is waiting_tenant) */}
      {activeConversation?.status === "waiting_tenant" && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 font-medium">
            <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Staff has replied. Has your concern been resolved?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleConfirmResolution(true)}
              disabled={isResolving}
              className="px-3 py-1 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer"
            >
              Yes, Resolved
            </button>
            <button
              type="button"
              onClick={() => handleConfirmResolution(false)}
              disabled={isResolving}
              className="px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Still Need Help
            </button>
          </div>
        </div>
      )}

      {/* Resolved / Closed Info Banner */}
      {["resolved", "closed"].includes(activeConversation?.status) && (
        <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between shrink-0">
          <span>This conversation is {activeConversation.status}.</span>
          <button
            type="button"
            onClick={handleReopen}
            disabled={isResolving}
            className="text-xs font-semibold text-slate-900 dark:text-slate-100 underline hover:no-underline cursor-pointer"
          >
            Reopen Ticket
          </button>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {isLoadingMessages ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 space-y-2">
            <LoaderCircle className="w-5 h-5 animate-spin" />
            <span className="text-xs">Loading conversation history...</span>
          </div>
        ) : !selectedConvId || conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500 dark:text-slate-400">
            <MessageSquare className="w-10 h-10 mb-2 opacity-40 text-slate-400" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
              No Active Support Tickets
            </h4>
            <p className="text-xs max-w-xs mb-4">
              Need assistance from your local branch front desk? Submit a support inquiry or chat with our AI Assistant.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onOpenEscalateModal}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Contact Branch Admin
              </button>
              <button
                type="button"
                onClick={onSwitchToAssistant}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Ask AI Assistant
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No messages in this ticket yet.
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderRole === "tenant";
            const isSystem = msg.senderRole === "system";
            const isAiEscalation = msg.message?.startsWith("[AI Escalation Summary]");

            if (isSystem) {
              return (
                <div key={msg.id || msg._id || idx} className="text-center my-2">
                  <span className="inline-block px-3 py-1 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full">
                    {msg.message}
                  </span>
                </div>
              );
            }

            if (isAiEscalation) {
              return (
                <div
                  key={msg.id || msg._id || idx}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-1.5"
                >
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[10px]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>AI Escalation Overview</span>
                  </div>
                  <div className="whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-300 leading-relaxed">
                    {msg.message}
                  </div>
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                    Forwarded at {formatShortTime(msg.createdAt)}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id || msg._id || idx}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {isMe ? "You" : msg.senderName || "Branch Admin"}
                  </span>
                  <span>•</span>
                  <span>{formatShortTime(msg.createdAt)}</span>
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs ${
                    isMe
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-tr-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>

                  {/* Attachments */}
                  {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-1.5 pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                      {msg.attachments.map((att, aIdx) => (
                        <ProtectedChatAttachment
                          key={att.attachmentId || att.id || aIdx}
                          attachment={att}
                          onOpenImage={(src) => setEnlargedImage(src)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {isTypingAdmin && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 px-1 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-100" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-200" />
            <span className="italic">Admin is typing...</span>
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      {/* Staged Attachments Preview */}
      {stagedFiles.length > 0 && (
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 shrink-0">
          {stagedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate max-w-[120px]">{file.name}</span>
              <button
                type="button"
                onClick={() => removeStagedFile(file.id)}
                className="text-slate-400 hover:text-rose-500 ml-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error Notice */}
      {errorMsg && (
        <div className="px-4 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg("")} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Message Composer */}
      {selectedConvId && (
        <form
          onSubmit={handleSendMessage}
          className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0"
        >
          <div className="relative flex items-end gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-slate-900 dark:focus-within:ring-slate-400 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              maxLength={1000}
              onChange={handleTextChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                ["resolved", "closed"].includes(activeConversation?.status)
                  ? "Type to send reply and reopen ticket..."
                  : "Type a message to Branch Admin..."
              }
              disabled={isSending}
              className="flex-1 max-h-28 bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none resize-none px-1.5 py-1"
            />

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || stagedFiles.length >= 5}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 cursor-pointer"
              title="Attach photo or document (max 5MB)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              type="submit"
              disabled={(!inputText.trim() && stagedFiles.length === 0) || isSending}
              className="p-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Send message"
            >
              {isSending ? (
                <LoaderCircle className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between px-1 mt-1.5 text-[10px] text-slate-400">
            <span>Press Enter to send, Shift+Enter for newline</span>
            <span>{inputText.length}/1000</span>
          </div>
        </form>
      )}

      {/* Image Modal Preview */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh]">
            <img
              src={enlargedImage}
              alt="Attachment Preview"
              className="max-w-full max-h-[85vh] rounded-xl object-contain"
            />
            <button
              type="button"
              onClick={() => setEnlargedImage(null)}
              className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
