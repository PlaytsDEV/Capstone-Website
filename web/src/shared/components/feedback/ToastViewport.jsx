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

function ToastItem({ notification, onDismiss }) {
 const Icon = TOAST_ICONS[notification.type] || TOAST_ICONS.info;

 useEffect(() => {
 const timer = window.setTimeout(() => {
 onDismiss(notification.id);
 }, notification.duration);

 return () => window.clearTimeout(timer);
 }, [notification.duration, notification.id, onDismiss]);

 return (
 <div
 className={`notification notification-${notification.type || "info"}`}
 role="status"
 aria-live="polite"
 >
 <div className="notification-icon">
 <Icon size={18} />
 </div>
 <div className="notification-message">{notification.message}</div>
 <button
 className="notification-close"
 type="button"
 aria-label="Close notification"
 onClick={() => onDismiss(notification.id)}
 >
 <X size={14} />
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
