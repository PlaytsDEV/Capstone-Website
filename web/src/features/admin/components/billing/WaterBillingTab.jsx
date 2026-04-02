import { useEffect, useMemo, useState } from "react";
import { Fragment } from "react";
import {
  CheckCircle2, Download, Droplets, Edit3, Plus, Save, X,
  ChevronDown, Trash2, RefreshCw,
} from "lucide-react";
import { useAuth } from "../../../../shared/hooks/useAuth";
import { waterApi } from "../../../../shared/api/waterApi.js";
import {
  useCreateWaterRecord,
  useDeleteWaterRecord,
  useFinalizeWaterRecord,
  useUpdateWaterRecord,
  useWaterRecords,
  useWaterRooms,
} from "../../../../shared/hooks/queries/useWaterBilling";
import { useBusinessSettings } from "../../../../shared/hooks/queries/useSettings";
import ConfirmModal from "../../../../shared/components/ConfirmModal";
import { exportToCSV } from "../../../../shared/utils/exportUtils.js";
import { getRoomLabel } from "../../../../shared/utils/roomLabel.js";
import { fmtCurrency, fmtDate } from "../../utils/formatters";
import useBillingNotifier from "./shared/useBillingNotifier";
import "./WaterBillingTab.css";

/* ─── Helpers ─────────────────────────────── */

const EMPTY_VALUE = "—";

const toInputDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const fmtShortDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

const fmtNumber = (val, digits = 2) =>
  val != null
    ? Number(val).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : EMPTY_VALUE;

const getDefaultCycleEnd = (latestRecord) => {
  if (latestRecord?.cycleEnd) {
    const d = new Date(latestRecord.cycleEnd);
    d.setMonth(d.getMonth() + 1);
    return toInputDate(d);
  }
  const d = new Date();
  if (d.getDate() > 15) d.setMonth(d.getMonth() + 1);
  d.setDate(15);
  d.setHours(0, 0, 0, 0);
  return toInputDate(d);
};

const getCycleStartFromEnd = (cycleEnd) => {
  if (!cycleEnd) return "";
  const end = new Date(cycleEnd);
  if (Number.isNaN(end.getTime())) return "";
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);
  return start;
};

const getCycleRangeText = (cycleStart, cycleEnd) => {
  if (!cycleEnd) return "No cycle";
  const resolvedStart = cycleStart || getCycleStartFromEnd(cycleEnd);
  return `${fmtShortDate(resolvedStart)} – ${fmtShortDate(cycleEnd)}`;
};

const getTodayInput = () => new Date().toISOString().slice(0, 10);

const getRoomBadgeLabel = (room) => {
  if (!room) return "No Data";
  if (room.latestRecord?.status === "draft") return "Draft";
  if (room.latestRecord?.status === "finalized") return "Finalized";
  return "No Data";
};

const WATER_EXPORT_COLUMNS = [
  { key: "roomName", label: "Room" },
  { key: "branch", label: "Branch" },
  { key: "roomType", label: "Room Type" },
  { key: "cycleStart", label: "Cycle Start", formatter: (value) => (value ? fmtDate(value) : "") },
  { key: "cycleEnd", label: "Cycle End", formatter: (value) => (value ? fmtDate(value) : "") },
  { key: "status", label: "Status" },
  { key: "usage", label: "Usage", formatter: (value) => (value !== "" && value != null ? Number(value).toFixed(2) : "") },
  { key: "ratePerUnit", label: "Rate / Unit", formatter: (value) => (value !== "" && value != null ? Number(value).toFixed(2) : "") },
  { key: "computedAmount", label: "Computed", formatter: (value) => (value !== "" && value != null ? Number(value).toFixed(2) : "") },
  { key: "finalAmount", label: "Final", formatter: (value) => (value !== "" && value != null ? Number(value).toFixed(2) : "") },
  { key: "tenantName", label: "Tenant" },
  { key: "tenantShare", label: "Tenant Share", formatter: (value) => (value !== "" && value != null ? Number(value).toFixed(2) : "") },
];

/* ─── Component ─────────────────────────────── */

export default function WaterBillingTab() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const notify = useBillingNotifier();

  // Selection state
  const [branchFilter, setBranchFilter] = useState(isOwner ? "" : user?.branch || "");
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [sidebarSearch, setSidebarSearch] = useState("");

  // Panel state
  const [activePanel, setActivePanel] = useState(null); // "newPeriod" | "enterReading" | null
  const [confirmModal, setConfirmModal] = useState({ open: false, title: "", message: "", onConfirm: null });

  // Form state
  const [periodForm, setPeriodForm] = useState({
    cycleEnd: "", previousReading: "", ratePerUnit: "",
  });
  const [readingForm, setReadingForm] = useState({
    currentReading: "", finalAmount: "", overrideReason: "", notes: "",
  });

  const [isExporting, setIsExporting] = useState(false);

  // Queries
  const { data: businessSettings } = useBusinessSettings(Boolean(user));
  const { data: roomsData, isLoading: roomsLoading } = useWaterRooms(branchFilter);
  const { data: recordsData } = useWaterRecords(selectedRoomId);
  const createRecord = useCreateWaterRecord();
  const deleteRecord = useDeleteWaterRecord();
  const updateRecord = useUpdateWaterRecord();
  const finalizeRecord = useFinalizeWaterRecord();
  const defaultWaterRatePerUnit = businessSettings?.defaultWaterRatePerUnit ?? "";

  // Derived data
  const rooms = useMemo(
    () => (roomsData?.rooms || []).filter((room) => room.isWaterEligible),
    [roomsData],
  );
  const records = recordsData?.records || [];
  const latestFinalizedRecord = records.find((r) => r.status === "finalized") || null;
  const activeDraft = records.find((r) => r.status === "draft") || null;
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || null;

  const filteredRooms = useMemo(() => {
    let list = branchFilter ? rooms.filter((r) => r.branch === branchFilter) : rooms;
    if (sidebarSearch.trim()) {
      const q = sidebarSearch.trim().toLowerCase();
      list = list.filter((r) => getRoomLabel(r, "").toLowerCase().includes(q));
    }
    return list;
  }, [rooms, branchFilter, sidebarSearch]);

  // Auto-select room
  useEffect(() => {
    if (filteredRooms.length === 0) { setSelectedRoomId(null); return; }
    if (!selectedRoomId || !filteredRooms.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId(filteredRooms[0].id);
    }
  }, [filteredRooms, selectedRoomId]);

  // Reset panel when switching rooms
  useEffect(() => {
    setActivePanel(null);
    setSelectedRecordId(null);
  }, [selectedRoomId]);

  // ── Handlers ──

  const closePanel = () => setActivePanel(null);

  const openNewPeriod = () => {
    /* Mirror electricity's "New Billing Period": just start info */
    const prevReading = latestFinalizedRecord?.currentReading ?? "";
    const rate = latestFinalizedRecord?.ratePerUnit ?? defaultWaterRatePerUnit;
    setPeriodForm({
      cycleEnd: getDefaultCycleEnd(latestFinalizedRecord),
      previousReading: prevReading !== "" ? String(prevReading) : "",
      ratePerUnit: rate !== "" && rate != null ? String(rate) : "",
    });
    setActivePanel("newPeriod");
  };

  const openEnterReading = () => {
    /* Mirror electricity's "Enter Final Reading" */
    setReadingForm({
      currentReading: "",
      finalAmount: "",
      overrideReason: "",
      notes: activeDraft?.notes || "",
    });
    setActivePanel("enterReading");
  };

  const handleDeleteDraft = (record) => {
    if (!record?.id) return;
    setConfirmModal({
      open: true,
      title: "Delete Draft Water Period",
      message: "This will remove the active draft water billing period so you can start over. Finalized water history will not be affected.",
      variant: "danger",
      confirmText: "Delete Draft",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        try {
          await deleteRecord.mutateAsync(record.id);
          if (selectedRecordId === record.id) {
            setSelectedRecordId(null);
          }
          closePanel();
          notify.success("Draft water billing period deleted.");
        } catch (err) {
          notify.error(err, "Failed to delete draft water billing period.");
        }
      },
    });
  };

  const handleCreateDraft = async () => {
    if (!periodForm.previousReading && periodForm.previousReading !== 0) {
      return notify.warn("Previous reading is required.");
    }
    if (!periodForm.ratePerUnit || Number(periodForm.ratePerUnit) <= 0) {
      return notify.warn("Water rate is required and must be positive.");
    }
    try {
      await createRecord.mutateAsync({
        roomId: selectedRoomId,
        cycleEnd: periodForm.cycleEnd,
        previousReading: Number(periodForm.previousReading),
        currentReading: Number(periodForm.previousReading), // placeholder, will be updated when entering reading
        ratePerUnit: Number(periodForm.ratePerUnit),
      });
      notify.success("Billing period started. Enter the current reading when available.");
      closePanel();
    } catch (err) {
      notify.error(err, "Failed to start billing period.");
    }
  };

  const handleEnterReadingAndFinalize = async () => {
    if (!readingForm.currentReading && readingForm.currentReading !== 0) {
      return notify.warn("Current meter reading is required.");
    }
    if (!activeDraft) return;
    try {
      // Step 1: Update the draft with the actual current reading
      const payload = {
        recordId: activeDraft.id,
        previousReading: activeDraft.previousReading,
        currentReading: Number(readingForm.currentReading),
        ratePerUnit: activeDraft.ratePerUnit,
        finalAmount: readingForm.finalAmount !== "" ? Number(readingForm.finalAmount) : undefined,
        overrideReason: readingForm.overrideReason,
        notes: readingForm.notes,
      };
      const saved = await updateRecord.mutateAsync(payload);

      // Step 2: Finalize
      const finalized = await finalizeRecord.mutateAsync(saved.record.id);
      const syncReason = finalized?.draftBillSync?.reason;
      if (syncReason === "draft-bills-not-created") {
        notify.success("Water billing finalized. Draft bills were not created for this cycle yet.");
      } else {
        notify.success("Water billing finalized and merged into draft bills.");
      }
      closePanel();
    } catch (err) {
      notify.error(err, "Failed to finalize water billing.");
    }
  };

  const selectAndFocusRecord = (recordId) => {
    if (selectedRecordId === recordId) {
      setSelectedRecordId(null);
      return;
    }
    setSelectedRecordId(recordId);
  };

  const handleExportRows = async () => {
    try {
      setIsExporting(true);
      const response = await waterApi.exportRows({ branch: branchFilter || undefined });
      const rows = response?.rows || [];
      if (!rows.length) { notify.warn("No water billing rows available for export."); return; }
      exportToCSV(rows, WATER_EXPORT_COLUMNS, `water_billing_${branchFilter || "all"}_${getTodayInput()}`);
      notify.success(`Exported ${rows.length} water billing row${rows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      notify.error(error, "Failed to export water billing.");
    } finally { setIsExporting(false); }
  };

  // Computed amount for the "Enter Reading" form
  const previewUsage = useMemo(() => {
    if (!activeDraft || readingForm.currentReading === "") return null;
    const usage = Math.max(Number(readingForm.currentReading) - activeDraft.previousReading, 0);
    const cost = usage * activeDraft.ratePerUnit;
    return { usage, cost };
  }, [activeDraft, readingForm.currentReading]);

  // ── Expanded record detail ──
  const renderRecordDetails = (record) => {
    if (!record || selectedRecordId !== record.id) return null;
    return (
      <div className="wb-period-detail wb-period-detail--inline">
        <div className="wb-period-detail__header">
          <div className="wb-period-detail__heading">
            <span className="wb-period-detail__title">
              {getCycleRangeText(record.cycleStart, record.cycleEnd)}
            </span>
            <span className="wb-period-detail__meta">
              {record.previousReading} → {record.currentReading} units
            </span>
          </div>
          <div className="wb-period-detail__actions">
            <span className={`wb-status-pill wb-status-pill--${record.status}`}>{record.status}</span>
            <button className="wb-btn wb-btn--xs wb-btn--outline" onClick={() => setSelectedRecordId(null)}>
              Hide Details
            </button>
          </div>
        </div>
        <div className="wb-period-detail__body">
          <div className="wb-stats">
            <div className="wb-stat">
              <span className="wb-stat__label">Usage</span>
              <span className="wb-stat__value">{fmtNumber(record.usage)} units</span>
            </div>
            <div className="wb-stat">
              <span className="wb-stat__label">Rate</span>
              <span className="wb-stat__value">{fmtCurrency(record.ratePerUnit)}/unit</span>
            </div>
            <div className="wb-stat">
              <span className="wb-stat__label">Computed</span>
              <span className="wb-stat__value">{fmtCurrency(record.computedAmount)}</span>
            </div>
            <div className="wb-stat">
              <span className="wb-stat__label">Final Amount</span>
              <span className="wb-stat__value">{fmtCurrency(record.finalAmount)}</span>
            </div>
          </div>
          {record.isOverridden && (
            <div className="wb-override-notice">
              <span className="wb-override-notice__label">Override applied</span>
              {record.overrideReason && (
                <span className="wb-override-notice__reason">Reason: {record.overrideReason}</span>
              )}
            </div>
          )}
          {record.tenantShares?.length > 0 && (
            <div className="wb-tenant-shares">
              <div className="wb-tenant-shares__title">Tenant Distribution</div>
              <div className="wb-table-wrap">
                <table className="wb-table wb-table--detail">
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.tenantShares.map((share, i) => (
                      <tr key={share.tenantId || i}>
                        <td>{share.tenantName || "Tenant"}</td>
                        <td><strong>{fmtCurrency(share.shareAmount)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {record.notes && (
            <div className="wb-notes-section">
              <span className="wb-notes-section__label">Notes</span>
              <p className="wb-notes-section__text">{record.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Render ──
  return (
    <>
    <div className="wb-shell">
      {/* Toolbar */}
      <div className="wb-toolbar">
        <div className="wb-toolbar__left">
          <span className="wb-toolbar__eyebrow">Water Billing</span>
          <span className="wb-toolbar__subtitle">
            {rooms.length} eligible room{rooms.length === 1 ? "" : "s"}
            {branchFilter ? ` in ${branchFilter}` : ""} · Private & Shared only
          </span>
        </div>
        <button type="button" className="wb-btn wb-btn--outline wb-btn--xs" onClick={handleExportRows} disabled={isExporting}>
          <Download size={13} /> {isExporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      <div className="wb-layout">
        {/* Sidebar */}
        <aside className="wb-sidebar">
          <div className="wb-sidebar__header">
            <span className="wb-sidebar__title"><Droplets size={13} /> Rooms</span>
            {isOwner && (
              <select
                value={branchFilter}
                onChange={(e) => { setBranchFilter(e.target.value); setSelectedRoomId(null); }}
                className="wb-sidebar__filter"
              >
                <option value="">All</option>
                <option value="gil-puyat">Gil-Puyat</option>
                <option value="guadalupe">Guadalupe</option>
              </select>
            )}
          </div>
          <div className="wb-sidebar__search-wrap">
            <input
              type="text"
              className="wb-sidebar__search"
              placeholder="Search rooms..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              aria-label="Search rooms"
            />
          </div>
          <div className="wb-sidebar__list">
            {roomsLoading ? (
              <div className="wb-skeleton-list">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="wb-skeleton-card" />)}
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="wb-sidebar__empty">
                {sidebarSearch ? "No rooms match your search" : "No eligible rooms found"}
              </div>
            ) : (
              filteredRooms.map((room) => (
                <button
                  key={room.id}
                  className={`wb-room${selectedRoomId === room.id ? " wb-room--active" : ""}`}
                  onClick={() => { setSelectedRoomId(room.id); setActivePanel(null); setSelectedRecordId(null); }}
                >
                  <div className="wb-room__top-row">
                    <span className="wb-room__name">{getRoomLabel(room)}</span>
                    <span
                      className={`wb-room__dot${(room.activeTenantCount || 0) > 0 ? " wb-room__dot--active" : ""}`}
                      title={(room.activeTenantCount || 0) > 0 ? "Has active tenants" : "No tenants"}
                    />
                  </div>
                  <div className="wb-room__bottom-row">
                    <span className={`wb-room__badge wb-room__badge--${room.latestRecord?.status || "empty"}`}>
                      {getRoomBadgeLabel(room)}
                    </span>
                    {room.latestRecord?.finalAmount != null && (
                      <span className="wb-room__amount">{fmtCurrency(room.latestRecord.finalAmount)}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="wb-main">
          {!selectedRoomId ? (
            <div className="wb-empty-state">
              <Droplets size={40} strokeWidth={1.5} />
              <p>Select a room to manage water billing</p>
            </div>
          ) : (
            <div className="wb-content">
              {/* Room Header */}
              <div className="wb-header">
                <div className="wb-header__left">
                  <h2 className="wb-header__title">{getRoomLabel(selectedRoom)}</h2>
                  <span className="wb-header__branch">{selectedRoom?.branch}</span>
                </div>
              </div>

              {/* ━━━ SECTION 1: Active Billing Cycle (mirrors electricity) ━━━ */}
              <section className={`wb-status-banner ${activeDraft ? "wb-status-banner--open" : "wb-status-banner--empty"}`}>
                <div>
                  <div className="wb-status-banner__eyebrow">
                    {activeDraft ? "Active Billing Period" : "No Active Period"}
                  </div>
                  <div className="wb-status-banner__title">
                    {activeDraft
                      ? `Cycle ${getCycleRangeText(activeDraft.cycleStart, activeDraft.cycleEnd)} | Start: ${activeDraft.previousReading} units | Rate: ${fmtCurrency(activeDraft.ratePerUnit)}/unit`
                      : latestFinalizedRecord
                        ? `Last finalized: ${fmtDate(latestFinalizedRecord.cycleEnd)}`
                        : "No water billing period has been created for this room yet."}
                  </div>
                </div>
                <div className="wb-status-banner__actions">
                  {activeDraft ? (
                    <>
                      <button className="wb-btn wb-btn--primary wb-btn--sm" onClick={openEnterReading}>
                        <CheckCircle2 size={13} /> Enter Current Reading
                      </button>
                      <button className="wb-btn wb-btn--ghost wb-btn--sm" onClick={() => handleDeleteDraft(activeDraft)}>
                        <Trash2 size={13} /> Delete Draft
                      </button>
                    </>
                  ) : (
                    <button className="wb-btn wb-btn--primary wb-btn--sm" onClick={openNewPeriod}>
                      <Plus size={13} /> New Billing Period
                    </button>
                  )}
                </div>
              </section>

              {/* New Billing Period panel (mirrors electricity's "New Billing Period") */}
              {activePanel === "newPeriod" && (
                <div className="wb-panel">
                  <div className="wb-panel__header">
                    <span className="wb-panel__title">New Water Billing Period</span>
                    <button className="wb-panel__close" onClick={closePanel}><X size={15} /></button>
                  </div>
                  <div className="wb-panel__body">
                    <p className="wb-panel__hint">Start a new billing cycle. You'll enter the current reading when the cycle ends.</p>
                    <div className="wb-form-grid">
                      <div className="wb-field">
                        <label>Cycle End Date</label>
                        <input type="date" value={periodForm.cycleEnd} onChange={(e) => setPeriodForm((c) => ({ ...c, cycleEnd: e.target.value }))} />
                      </div>
                      <div className="wb-field">
                        <label>Previous Reading (units)</label>
                        <input
                          type="number" min="0" step="0.01"
                          value={periodForm.previousReading}
                          onChange={(e) => setPeriodForm((c) => ({ ...c, previousReading: e.target.value }))}
                          placeholder={latestFinalizedRecord ? `Last: ${latestFinalizedRecord.currentReading}` : "e.g. 500"}
                          autoFocus
                        />
                      </div>
                      <div className="wb-field">
                        <label>Rate (PHP/unit) <span className="wb-required">*</span></label>
                        <input
                          type="number" min="0" step="0.01"
                          value={periodForm.ratePerUnit}
                          onChange={(e) => setPeriodForm((c) => ({ ...c, ratePerUnit: e.target.value }))}
                          placeholder="e.g. 32.50"
                        />
                      </div>
                    </div>
                    <div className="wb-panel__footer">
                      <button className="wb-btn wb-btn--primary wb-btn--sm" onClick={handleCreateDraft} disabled={createRecord.isPending}>
                        {createRecord.isPending ? "Processing..." : "Start Billing Period"}
                      </button>
                      <button className="wb-btn wb-btn--ghost wb-btn--sm" onClick={closePanel}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Enter Current Reading panel (mirrors electricity's "Enter Final Reading") */}
              {activePanel === "enterReading" && activeDraft && (
                <div className="wb-panel wb-panel--finalize">
                  <div className="wb-panel__header">
                    <span className="wb-panel__title">Enter Current Reading</span>
                    <button className="wb-panel__close" onClick={closePanel}><X size={15} /></button>
                  </div>
                  <div className="wb-panel__body">
                    <p className="wb-panel__hint">
                      Cycle {getCycleRangeText(activeDraft.cycleStart, activeDraft.cycleEnd)} | Previous: {activeDraft.previousReading} units | Rate: {fmtCurrency(activeDraft.ratePerUnit)}/unit
                    </p>
                    <div className="wb-form-grid">
                      <div className="wb-field">
                        <label>Current Meter Reading (units)</label>
                        <input
                          type="number" min="0" step="0.01"
                          value={readingForm.currentReading}
                          onChange={(e) => setReadingForm((c) => ({ ...c, currentReading: e.target.value }))}
                          placeholder="Enter current reading"
                          autoFocus
                        />
                      </div>
                      <div className="wb-field">
                        <label>Override Amount (optional)</label>
                        <input
                          type="number" min="0" step="0.01"
                          value={readingForm.finalAmount}
                          onChange={(e) => setReadingForm((c) => ({ ...c, finalAmount: e.target.value }))}
                          placeholder={previewUsage ? `Computed: ${previewUsage.cost.toFixed(2)}` : "Leave blank to use computed"}
                        />
                      </div>
                      <div className="wb-field">
                        <label>Override Reason</label>
                        <input
                          type="text"
                          value={readingForm.overrideReason}
                          onChange={(e) => setReadingForm((c) => ({ ...c, overrideReason: e.target.value }))}
                          placeholder="Only required if overriding"
                        />
                      </div>
                      <div className="wb-field">
                        <label>Notes</label>
                        <input
                          type="text"
                          value={readingForm.notes}
                          onChange={(e) => setReadingForm((c) => ({ ...c, notes: e.target.value }))}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                    {/* Live preview */}
                    {previewUsage && (
                      <div className="wb-summary-strip">
                        <div className="wb-summary-strip__item">
                          <span className="wb-summary-strip__label">Usage</span>
                          <strong className="wb-summary-strip__value">{fmtNumber(previewUsage.usage)} units</strong>
                        </div>
                        <div className="wb-summary-strip__item">
                          <span className="wb-summary-strip__label">Computed</span>
                          <strong className="wb-summary-strip__value">{fmtCurrency(previewUsage.cost)}</strong>
                        </div>
                        <div className="wb-summary-strip__item">
                          <span className="wb-summary-strip__label">Applied Amount</span>
                          <strong className="wb-summary-strip__value wb-summary-strip__value--primary">
                            {readingForm.finalAmount !== "" ? fmtCurrency(Number(readingForm.finalAmount)) : fmtCurrency(previewUsage.cost)}
                          </strong>
                        </div>
                      </div>
                    )}
                    <div className="wb-panel__footer">
                      <button
                        className="wb-btn wb-btn--primary wb-btn--sm"
                        onClick={handleEnterReadingAndFinalize}
                        disabled={updateRecord.isPending || finalizeRecord.isPending}
                      >
                        <CheckCircle2 size={13} /> {(updateRecord.isPending || finalizeRecord.isPending) ? "Finalizing..." : "Finalize & Close"}
                      </button>
                      <button className="wb-btn wb-btn--ghost wb-btn--sm" onClick={closePanel}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ━━━ SECTION 2: Billing Cycle History (mirrors electricity) ━━━ */}
              {records.length > 0 && (
                <section className="wb-section">
                  <div className="wb-section__header">
                    <h3 className="wb-section__title">
                      <Droplets size={14} style={{ color: "var(--color-info, #2563eb)" }} />
                      Billing Cycle History
                    </h3>
                    <span className="wb-section__count">{records.length} period{records.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="wb-table-wrap">
                    <table className="wb-table">
                      <colgroup>
                        <col style={{ width: "24%" }} />
                        <col style={{ width: "16%" }} />
                        <col style={{ width: "13%" }} />
                        <col style={{ width: "13%" }} />
                        <col style={{ width: "10%" }} />
                        <col />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Cycle</th>
                          <th>Meter</th>
                          <th>Rate</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <Fragment key={record.id}>
                            <tr
                              className={[
                                selectedRecordId === record.id ? "wb-row--selected" : "",
                                record.status === "draft" ? "wb-row--draft" : "",
                              ].join(" ").trim()}
                              onClick={() => record.status === "finalized" && selectAndFocusRecord(record.id)}
                              style={{ cursor: record.status === "finalized" ? "pointer" : "default" }}
                              title={record.status === "finalized" ? "Click to view details" : undefined}
                            >
                              <td>
                                <div className="wb-period-summary">
                                  <strong className="wb-period-summary__title">
                                    {fmtShortDate(record.cycleStart)} – {fmtShortDate(record.cycleEnd)}
                                  </strong>
                                </div>
                              </td>
                              <td>
                                <span className="wb-cell--muted">{record.previousReading} → {record.currentReading} units</span>
                              </td>
                              <td>{fmtCurrency(record.ratePerUnit)}</td>
                              <td><strong>{fmtCurrency(record.finalAmount)}</strong></td>
                              <td>
                                <span className={`wb-status-pill wb-status-pill--${record.status}`}>
                                  {record.status}
                                </span>
                              </td>
                              <td className="wb-cell--actions" onClick={(e) => e.stopPropagation()}>
                                {record.status === "finalized" && (
                                  <button className="wb-btn wb-btn--xs wb-btn--outline" onClick={() => selectAndFocusRecord(record.id)}>
                                    {selectedRecordId === record.id ? "Hide Details" : "View Details"}
                                  </button>
                                )}
                                {record.status === "draft" && (
                                  <>
                                    <button className="wb-btn wb-btn--xs wb-btn--outline" onClick={openEnterReading}>
                                      <Edit3 size={11} /> Enter Reading
                                    </button>
                                    <button className="wb-btn wb-btn--xs wb-btn--outline" onClick={() => handleDeleteDraft(record)}>
                                      <Trash2 size={11} /> Delete Draft
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                            {selectedRecordId === record.id && record.status === "finalized" && (
                              <tr className="wb-history-detail-row">
                                <td colSpan={6} className="wb-history-detail-cell">
                                  {renderRecordDetails(record)}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmModal.open}
      onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
      onConfirm={confirmModal.onConfirm}
      title={confirmModal.title}
      message={confirmModal.message}
      confirmText={confirmModal.confirmText || "Confirm"}
      variant={confirmModal.variant || "info"}
      loading={deleteRecord.isPending}
    />
    </>
  );
}
