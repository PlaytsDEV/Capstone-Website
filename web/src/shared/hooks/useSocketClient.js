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
import { showNotification } from "../utils/notification";
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

  useEffect(() => {
    const identity = user?.id || user?._id
      ? `${user?.role || "unknown"}:${user?.id || user?._id}`
      : null;

    if (activeIdentityRef.current !== identity) {
      clearNotifications();
      activeIdentityRef.current = identity;
    }
  }, [user?.id, user?._id, user?.role, clearNotifications]);

  useEffect(() => {
    if (!user?.id || !user?.role) return undefined;
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

          const toastMessage = notification.message || notification.title || "New notification";
          showNotification(toastMessage, toastType, 4500);
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

        if (
          entityType === "reservation" ||
          /^(reservation_|visit_|grace_period_|contract_|move_out)/i.test(notificationType)
        ) {
          qc.invalidateQueries({ queryKey: ["reservations"] });
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
          qc.invalidateQueries({ queryKey: ["tenant-workspace"] });
        }

        if (
          entityType === "maintenance" ||
          /^(maintenance_|sla_)/i.test(notificationType)
        ) {
          qc.invalidateQueries({ queryKey: ["maintenance"] });
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

      socket.on("payment:updated", (data) => {
        if (data?.reservationId) {
          qc.invalidateQueries({ queryKey: ["reservations", data.reservationId] });
        }
        qc.invalidateQueries({ queryKey: ["reservations"] });
        qc.invalidateQueries({ queryKey: ["tenant-workspace"] });
      });

      socket.on("reservation:updated", (data) => {
        if (data?.reservationId) {
          qc.invalidateQueries({ queryKey: ["reservations", data.reservationId] });
        }
        qc.invalidateQueries({ queryKey: ["reservations"] });
        qc.invalidateQueries({ queryKey: ["tenant-workspace"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      });

      socket.on("ticket:updated", () => {
        qc.invalidateQueries({ queryKey: ["maintenance"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
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
  }, [user?.id, user?.role, addNotification, qc, setConnected]);

  return socketRef.current;
}
