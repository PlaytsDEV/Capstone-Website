/**
 * SOCKET CLIENT HOOK
 *
 * Manages the Socket.IO client connection lifecycle.
 * Auto-connects when user is authenticated, disconnects on logout, and pushes
 * real-time notifications into the Zustand store.
 */

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import useNotificationStore from "../stores/notificationStore";
import { useAuth } from "./useAuth";
import { SOCKET_BASE_URL } from "../api/baseUrl";
import {
  SOCKET_CLIENT_OPTIONS,
  describeSocketTarget,
} from "../api/socketConfig";
import { getFreshToken } from "../api/httpClient";
import { getDeviceId, getSessionId } from "../api/authSession";
import { showNotification, cleanNotificationMessage } from "../utils/notification";
import {
  getNotificationQueryScope,
  isNotificationVisibleForUser,
} from "../utils/notificationVisibility";
import { notificationQueryKeys } from "./queries/useNotifications";

export default function useSocketClient() {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const lastSocketErrorRef = useRef("");
  const qc = useQueryClient();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const setConnected = useNotificationStore((s) => s.setConnected);
  const clearNotifications = useNotificationStore((s) => s.clear);
  const activeIdentityRef = useRef(null);
  const hasLoggedConnectionRef = useRef(false);
  const hasConnectedOnceRef = useRef(false);

  useEffect(() => {
    const identity = user?.id || user?._id
      ? `${user?.role || "unknown"}:${user?.id || user?._id}`
      : null;

    if (activeIdentityRef.current !== identity) {
      clearNotifications();
      activeIdentityRef.current = identity;
      hasConnectedOnceRef.current = false;
    }
  }, [user?.id, user?._id, user?.role, clearNotifications]);

  useEffect(() => {
    const currentUserId = user?.id || user?._id;
    if (!currentUserId || !user?.role) return undefined;
    if (socketRef.current?.connected) return undefined;

    let cancelled = false;

    async function connect() {
      const token = await getFreshToken();
      if (cancelled || !token || socketRef.current?.connected) return;

      const socket = io(SOCKET_BASE_URL, {
        auth: { token, deviceId: getDeviceId(), sessionId: getSessionId() },
        ...SOCKET_CLIENT_OPTIONS,
      });

      socket.on("connect", () => {
        lastSocketErrorRef.current = "";
        setConnected(true);
        if (hasConnectedOnceRef.current) {
          qc.invalidateQueries({ queryKey: ["tenant", "roomTransfer"] });
          qc.refetchQueries({ queryKey: ["tenant", "roomTransfer"], type: "active" });
        }
        hasConnectedOnceRef.current = true;
        const transport = socket.io.engine?.transport?.name || "unknown";
        if (!hasLoggedConnectionRef.current) {
          hasLoggedConnectionRef.current = true;
          console.info(`[socket] Connected to real-time server (${transport}).`);
        }
        socket.io.engine?.once("upgrade", (upgradedTransport) => {
          console.info(`[socket] Real-time transport upgraded to ${upgradedTransport.name}.`);
        });
      });

      socket.on("disconnect", (reason) => {
        setConnected(false);
        if (reason !== "io client disconnect") {
          console.info(`[socket] Disconnected (${reason || "unknown reason"}). HTTP updates remain active.`);
        }
      });

      socket.on("connect_error", (error) => {
        setConnected(false);
        const message = error?.message || "connection failed";
        if (lastSocketErrorRef.current !== message) {
          lastSocketErrorRef.current = message;
          console.warn(
            `[socket] Real-time connection unavailable (${message}). Target: ${describeSocketTarget()}. Continuing with normal HTTP updates.`,
          );
        }
      });

      socket.on("reconnect_failed", () => {
        setConnected(false);
        console.warn("[socket] Real-time reconnect attempts exhausted. HTTP data loading is unaffected.");
      });

      socket.on("notification:new", (notification) => {
        if (!isNotificationVisibleForUser(notification, user)) {
          return;
        }
        addNotification(notification);
        if (!notification?.isRead) {
          const typeLower = `${notification.type || ""} ${notification.title || ""}`.toLowerCase();
          const toastType =
            /completed|approved|verified|success|paid|confirmed/i.test(typeLower)
              ? "success"
              : /rejected|cancelled|failed|error|no_show|missed/i.test(typeLower)
              ? "error"
              : /warning|overdue|deadline|expired/i.test(typeLower)
              ? "warning"
              : "info";

          let rawMessage = notification.message || notification.title || "New notification";
          let toastMessage = cleanNotificationMessage(String(rawMessage));

          if (!toastMessage || toastMessage.length < 5) {
            toastMessage = notification.title || "Notification received";
          } else if (notification.title && notification.message) {
            const firstLine = toastMessage.split("\n")[0].trim();
            const titleLower = String(notification.title).toLowerCase().trim();
            const firstLineLower = firstLine.toLowerCase();

            const isRedundant =
              firstLineLower.includes(titleLower) ||
              (titleLower.includes("approved") && firstLineLower.includes("approved")) ||
              (titleLower.includes("confirmed") && firstLineLower.includes("confirmed")) ||
              (titleLower.includes("cancell") && firstLineLower.includes("cancell")) ||
              (titleLower.includes("payment") && firstLineLower.includes("payment")) ||
              (titleLower.includes("revision") && firstLineLower.includes("revision")) ||
              (titleLower.includes("reject") && firstLineLower.includes("reject")) ||
              (titleLower.includes("visit") && firstLineLower.includes("visit")) ||
              (titleLower.includes("application") && firstLineLower.includes("application")) ||
              (titleLower.includes("maintenance") && firstLineLower.includes("maintenance"));

            if (!isRedundant && titleLower === "announcement") {
              toastMessage = `${notification.title}: ${firstLine}`;
            } else {
              toastMessage = firstLine;
            }
          }
          const notifTypeLower = String(notification?.type || "").toLowerCase();
          const lastSettled = Number(sessionStorage.getItem("lilycrest_last_settled_payment_time") || 0);
          const isRecentPaymentSettlement =
            (notifTypeLower === "payment_approved" || notifTypeLower === "payment_confirmed") &&
            Date.now() - lastSettled < 4000;

          if (!isRecentPaymentSettlement) {
            showNotification(toastMessage, toastType, 3500);
          }
          const scope = getNotificationQueryScope(user);
          qc.setQueryData(notificationQueryKeys.unread(scope), (current) => ({
            unreadCount: (current?.unreadCount ?? 0) + 1,
          }));
        }
        qc.invalidateQueries({
          queryKey: notificationQueryKeys.scope(getNotificationQueryScope(user)),
        });

        // Real-time page data refetching for active UI screens
        const entityType = String(notification?.entityType || "").toLowerCase();
        const notificationType = String(notification?.type || "").toLowerCase();
        const notificationTitle = String(notification?.title || "").toLowerCase();

        if (notificationTitle.includes("room transfer")) {
          qc.invalidateQueries({ queryKey: ["tenant", "roomTransfer"] });
          qc.refetchQueries({ queryKey: ["tenant", "roomTransfer"], type: "active" });
        }

        if (
          entityType === "reservation" ||
          entityType === "contract" ||
          /^(reservation_|visit_|grace_period_|contract_|move_out)/i.test(notificationType)
        ) {
          qc.invalidateQueries({ queryKey: ["reservations"] });
          qc.refetchQueries({ queryKey: ["reservations"], type: "active" });
          qc.invalidateQueries({ queryKey: ["contracts"] });
          qc.invalidateQueries({ queryKey: ["contracts", "myCurrentContract"] });
          qc.refetchQueries({ queryKey: ["contracts", "myCurrentContract"], type: "active" });
          qc.invalidateQueries({ queryKey: ["tenant-workspace"] });
          qc.invalidateQueries({ queryKey: ["rooms"] });
          qc.invalidateQueries({ queryKey: ["users"] });
          qc.invalidateQueries({ queryKey: ["auth"] });
        }

        if (
          entityType === "bill" ||
          /^(payment_|bill_|penalty_|utility_)/i.test(notificationType)
        ) {
          qc.invalidateQueries({ queryKey: ["billing"] });
          qc.invalidateQueries({ queryKey: ["financial"] });
          qc.invalidateQueries({ queryKey: ["electricity"] });
          qc.invalidateQueries({ queryKey: ["water"] });
          qc.invalidateQueries({ queryKey: ["reservations"] });
          qc.invalidateQueries({ queryKey: ["contracts"] });
          qc.invalidateQueries({ queryKey: ["contracts", "myCurrentContract"] });
          qc.invalidateQueries({ queryKey: ["tenant-workspace"] });
        }

        if (
          entityType === "maintenance" ||
          /^(maintenance_|sla_)/i.test(notificationType)
        ) {
          qc.invalidateQueries({ queryKey: ["maintenance"] });
          qc.refetchQueries({ queryKey: ["maintenance"], type: "active" });
        }

        if (
          entityType === "inquiry" ||
          entityType === "chat" ||
          /^(inquiry_|chat_)/i.test(notificationType)
        ) {
          qc.invalidateQueries({ queryKey: ["inquiries"] });
        }

        if (
          entityType === "user" ||
          /^(account_)/i.test(notificationType)
        ) {
          qc.invalidateQueries({ queryKey: ["users"] });
          qc.invalidateQueries({ queryKey: ["auth"] });
        }

        if (notificationType === "announcement") {
          qc.invalidateQueries({ queryKey: ["announcements"] });
        }

        // Always invalidate dashboard cache to keep summary cards & badges in sync
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      });

      socket.on("contract:updated", (data) => {
        if (data?.contractId) {
          qc.invalidateQueries({ queryKey: ["contracts", data.contractId] });
        }
        qc.invalidateQueries({ queryKey: ["contracts"] });
        qc.invalidateQueries({ queryKey: ["contracts", "myCurrentContract"] });
        qc.refetchQueries({ queryKey: ["contracts", "myCurrentContract"], type: "active" });
        qc.invalidateQueries({ queryKey: ["reservations"] });
        qc.invalidateQueries({ queryKey: ["tenant-workspace"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("lilycrest:contract-updated", { detail: data }));
        }
      });

      socket.on("payment:updated", (data) => {
        if (data?.reservationId) {
          qc.invalidateQueries({ queryKey: ["reservations", data.reservationId] });
        }
        qc.invalidateQueries({ queryKey: ["reservations"] });
        qc.invalidateQueries({ queryKey: ["contracts"] });
        qc.invalidateQueries({ queryKey: ["contracts", "myCurrentContract"] });
        qc.refetchQueries({ queryKey: ["contracts", "myCurrentContract"], type: "active" });
        qc.invalidateQueries({ queryKey: ["tenant-workspace"] });
        qc.invalidateQueries({ queryKey: ["reservation-payments"] });
        qc.invalidateQueries({ queryKey: ["billing"] });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("lilycrest:payment-updated", { detail: data }));
        }
      });

      socket.on("reservation:updated", (data) => {
        if (data?.reservationId) {
          qc.invalidateQueries({ queryKey: ["reservations", data.reservationId] });
        }
        qc.invalidateQueries({ queryKey: ["reservations"] });
        qc.refetchQueries({ queryKey: ["reservations"], type: "active" });
        qc.invalidateQueries({ queryKey: ["contracts"] });
        qc.invalidateQueries({ queryKey: ["contracts", "myCurrentContract"] });
        qc.refetchQueries({ queryKey: ["contracts", "myCurrentContract"], type: "active" });
        qc.invalidateQueries({ queryKey: ["tenant-workspace"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["reservation-payments"] });
        qc.invalidateQueries({ queryKey: ["billing"] });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("lilycrest:reservation-updated", { detail: data }));
        }
      });

      socket.on("visit:updated", (data) => {
        if (data?.reservationId) {
          qc.invalidateQueries({ queryKey: ["reservations", data.reservationId] });
        }
        qc.invalidateQueries({ queryKey: ["reservations"] });
        qc.refetchQueries({ queryKey: ["reservations"], type: "active" });
        qc.invalidateQueries({ queryKey: ["tenant-workspace"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["users"] });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("lilycrest:visit-updated", { detail: data }));
          window.dispatchEvent(new CustomEvent("lilycrest:reservation-updated", { detail: data }));
        }
      });

      const handleTicketSync = (data) => {
        if (!data) return;
        const targetIds = Array.from(
          new Set(
            [
              data.requestId,
              data.request_id,
              data.ticketId,
              data.ticketNumber,
              data.request?._id,
              data.request?.request_id,
              data.request?.ticketNumber,
            ].filter(Boolean),
          ),
        );

        targetIds.forEach((tId) => {
          qc.invalidateQueries({ queryKey: ["maintenance", "detail", tId] });
        });

        // Direct optimistic query cache sync if request/conversation is provided
        if (data.request || data.conversation || data.message) {
          targetIds.forEach((tId) => {
            qc.setQueriesData({ queryKey: ["maintenance", "detail", tId] }, (old) => {
              if (!old) return old;
              const existingReq = old.data?.request || old.request || old;
              const updatedReq = {
                ...existingReq,
                ...(data.request || {}),
                conversation: data.conversation || data.request?.conversation || existingReq.conversation,
                status: data.status || data.request?.status || existingReq.status,
                updated_at: data.updated_at || data.request?.updated_at || existingReq.updated_at,
              };
              if (old.data?.request) {
                return { ...old, data: { ...old.data, request: updatedReq } };
              }
              if (old.request) {
                return { ...old, request: updatedReq };
              }
              return updatedReq;
            });
          });

          // Sync in list queries (both tenant and admin)
          qc.setQueriesData({ queryKey: ["maintenance"] }, (old) => {
            if (!old || !Array.isArray(old.requests)) return old;
            return {
              ...old,
              requests: old.requests.map((r) => {
                const match = targetIds.some(
                  (id) => String(r.request_id || r.id || r._id || r.ticketNumber) === String(id),
                );
                if (!match) return r;
                return {
                  ...r,
                  ...(data.request || {}),
                  conversation: data.conversation || data.request?.conversation || r.conversation,
                  status: data.status || data.request?.status || r.status,
                  updated_at: data.updated_at || data.request?.updated_at || r.updated_at,
                };
              }),
            };
          });
        }

        qc.invalidateQueries({ queryKey: ["maintenance"] });
        qc.refetchQueries({ queryKey: ["maintenance"], type: "active" });
        qc.invalidateQueries({ queryKey: ["dashboard"] });

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("lilycrest:maintenance-updated", { detail: data }));
          window.dispatchEvent(new CustomEvent("lilycrest:maintenance-message", { detail: data }));
        }
      };

      socket.on("ticket:updated", (data) => {
        handleTicketSync(data);
      });

      socket.on("ticket:message", (data) => {
        handleTicketSync(data);

        // Toast notification if received from opposite party
        const userRole = String(user?.role || "").toLowerCase();
        const isAdminUser = ["branch_admin", "owner", "super_admin", "admin"].includes(userRole);
        const isFromOpposite =
          (isAdminUser && data?.senderSide === "tenant") ||
          (!isAdminUser && (data?.senderSide === "admin" || data?.senderSide === "staff"));

        if (isFromOpposite) {
          const senderLabel = data?.senderName || (data?.senderSide === "admin" ? "Dormitory Admin" : "Tenant");
          const ticketLabel = data?.request_id || data?.ticketId || (data?.requestId ? `#${data.requestId.slice(-6)}` : "Maintenance Ticket");
          const rawMsg = data?.message?.message || "";
          const hasAtt = Array.isArray(data?.message?.attachments) && data.message.attachments.length > 0;
          const previewText = rawMsg || (hasAtt ? "Sent an attachment" : "Sent a reply");
          const truncated = previewText.length > 75 ? `${previewText.slice(0, 75)}...` : previewText;

          showNotification(
            `New message on #${ticketLabel} from ${senderLabel}: "${truncated}"`,
            "info",
            4500,
          );
        }
      });

      socket.on("ticket:typing", (data) => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("lilycrest:maintenance-typing", { detail: data }));
        }
      });

      socket.on("inquiry:updated", () => {
        qc.invalidateQueries({ queryKey: ["inquiries"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      });

      socket.on("room:updated", (data) => {
        const { roomId, ...patch } = data || {};
        if (roomId && Object.keys(patch).length > 0) {
          qc.setQueriesData({ queryKey: ["rooms"] }, (old) => {
            if (!Array.isArray(old)) return old;
            return old.map((r) =>
              String(r._id) === String(roomId) || String(r.id) === String(roomId)
                ? { ...r, ...patch }
                : r,
            );
          });
        }
        qc.invalidateQueries({ queryKey: ["rooms"] });
      });

      socketRef.current = socket;
    }

    connect().catch(() => setConnected(false));

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user?.id, user?._id, user?.role, addNotification, qc, setConnected]);

  return socketRef.current;
}
