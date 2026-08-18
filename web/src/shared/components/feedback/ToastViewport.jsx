import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
 AlertCircle,
 CheckCircle2,
 Info,
 TriangleAlert,
 X,
} from "lucide-react";
import { subscribeNotifications } from "../../utils/notificationBus";

const TOAST_ICONS = {
 success: CheckCircle2,
 error: AlertCircle,
 warning: TriangleAlert,
 info: Info,
};

function getToastDuration(type, explicitDuration) {
  if (typeof explicitDuration === "number" && explicitDuration > 0) {
    return explicitDuration;
  }
  switch (type) {
    case "warning":
      return 5000;
    case "error":
      return 7000;
    case "success":
    case "info":
    default:
      return 3500;
  }
}

function ToastItem({ notification, onDismiss }) {
 const Icon = TOAST_ICONS[notification.type] || TOAST_ICONS.info;
 const duration = getToastDuration(notification.type, notification.duration);

 useEffect(() => {
 const timer = window.setTimeout(() => {
 onDismiss(notification.id);
 }, duration);

 return () => window.clearTimeout(timer);
 }, [duration, notification.id, onDismiss]);

 const messageText = typeof notification.message === "string"
   ? notification.message
   : (notification.message?.message || notification.message?.text || String(notification.message || ""));

 return (
    <div
      className={`notification notification-${notification.type || "info"}`}
      role="status"
      aria-live="polite"
    >
      <div className="notification-icon">
        <Icon size={20} />
      </div>
      <div className="notification-message">{messageText}</div>
      <button
        className="notification-close"
        type="button"
        aria-label="Close notification"
        onClick={() => onDismiss(notification.id)}
      >
        <X size={15} />
      </button>
    </div>
  );
}

export default function ToastViewport() {
 const [mounted, setMounted] = useState(false);
 const [notifications, setNotifications] = useState([]);

 useEffect(() => {
 setMounted(true);
 return () => setMounted(false);
 }, []);

 useEffect(() => {
 return subscribeNotifications((notification) => {
 if (notification.presentation !== "toast") {
 return;
 }

 setNotifications([notification]);
 });
 }, []);

 const dismissNotification = useMemo(
 () => (id) => {
 setNotifications((current) => current.filter((item) => item.id !== id));
 },
 [],
 );

 if (!mounted) {
 return null;
 }

 return createPortal(
 <div
 className="notification-stack"
 aria-live="polite"
 aria-relevant="additions removals"
 >
 {notifications.map((notification) => (
 <ToastItem
 key={notification.id}
 notification={notification}
 onDismiss={dismissNotification}
 />
 ))}
 </div>,
 document.body,
 );
}
