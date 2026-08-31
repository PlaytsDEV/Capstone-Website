import { useState } from "react";
import { ArrowRightLeft, CalendarClock, X } from "lucide-react";
import {
  useCancelTenantTransferRequest,
  useCreateTenantTransferRequest,
  useTenantTransferPreferences,
  useTenantTransferLifecycle,
} from "../../../../shared/hooks/queries/useTenantTransfers.js";
import { showNotification } from "../../../../shared/utils/notification.js";
import "./room-transfer-request.css";

const initialForm = {
  preferredRoomType: "",
  preferredRoomId: "",
  preferredTransferDate: "",
  reason: "",
  note: "",
};

const localDateInputValue = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

const formatScheduledDate = (transfer) => {
  if (!transfer?.effectiveTransferDate) return null;
  const date = new Date(transfer.effectiveTransferDate);
  if (Number.isNaN(date.getTime())) return null;
  const minutes = Number(transfer.effectiveTransferTimeMinutes ?? 9 * 60);
  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(date);
  const clock = new Date(Date.UTC(2020, 0, 1, Math.floor(minutes / 60), minutes % 60));
  const timeLabel = new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(clock);
  return `${dateLabel} · ${timeLabel}`;
};

export default function RoomTransferRequestPanel({ hasCurrentStay, currentStay = null }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const {
    data: lifecycle,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useTenantTransferLifecycle(hasCurrentStay);
  const createRequest = useCreateTenantTransferRequest();
  const cancelRequest = useCancelTenantTransferRequest();
  const { data: preferenceData, isError: preferencesError } = useTenantTransferPreferences(
    open && hasCurrentStay,
  );
  const rooms = (Array.isArray(preferenceData) ? preferenceData : preferenceData?.rooms || []).filter(
    (room) => room.preferenceSelectable !== false && room.roomType === form.preferredRoomType,
  );
  const status = lifecycle?.status || null;
  const request = lifecycle?.request || null;
  const scheduledTransfer = lifecycle?.scheduledRoomTransfer || null;
  const scheduledLabel = formatScheduledDate(scheduledTransfer);
  const canStartRequest = hasCurrentStay && !["pending", "scheduled"].includes(status);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.preferredRoomType || !form.reason.trim()) {
      showNotification("Select a preferred room type and enter a reason.", "warning");
      return;
    }
    try {
      await createRequest.mutateAsync({
        preferredRoomType: form.preferredRoomType,
        preferredRoomId: form.preferredRoomId || null,
        preferredTransferDate: form.preferredTransferDate || null,
        reason: form.reason.trim(),
        note: form.note.trim() || null,
      });
      setForm(initialForm);
      setOpen(false);
      showNotification("Room transfer request submitted.", "success");
    } catch (error) {
      showNotification(error?.message || "Could not submit the room transfer request.", "error");
    }
  };

  const cancelPending = async () => {
    if (!request?.id) return;
    try {
      await cancelRequest.mutateAsync(request.id);
      showNotification("Room transfer request cancelled.", "success");
    } catch (error) {
      showNotification(error?.message || "Could not cancel the request.", "error");
    }
  };

  if (!hasCurrentStay) return null;
  if (isLoading) {
    return <section className="tenant-transfer-panel" aria-label="Room Transfer"><p>Loading room transfer status...</p></section>;
  }
  if (isError) {
    return (
      <section className="tenant-transfer-panel" aria-label="Room Transfer">
        <div className="tenant-transfer-card">
          <div className="tenant-transfer-card__body">
            <strong>Room transfer status unavailable</strong>
            <span className="tenant-transfer-card__guidance">We could not confirm whether you have an active request.</span>
          </div>
          <button type="button" className="tenant-transfer-card__action" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Retrying..." : "Retry"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="tenant-transfer-panel" aria-label="Room Transfer">
      {status ? (
        <div className={`tenant-transfer-card tenant-transfer-card--${status}`}>
          <div className="tenant-transfer-card__icon"><ArrowRightLeft size={18} /></div>
          <div className="tenant-transfer-card__body">
            <span className="tenant-transfer-card__eyebrow">Room Transfer</span>
            <strong>{lifecycle.statusLabel}</strong>
            {status === "scheduled" && scheduledLabel ? (
              <span className="tenant-transfer-card__detail"><CalendarClock size={14} /> {scheduledLabel}</span>
            ) : null}
            {status === "declined" && request?.declineReason ? (
              <span className="tenant-transfer-card__detail">{request.declineReason}</span>
            ) : null}
            {status === "scheduled" ? (
              <span className="tenant-transfer-card__guidance">Please coordinate with the Administration Office for changes to a scheduled room transfer.</span>
            ) : null}
          </div>
          {request?.canCancel ? (
            <button type="button" className="tenant-transfer-card__action" onClick={cancelPending} disabled={cancelRequest.isPending}>Cancel request</button>
          ) : canStartRequest ? (
            <button type="button" className="tenant-transfer-card__action" onClick={() => setOpen(true)}>Request another</button>
          ) : null}
        </div>
      ) : (
        <button type="button" className="tenant-transfer-request-button" onClick={() => setOpen(true)}>
          <ArrowRightLeft size={17} /> Request Room Transfer
        </button>
      )}

      {open ? (
        <div className="tenant-transfer-modal__overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <form className="tenant-transfer-modal" onSubmit={submit} aria-label="Request Room Transfer">
            <div className="tenant-transfer-modal__header">
              <div><h3>Request Room Transfer</h3><p>Tell the Administration team what you prefer.</p></div>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            <label>Preferred room type<span>*</span>
              <select value={form.preferredRoomType} onChange={(event) => setForm((value) => ({ ...value, preferredRoomType: event.target.value, preferredRoomId: "" }))} required>
                <option value="">Select a room type</option>
                <option value="private">Private</option>
                <option value="double-sharing">Double Sharing</option>
                <option value="quadruple-sharing">Quadruple Sharing</option>
              </select>
            </label>
            <label>Specific room <small>(optional)</small>
              <select value={form.preferredRoomId} onChange={(event) => setForm((value) => ({ ...value, preferredRoomId: event.target.value }))} disabled={!form.preferredRoomType}>
                <option value="">No specific room</option>
                {rooms.map((room) => <option key={room.roomId} value={room.roomId}>{room.name || `Room ${room.roomNumber || ""}`}</option>)}
              </select>
            </label>
            {preferencesError ? <p className="tenant-transfer-modal__notice">Specific rooms are temporarily unavailable. You can still request by room type.</p> : null}
            <label>Preferred transfer date
              <input type="date" min={localDateInputValue()} value={form.preferredTransferDate} onChange={(event) => setForm((value) => ({ ...value, preferredTransferDate: event.target.value }))} />
            </label>
            <label>Reason<span>*</span>
              <textarea rows={3} maxLength={500} required value={form.reason} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))} />
            </label>
            <label>Note <small>(optional)</small>
              <textarea rows={2} maxLength={1000} value={form.note} onChange={(event) => setForm((value) => ({ ...value, note: event.target.value }))} />
            </label>
            <p className="tenant-transfer-modal__notice">Room preference and transfer date are subject to Admin confirmation.</p>
            <div className="tenant-transfer-modal__footer">
              <button type="button" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" disabled={createRequest.isPending}>{createRequest.isPending ? "Submitting…" : "Submit request"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
