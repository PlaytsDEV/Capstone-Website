import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Check,
  Download,
  Droplets,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../../../../shared/hooks/useAuth";
import ConfirmModal from "../../../../shared/components/ConfirmModal";
import { waterApi } from "../../../../shared/api/waterApi.js";
import {
  useAdjustWaterDraftBill,
  useCloseWaterPeriod,
  useDeleteWaterRecord,
  useLatestWaterRecord,
  useOpenWaterPeriod,
  useReviseWaterResult,
  useSendWaterBills,
  useUpdateWaterPeriod,
  useWaterDraftBills,
  useWaterPeriods,
  useWaterResult,
  useWaterRooms,
} from "../../../../shared/hooks/queries/useWaterBilling";
import { useBusinessSettings } from "../../../../shared/hooks/queries/useSettings";
import { exportToCSV } from "../../../../shared/utils/exportUtils.js";
import { getRoomLabel } from "../../../../shared/utils/roomLabel.js";
import BillingContentEmpty from "./shared/BillingContentEmpty";
import BillingRoomHeader from "./shared/BillingRoomHeader";
import useBillingNotifier from "./shared/useBillingNotifier";
import "./ElectricityBillingTab.css";
import "./WaterBillingTab.css";

const EMPTY_VALUE = "-";
const PERIODS_PER_PAGE = 5;
const BRANCH_OPTIONS = [
  { value: "", label: "All" },
  { value: "gil-puyat", label: "Gil-Puyat" },
  { value: "guadalupe", label: "Guadalupe" },
];
const WATER_EXPORT_COLUMNS = [
  { key: "roomName", label: "Room" },
  { key: "branch", label: "Branch" },
  { key: "roomType", label: "Room Type" },
  { key: "cycleStart", label: "Cycle Start", formatter: formatDateValue },
  { key: "cycleEnd", label: "Cycle End", formatter: formatDateValue },
  { key: "status", label: "Status" },
  { key: "usage", label: "Usage", formatter: formatDecimalValue },
  { key: "ratePerUnit", label: "Rate / Unit", formatter: formatDecimalValue },
  { key: "computedAmount", label: "Computed", formatter: formatDecimalValue },
  { key: "finalAmount", label: "Final", formatter: formatDecimalValue },
  { key: "tenantName", label: "Tenant" },
  { key: "tenantShare", label: "Tenant Share", formatter: formatDecimalValue },
];

function formatDateValue(value) {
  return value ? new Date(value).toLocaleDateString() : "";
}

function formatDecimalValue(value) {
  return value !== "" && value != null ? Number(value).toFixed(2) : "";
}

function fmtCurrency(value) {
  return value != null
    ? `PHP ${Number(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : EMPTY_VALUE;
}

function fmtNumber(value, digits = 2) {
  return value != null
    ? Number(value).toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : EMPTY_VALUE;
}

function fmtShareMetric(value, digits = 2) {
  return value == null ? "Varies" : fmtNumber(value, digits);
}

function fmtMonthYear(value) {
  return value
    ? new Date(value).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : "";
}

function fmtShortDate(value) {
  return value
    ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";
}

function toInputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getTodayInput() {
  return new Date().toISOString().slice(0, 10);
}

function getPeriodLabel(period) {
  if (!period) return "Billing Cycle";
  if (period.status === "open") return "Current Cycle";
  if (period.revised) return "Revised Cycle";
  return `${fmtMonthYear(period.startDate)} Cycle`;
}

function getDisplayStatus(period) {
  return period?.displayStatus || period?.status || "closed";
}

function getDisplayStatusLabel(period) {
  const status = getDisplayStatus(period);
  return status === "ready" ? "ready to send" : status;
}

function getRoomBadgeLabel(room) {
  if (!room) return "No Period";
  if (!room.activeTenantCount) return "No Tenants";
  if (room.latestRecord?.status === "draft") return "Active";
  if (room.latestRecord?.syncStatus === "synced_to_draft_bills") return "Ready To Send";
  if (room.latestRecord?.status === "finalized") return "Closed";
  return "No Period";
}

function getCycleLabel(period) {
  if (!period) return EMPTY_VALUE;
  return `${fmtShortDate(period.startDate)} - ${fmtShortDate(period.endDate)}`;
}

function getMeterRangeLabel(period) {
  if (!period) return EMPTY_VALUE;
  return `${fmtNumber(period.startReading, 0)} units to ${fmtNumber(period.endReading, 0)} units`;
}

function getPeriodRangeText(period) {
  if (!period) return EMPTY_VALUE;
  return `${fmtShortDate(period.startDate)} - ${fmtShortDate(period.endDate)}`;
}

function maskName(name) {
  if (!name) return EMPTY_VALUE;
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0];
  return `${parts[0]} ${"*".repeat(Math.max(parts.slice(1).join(" ").length, 4))}`;
}

function getDefaultNextCycleStart(lastClosedPeriod) {
  if (lastClosedPeriod?.endDate) {
    return toInputDate(lastClosedPeriod.endDate);
  }
  return getTodayInput();
}

function getDraftChargeValue(charges, type) {
  const entry = (charges || []).find((charge) => charge.type === type);
  return entry?.amount ?? 0;
}

export default function WaterBillingParityTab() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const notify = useBillingNotifier();

  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [branchFilter, setBranchFilter] = useState(isOwner ? "" : user?.branch || "");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [activePanel, setActivePanel] = useState(null);
  const [editingRateId, setEditingRateId] = useState(null);
  const [editingRateValue, setEditingRateValue] = useState("");
  const [expandedBillId, setExpandedBillId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [globalDueDate, setGlobalDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 10);
  });
  const [periodsPage, setPeriodsPage] = useState(1);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
    variant: "danger",
    confirmText: "Confirm",
  });
  const [detailVisibility, setDetailVisibility] = useState({
    segments: true,
    tenantSummary: true,
    draftBills: true,
  });
  const [reviseModal, setReviseModal] = useState({ open: false, periodId: null });
  const [revisionNote, setRevisionNote] = useState("");
  const [periodForm, setPeriodForm] = useState({
    startDate: getTodayInput(),
    startReading: "",
    ratePerUnit: "",
    endDate: getTodayInput(),
    endReading: "",
  });
  const [isExporting, setIsExporting] = useState(false);

  const { data: businessSettings } = useBusinessSettings(Boolean(user));
  const { data: roomsData, isLoading: roomsLoading } = useWaterRooms(branchFilter);
  const { data: latestData } = useLatestWaterRecord(selectedRoomId);
  const { data: periodsData } = useWaterPeriods(selectedRoomId);
  const { data: resultData } = useWaterResult(selectedPeriodId);
  const { data: draftBillsData } = useWaterDraftBills(selectedPeriodId);

  const openPeriod = useOpenWaterPeriod();
  const updatePeriod = useUpdateWaterPeriod();
  const closePeriod = useCloseWaterPeriod();
  const reviseResult = useReviseWaterResult();
  const deleteRecord = useDeleteWaterRecord();
  const sendBills = useSendWaterBills(selectedPeriodId);
  const adjustBill = useAdjustWaterDraftBill();

  const rooms = useMemo(
    () => (roomsData?.rooms || []).filter((room) => room.isWaterEligible),
    [roomsData],
  );
  const periods = periodsData?.periods || [];
  const result = resultData?.result || null;
  const draftBills = draftBillsData?.bills || [];
  const latestRecord = latestData?.record || null;
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || null;
  const openPeriodForRoom = periods.find((period) => period.status === "open") || null;
  const lastClosedPeriod =
    periods.find((period) => period.status === "closed" || period.revised) || null;
  const defaultWaterRatePerUnit = businessSettings?.defaultWaterRatePerUnit ?? "";

  const filteredRooms = useMemo(() => {
    let list = branchFilter ? rooms.filter((room) => room.branch === branchFilter) : rooms;
    if (sidebarSearch.trim()) {
      const query = sidebarSearch.trim().toLowerCase();
      list = list.filter((room) => getRoomLabel(room).toLowerCase().includes(query));
    }
    return list;
  }, [branchFilter, rooms, sidebarSearch]);

  const totalPeriodPages = Math.max(1, Math.ceil(periods.length / PERIODS_PER_PAGE));
  const pagedPeriods = periods.slice(
    (periodsPage - 1) * PERIODS_PER_PAGE,
    periodsPage * PERIODS_PER_PAGE,
  );

  useEffect(() => {
    if (filteredRooms.length === 0) {
      setSelectedRoomId(null);
      setSelectedPeriodId(null);
      return;
    }

    if (!selectedRoomId || !filteredRooms.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId(filteredRooms[0].id);
    }
  }, [filteredRooms, selectedRoomId]);

  useEffect(() => {
    if (periods.length === 0) {
      setSelectedPeriodId(null);
      return;
    }

    if (periods.some((period) => period.id === selectedPeriodId)) {
      return;
    }

    const mostRecent =
      periods.find((period) => period.status === "closed" || period.revised) || periods[0];
    setSelectedPeriodId(mostRecent?.id || null);
  }, [periods, selectedPeriodId]);

  useEffect(() => {
    setPeriodsPage(1);
    setExpandedBillId(null);
    setEditForm({});
  }, [selectedRoomId]);

  useEffect(() => {
    if (activePanel === "closePeriod" && openPeriodForRoom) {
      setPeriodForm((current) => ({
        ...current,
        endDate: toInputDate(openPeriodForRoom.endDate) || current.endDate,
      }));
    }
  }, [activePanel, openPeriodForRoom]);

  const openPanel = (panel) => {
    setActivePanel(panel);
    if (panel === "newPeriod") {
      const startDate = getDefaultNextCycleStart(lastClosedPeriod);
      setPeriodForm({
        startDate,
        startReading: String(lastClosedPeriod?.endReading ?? latestRecord?.currentReading ?? ""),
        ratePerUnit: String(lastClosedPeriod?.ratePerUnit ?? defaultWaterRatePerUnit ?? ""),
        endDate: getTodayInput(),
        endReading: "",
      });
    }
    if (panel === "closePeriod") {
      setPeriodForm((current) => ({
        ...current,
        endDate: toInputDate(openPeriodForRoom?.endDate) || getTodayInput(),
        endReading: "",
      }));
    }
  };

  const closePanel = () => setActivePanel(null);

  const selectAndFocusPeriod = (periodId) => {
    if (selectedPeriodId === periodId) {
      setSelectedPeriodId(null);
      setExpandedBillId(null);
      setEditForm({});
      return;
    }

    setSelectedPeriodId(periodId);
    setExpandedBillId(null);
    setEditForm({});
    setDetailVisibility({
      segments: true,
      tenantSummary: true,
      draftBills: true,
    });
  };

  const beginRateEdit = (period) => {
    setEditingRateId(period.id);
    setEditingRateValue(String(period.ratePerUnit ?? ""));
  };

  const cancelRateEdit = () => {
    setEditingRateId(null);
    setEditingRateValue("");
  };

  const handleSaveRate = async (periodId) => {
    try {
      await updatePeriod.mutateAsync({
        periodId,
        ratePerUnit: Number(editingRateValue),
      });
      notify.success("Water period rate updated.");
      cancelRateEdit();
    } catch (error) {
      notify.error(error, "Failed to update water period rate.");
    }
  };

  const handleOpenPeriod = async () => {
    if (periodForm.startReading === "") {
      return notify.warn("Start reading is required.");
    }
    if (!periodForm.ratePerUnit || Number(periodForm.ratePerUnit) <= 0) {
      return notify.warn("Rate is required.");
    }

    try {
      await openPeriod.mutateAsync({
        roomId: selectedRoomId,
        startDate: periodForm.startDate,
        startReading: Number(periodForm.startReading),
        ratePerUnit: Number(periodForm.ratePerUnit),
      });
      notify.success("Water billing period opened.");
      closePanel();
    } catch (error) {
      notify.error(error, "Failed to open water billing period.");
    }
  };

  const handleClosePeriod = async () => {
    if (!openPeriodForRoom) return;
    if (periodForm.endReading === "") {
      return notify.warn("End reading is required.");
    }

    try {
      await closePeriod.mutateAsync({
        periodId: openPeriodForRoom.id,
        endReading: Number(periodForm.endReading),
        endDate: periodForm.endDate || getTodayInput(),
      });
      notify.success("Water period closed. Draft bills refreshed.");
      closePanel();
      selectAndFocusPeriod(openPeriodForRoom.id);
    } catch (error) {
      notify.error(error, "Failed to close water billing period.");
    }
  };

  const handleDeleteOpenPeriod = (period) => {
    setConfirmModal({
      open: true,
      title: "Delete Billing Period",
      message:
        "This will remove the active water billing period so you can recreate it from the latest reading.",
      confirmText: "Delete Period",
      variant: "danger",
      onConfirm: async () => {
        setConfirmModal((current) => ({ ...current, open: false }));
        try {
          await deleteRecord.mutateAsync(period.id);
          if (selectedPeriodId === period.id) {
            setSelectedPeriodId(null);
          }
          notify.success("Water billing period deleted.");
        } catch (error) {
          notify.error(error, "Failed to delete water billing period.");
        }
      },
    });
  };

  const handleRevise = (periodId) => {
    setRevisionNote("");
    setReviseModal({ open: true, periodId });
  };

  const handleReviseConfirm = async () => {
    if (!reviseModal.periodId) return;
    try {
      await reviseResult.mutateAsync({
        periodId: reviseModal.periodId,
        revisionNote,
      });
      notify.success("Water billing was re-run successfully.");
      setReviseModal({ open: false, periodId: null });
    } catch (error) {
      notify.error(error, "Failed to re-run water billing.");
    }
  };

  const handleExportRows = async () => {
    try {
      setIsExporting(true);
      const response = await waterApi.exportRows({ branch: branchFilter || undefined });
      const rows = response?.rows || [];
      if (!rows.length) {
        return notify.warn("No water billing rows available for export.");
      }
      exportToCSV(
        rows,
        WATER_EXPORT_COLUMNS,
        `water_billing_${branchFilter || "all"}_${getTodayInput()}`,
      );
      notify.success(`Exported ${rows.length} water billing row${rows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      notify.error(error, "Failed to export water billing.");
    } finally {
      setIsExporting(false);
    }
  };

  const startEditBill = (bill) => {
    setExpandedBillId(String(bill.billId));
    setEditForm({
      electricity: String(getDraftChargeValue(bill.charges, "electricity")),
      water: String(getDraftChargeValue(bill.charges, "water")),
      rent: String(getDraftChargeValue(bill.charges, "rent")),
      applianceFees: String(getDraftChargeValue(bill.charges, "applianceFees")),
      corkageFees: String(getDraftChargeValue(bill.charges, "corkageFees")),
      dueDate: toInputDate(bill.dueDate) || globalDueDate,
      notes: bill.notes || "",
    });
  };

  const cancelEdit = () => {
    setExpandedBillId(null);
    setEditForm({});
  };

  const computeEditTotal = () =>
    ["electricity", "water", "rent", "applianceFees", "corkageFees"].reduce(
      (sum, key) => sum + Number(editForm[key] || 0),
      0,
    );

  const handleSaveEdit = async (billId) => {
    try {
      await adjustBill.mutateAsync({
        billId,
        periodId: selectedPeriodId,
        electricity: Number(editForm.electricity || 0),
        water: Number(editForm.water || 0),
        rent: Number(editForm.rent || 0),
        applianceFees: Number(editForm.applianceFees || 0),
        corkageFees: Number(editForm.corkageFees || 0),
        dueDate: editForm.dueDate || null,
        notes: editForm.notes || "",
      });
      notify.success("Draft bill updated.");
      cancelEdit();
    } catch (error) {
      notify.error(error, "Failed to update draft bill.");
    }
  };

  const handleSendBills = () => {
    setConfirmModal({
      open: true,
      title: "Send Draft Bills",
      message: `This will send ${draftBills.length} bill${draftBills.length !== 1 ? "s" : ""} to tenants and notify them by email.`,
      confirmText: "Send Bills",
      variant: "info",
      onConfirm: async () => {
        setConfirmModal((current) => ({ ...current, open: false }));
        try {
          const response = await sendBills.mutateAsync({
            defaultDueDate: globalDueDate,
          });
          notify.success(`Sent ${response?.sent || 0} water bill${response?.sent === 1 ? "" : "s"}.`);
        } catch (error) {
          notify.error(error, "Failed to send water bills.");
        }
      },
    });
  };

  const renderExpandedPeriodDetails = (period) => {
    if (!period || selectedPeriodId !== period.id) return null;
    const displayStatus = getDisplayStatus(period);

    return (
      <div className="eb-period-detail eb-period-detail--inline">
        <div className="eb-period-detail__header">
          <div className="eb-period-detail__heading">
            <span className="eb-period-detail__title">
              {getPeriodLabel(period)}: {getPeriodRangeText(period)}
            </span>
            <span className="eb-period-detail__meta">
              Meter range {getMeterRangeLabel(period)}
            </span>
          </div>
          <div className="eb-period-detail__actions">
            <span className={`eb-status-pill eb-status-pill--${displayStatus}`}>
              {getDisplayStatusLabel(period)}
            </span>
            <button className="eb-btn eb-btn--xs eb-btn--outline" onClick={() => setSelectedPeriodId(null)}>
              Hide Details
            </button>
          </div>
        </div>

        <div className="eb-period-detail__body">
          {result ? (
            <>
              <div className="eb-stats">
                <div className="eb-stat">
                  <span className="eb-stat__label">Total Units</span>
                  <span className="eb-stat__value">{fmtNumber(result.totalUsage, 2)}</span>
                </div>
                <div className="eb-stat">
                  <span className="eb-stat__label">Room Cost</span>
                  <span className="eb-stat__value">{fmtCurrency(result.totalRoomCost)}</span>
                </div>
                <div className="eb-stat">
                  <span className="eb-stat__label">Rate</span>
                  <span className="eb-stat__value">{fmtCurrency(result.ratePerUnit)}/unit</span>
                </div>
                <div className="eb-stat">
                  <span className="eb-stat__label">Tenants</span>
                  <span className="eb-stat__value">{result.tenantSummaries?.length || 0}</span>
                </div>
              </div>

              <div className="eb-result">
                <div className="eb-result__header">
                  <div className="eb-result__title">
                    <Droplets size={14} />
                    <span>Usage Breakdown</span>
                    <span className="eb-verified">
                      <Check size={11} /> Verified
                    </span>
                  </div>
                  <button
                    className="eb-btn eb-btn--xs eb-btn--ghost"
                    onClick={() => handleRevise(selectedPeriodId)}
                    disabled={reviseResult.isPending}
                  >
                    <RefreshCw size={12} /> Re-run
                  </button>
                </div>

                <div className="eb-result__toolbar">
                  <button
                    className="eb-btn eb-btn--xs eb-btn--outline"
                    onClick={() =>
                      setDetailVisibility((current) => ({ ...current, segments: !current.segments }))
                    }
                  >
                    {detailVisibility.segments ? "Hide segments" : "Show segments"}
                  </button>
                  <button
                    className="eb-btn eb-btn--xs eb-btn--outline"
                    onClick={() =>
                      setDetailVisibility((current) => ({
                        ...current,
                        tenantSummary: !current.tenantSummary,
                      }))
                    }
                  >
                    {detailVisibility.tenantSummary ? "Hide tenant summary" : "Show tenant summary"}
                  </button>
                </div>

                <div className="eb-result__body">
                  {detailVisibility.segments ? (
                    <div className="eb-table-wrap">
                      <table className="eb-table eb-table--detail">
                        <thead>
                          <tr>
                            <th>Period</th>
                            <th>From Units</th>
                            <th>To Units</th>
                            <th>Consumed</th>
                            <th>Cost</th>
                            <th>Tenants</th>
                            <th>Share Units</th>
                            <th>Share Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(result.segments || []).map((segment, index) => (
                            <tr key={`${period.id}-segment-${index}`}>
                              <td>{segment.periodLabel || getPeriodRangeText(period)}</td>
                              <td className="eb-cell--num">{fmtNumber(segment.readingFrom, 0)}</td>
                              <td className="eb-cell--num">{fmtNumber(segment.readingTo, 0)}</td>
                              <td className="eb-cell--num">{fmtNumber(segment.unitsConsumed, 2)}</td>
                              <td className="eb-cell--num">{fmtCurrency(segment.totalCost)}</td>
                              <td className="eb-cell--center">{segment.activeTenantCount}</td>
                              <td className="eb-cell--num">{fmtShareMetric(segment.sharePerTenantUnits, 4)}</td>
                              <td className="eb-cell--num">{segment.sharePerTenantCost == null ? "Varies" : fmtCurrency(segment.sharePerTenantCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {detailVisibility.tenantSummary ? (
                    <>
                      <h4 className="eb-subsection-title">Tenant Summary</h4>
                      <div className="eb-table-wrap">
                        <table className="eb-table eb-table--detail">
                          <thead>
                            <tr>
                              <th>Tenant</th>
                              <th>Total Units</th>
                              <th>Bill Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(result.tenantSummaries || []).map((tenant, index) => (
                              <tr key={`${period.id}-tenant-${index}`}>
                                <td>{tenant.tenantName}</td>
                                <td className="eb-cell--num">{fmtNumber(tenant.totalUsage, 4)}</td>
                                <td className="eb-cell--num eb-cell--bold">{fmtCurrency(tenant.billAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="eb-cycle-panel__empty">
              Water billing details are not available for this cycle yet.
            </div>
          )}

          {draftBills.length > 0 ? (
            <div className="eb-draft-section">
              <div className="eb-draft-header">
                <div className="eb-draft-header__left">
                  <div className="eb-draft-title">
                    <Send size={14} />
                    Draft Bills
                  </div>
                  <span className="eb-draft-count">
                    {draftBills.length} bill{draftBills.length !== 1 ? "s" : ""} pending
                  </span>
                </div>
                <div className="eb-due-date-row">
                  <label htmlFor="wb-global-due-date">Default due date</label>
                  <input
                    id="wb-global-due-date"
                    type="date"
                    value={globalDueDate}
                    onChange={(event) => setGlobalDueDate(event.target.value)}
                  />
                </div>
                <button
                  className="eb-btn eb-btn--xs eb-btn--outline"
                  onClick={() =>
                    setDetailVisibility((current) => ({
                      ...current,
                      draftBills: !current.draftBills,
                    }))
                  }
                >
                  {detailVisibility.draftBills ? "Hide draft bills" : "Show draft bills"}
                </button>
              </div>

              {detailVisibility.draftBills ? (
                <div className="eb-table-wrap">
                  <table className="eb-table eb-table--detail">
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th style={{ textAlign: "right" }}>Total</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {draftBills.map((bill) => {
                        const billId = String(bill.billId);
                        const isExpanded = expandedBillId === billId;

                        return (
                          <Fragment key={billId}>
                            <tr className="eb-draft-row--condensed">
                              <td>
                                {maskName(bill.tenantName)}
                                {bill.isManuallyAdjusted ? (
                                  <span className="eb-revised-tag">edited</span>
                                ) : null}
                              </td>
                              <td className="eb-cell--num eb-cell--bold">{fmtCurrency(bill.totalAmount)}</td>
                              <td className="eb-cell--actions" style={{ justifyContent: "flex-end" }}>
                                {isExpanded ? (
                                  <button className="eb-btn eb-btn--xs eb-btn--ghost" onClick={cancelEdit}>
                                    <X size={11} /> Cancel
                                  </button>
                                ) : (
                                  <button
                                    className="eb-btn eb-btn--xs eb-btn--outline"
                                    onClick={() => startEditBill(bill)}
                                  >
                                    <Pencil size={11} /> Edit
                                  </button>
                                )}
                              </td>
                            </tr>
                            {isExpanded ? (
                              <tr className="eb-draft-expand">
                                <td colSpan={3}>
                                  <div className="eb-draft-expand-inner">
                                    <div className="eb-draft-expand-grid">
                                      <div className="eb-field">
                                        <label>Electricity (PHP)</label>
                                        <input type="number" step="0.01" className="eb-inline-input" value={editForm.electricity} onChange={(event) => setEditForm((current) => ({ ...current, electricity: event.target.value }))} />
                                      </div>
                                      <div className="eb-field">
                                        <label>Water (PHP)</label>
                                        <input type="number" step="0.01" className="eb-inline-input" value={editForm.water} onChange={(event) => setEditForm((current) => ({ ...current, water: event.target.value }))} />
                                      </div>
                                      <div className="eb-field">
                                        <label>Rent (PHP)</label>
                                        <input type="number" step="0.01" className="eb-inline-input" value={editForm.rent} onChange={(event) => setEditForm((current) => ({ ...current, rent: event.target.value }))} />
                                      </div>
                                      <div className="eb-field">
                                        <label>Appliance Fees (PHP)</label>
                                        <input type="number" step="0.01" className="eb-inline-input" value={editForm.applianceFees} onChange={(event) => setEditForm((current) => ({ ...current, applianceFees: event.target.value }))} />
                                      </div>
                                      <div className="eb-field">
                                        <label>Corkage Fees (PHP)</label>
                                        <input type="number" step="0.01" className="eb-inline-input" value={editForm.corkageFees} onChange={(event) => setEditForm((current) => ({ ...current, corkageFees: event.target.value }))} />
                                      </div>
                                      <div className="eb-field">
                                        <label>Due Date</label>
                                        <input type="date" className="eb-inline-input eb-inline-input--left" value={editForm.dueDate} onChange={(event) => setEditForm((current) => ({ ...current, dueDate: event.target.value }))} />
                                      </div>
                                    </div>
                                    <div className="eb-field">
                                      <label>Adjustment Note</label>
                                      <input type="text" value={editForm.notes} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Reason for adjustment..." />
                                    </div>
                                    <div className="eb-draft-expand-footer">
                                      <span className="eb-draft-expand-total">New total: {fmtCurrency(computeEditTotal())}</span>
                                      <div className="wb-inline-actions">
                                        <button className="eb-btn eb-btn--xs eb-btn--ghost" onClick={cancelEdit}>Cancel</button>
                                        <button className="eb-btn eb-btn--xs eb-btn--primary" onClick={() => handleSaveEdit(billId)} disabled={adjustBill.isPending}>
                                          <Save size={11} /> {adjustBill.isPending ? "Saving..." : "Save Changes"}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                      <tr>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>Grand Total</td>
                        <td className="eb-cell--num eb-cell--bold">{fmtCurrency(draftBills.reduce((sum, bill) => sum + Number(bill.totalAmount || 0), 0))}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : null}

              <button className="eb-draft-send-btn" onClick={handleSendBills} disabled={sendBills.isPending}>
                <Send size={15} />
                {sendBills.isPending ? "Sending..." : `Send ${draftBills.length} Bill${draftBills.length !== 1 ? "s" : ""} to Tenants`}
              </button>
            </div>
          ) : null}

          {draftBillsData && draftBills.length === 0 ? (
            <div className="eb-bills-sent-state">
              <Check size={18} />
              No draft bills are pending for this period.
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="wb-parity-shell">
        <div className="eb-toolbar">
          <div className="eb-toolbar__meta">
            <span className="eb-toolbar__title">Water Billing</span>
            <span className="eb-toolbar__subtitle">
              {rooms.length} eligible room{rooms.length === 1 ? "" : "s"}
              {branchFilter ? ` in ${branchFilter}` : ""} | Private and double-sharing
            </span>
          </div>
          <div className="eb-toolbar__actions">
            <button type="button" className="eb-btn eb-btn--outline eb-btn--xs" onClick={handleExportRows} disabled={isExporting}>
              <Download size={13} /> {isExporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>

        <div className="eb-layout">
          <aside className="eb-sidebar">
            <div className="eb-sidebar__header">
              <span className="eb-sidebar__title"><Droplets size={13} /> Rooms</span>
              {isOwner ? (
                <select value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setSelectedRoomId(null); }} className="eb-sidebar__filter">
                  {BRANCH_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="eb-sidebar__search-wrap">
              <input type="text" className="eb-sidebar__search" placeholder="Search rooms..." value={sidebarSearch} onChange={(event) => setSidebarSearch(event.target.value)} />
            </div>
            <div className="eb-sidebar__list">
              {roomsLoading ? (
                <div className="eb-skeleton-list">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="eb-skeleton-card" />)}</div>
              ) : filteredRooms.length === 0 ? (
                <div className="eb-sidebar__empty">{sidebarSearch ? "No rooms match your search" : "No eligible rooms found"}</div>
              ) : (
                filteredRooms.map((room) => (
                  <button key={room.id} className={`eb-room${selectedRoomId === room.id ? " eb-room--active" : ""}`} onClick={() => { setSelectedRoomId(room.id); setActivePanel(null); setSelectedPeriodId(null); }}>
                    <div className="eb-room__top-row">
                      <span className="eb-room__name">{getRoomLabel(room)}</span>
                      <span className={`eb-room__dot${room.activeTenantCount ? " eb-room__dot--active" : ""}`} />
                    </div>
                    <div className="eb-room__bottom-row">
                      <span className="eb-room__badge">{getRoomBadgeLabel(room)}</span>
                      {room.latestRecord?.finalAmount != null ? <span className="wb-room-amount">{fmtCurrency(room.latestRecord.finalAmount)}</span> : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <main className="eb-main">
            {!selectedRoomId ? (
              <BillingContentEmpty icon={Droplets} message="Select a room to manage water billing." />
            ) : (
              <div className="eb-content">
                <div className="eb-header">
                  <BillingRoomHeader icon={Droplets} title={getRoomLabel(selectedRoom, "")} branch={selectedRoom?.branch} />
                </div>

                <section className={`eb-status-banner${openPeriodForRoom ? " eb-status-banner--open" : " eb-status-banner--empty"}`}>
                  <div>
                    <div className="eb-status-banner__eyebrow">{openPeriodForRoom ? "Active Billing Period" : "No Active Period"}</div>
                    <div className="eb-status-banner__title">
                      {openPeriodForRoom
                        ? `Cycle ${getPeriodRangeText(openPeriodForRoom)} | Start: ${fmtNumber(openPeriodForRoom.startReading, 0)} units | Rate: ${fmtCurrency(openPeriodForRoom.ratePerUnit)}/unit`
                        : lastClosedPeriod
                          ? `Last finalized: ${getPeriodRangeText(lastClosedPeriod)}`
                          : "No water billing period has been created for this room yet."}
                    </div>
                  </div>
                  <div className="eb-status-banner__actions">
                    {openPeriodForRoom ? (
                      <>
                        <button className="eb-btn eb-btn--primary" onClick={() => openPanel("closePeriod")}><Check size={13} /> Close Period</button>
                        <button className="eb-btn eb-btn--ghost" onClick={() => handleDeleteOpenPeriod(openPeriodForRoom)}><Trash2 size={13} /> Delete Draft</button>
                      </>
                    ) : (
                      <button className="eb-btn eb-btn--primary" onClick={() => openPanel("newPeriod")}><Plus size={13} /> New Billing Period</button>
                    )}
                  </div>
                </section>

                {activePanel === "newPeriod" ? (
                  <div className="eb-panel">
                    <div className="eb-panel__header">
                      <span>New Water Billing Period</span>
                      <button className="eb-panel__close" onClick={closePanel}><X size={15} /></button>
                    </div>
                    <div className="eb-panel__body">
                      <p className="eb-panel__hint">Start a new water billing cycle. The final reading is entered when the cycle ends.</p>
                      <div className="eb-form-row">
                        <div className="eb-field">
                          <label>Cycle Start</label>
                          <input type="date" value={periodForm.startDate} onChange={(event) => setPeriodForm((current) => ({ ...current, startDate: event.target.value }))} />
                        </div>
                        <div className="eb-field">
                          <label>Start Reading (units)</label>
                          <input type="number" min="0" step="0.01" value={periodForm.startReading} onChange={(event) => setPeriodForm((current) => ({ ...current, startReading: event.target.value }))} />
                        </div>
                        <div className="eb-field">
                          <label>Rate (PHP / unit)</label>
                          <input type="number" min="0" step="0.01" value={periodForm.ratePerUnit} onChange={(event) => setPeriodForm((current) => ({ ...current, ratePerUnit: event.target.value }))} />
                        </div>
                      </div>
                      <div className="eb-panel__footer">
                        <button className="eb-btn eb-btn--primary" onClick={handleOpenPeriod} disabled={openPeriod.isPending}><Check size={13} /> {openPeriod.isPending ? "Opening..." : "Start Billing Period"}</button>
                        <button className="eb-btn eb-btn--ghost" onClick={closePanel}>Cancel</button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activePanel === "closePeriod" && openPeriodForRoom ? (
                  <div className="eb-panel eb-panel--warning">
                    <div className="eb-panel__header">
                      <span>Enter Final Reading</span>
                      <button className="eb-panel__close" onClick={closePanel}><X size={15} /></button>
                    </div>
                    <div className="eb-panel__body">
                      <p className="eb-panel__hint">Cycle {getPeriodRangeText(openPeriodForRoom)} | Previous: {fmtNumber(openPeriodForRoom.startReading, 0)} units | Rate: {fmtCurrency(openPeriodForRoom.ratePerUnit)}/unit</p>
                      <div className="eb-form-row">
                        <div className="eb-field">
                          <label>Closing Date</label>
                          <input type="date" value={periodForm.endDate} onChange={(event) => setPeriodForm((current) => ({ ...current, endDate: event.target.value }))} />
                        </div>
                        <div className="eb-field">
                          <label>End Reading (units)</label>
                          <input type="number" min="0" step="0.01" value={periodForm.endReading} onChange={(event) => setPeriodForm((current) => ({ ...current, endReading: event.target.value }))} />
                        </div>
                      </div>
                      <div className="wb-preview-strip">
                        <div className="eb-stat">
                          <span className="eb-stat__label">Projected Usage</span>
                          <span className="eb-stat__value">{periodForm.endReading === "" ? EMPTY_VALUE : fmtNumber(Math.max(Number(periodForm.endReading) - Number(openPeriodForRoom.startReading || 0), 0), 2)}</span>
                        </div>
                        <div className="eb-stat">
                          <span className="eb-stat__label">Projected Cost</span>
                          <span className="eb-stat__value">{periodForm.endReading === "" ? EMPTY_VALUE : fmtCurrency(Math.max(Number(periodForm.endReading) - Number(openPeriodForRoom.startReading || 0), 0) * Number(openPeriodForRoom.ratePerUnit || 0))}</span>
                        </div>
                      </div>
                      <div className="eb-panel__footer">
                        <button className="eb-btn eb-btn--primary" onClick={handleClosePeriod} disabled={closePeriod.isPending}><Check size={13} /> {closePeriod.isPending ? "Closing..." : "Finalize & Close"}</button>
                        <button className="eb-btn eb-btn--ghost" onClick={closePanel}>Cancel</button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {periods.length > 0 ? (
                  <section className="eb-section eb-section--primary">
                    <div className="eb-section__header">
                      <h3 className="eb-section__title eb-section__title--primary"><Droplets size={14} style={{ color: "var(--color-info, #2563eb)" }} />Billing Cycle History</h3>
                      <span className="eb-section__count">{periods.length} period{periods.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="eb-table-wrap">
                      <table className="eb-table">
                        <thead>
                          <tr>
                            <th>Cycle</th>
                            <th>Meter</th>
                            <th>Rate</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedPeriods.map((period) => (
                            <Fragment key={period.id}>
                              <tr className={[selectedPeriodId === period.id ? "eb-row--selected" : "", period.status === "open" ? "eb-row--open" : ""].join(" ").trim()} onClick={() => (period.status === "closed" || period.revised) && selectAndFocusPeriod(period.id)} style={{ cursor: period.status === "closed" || period.revised ? "pointer" : "default" }}>
                                <td>
                                  <div className="eb-period-summary">
                                    <strong className="eb-period-label__title">{getCycleLabel(period)}</strong>
                                    <span className="eb-period-summary__meta">{period.status === "open" ? "Current active cycle" : "Closed cycle details"}</span>
                                  </div>
                                </td>
                                <td><div className="eb-period-summary"><span className="eb-period-summary__value">{getMeterRangeLabel(period)}</span></div></td>
                                <td><span className="eb-rate-display">{fmtCurrency(period.ratePerUnit)}</span></td>
                                <td>
                                  <span className={`eb-status-pill eb-status-pill--${getDisplayStatus(period)}`}>{getDisplayStatusLabel(period)}</span>
                                  {period.revised ? <span className="eb-revised-tag">edited</span> : null}
                                </td>
                                <td className="eb-cell--actions" onClick={(event) => event.stopPropagation()}>
                                  {period.status === "closed" || period.revised ? <button className="eb-btn eb-btn--xs eb-btn--outline" onClick={() => selectAndFocusPeriod(period.id)}>{selectedPeriodId === period.id ? "Hide Details" : "View Details"}</button> : null}
                                  {period.status === "open" ? (editingRateId === period.id ? (
                                    <div className="eb-rate-editor">
                                      <input type="number" step="0.01" className="eb-inline-input eb-inline-input--rate" value={editingRateValue} onChange={(event) => setEditingRateValue(event.target.value)} />
                                      <button className="eb-btn eb-btn--xs eb-btn--primary" onClick={() => handleSaveRate(period.id)} disabled={updatePeriod.isPending}><Save size={10} /> Save</button>
                                      <button className="eb-btn eb-btn--xs eb-btn--ghost" onClick={cancelRateEdit}>Cancel</button>
                                    </div>
                                  ) : <button className="eb-btn eb-btn--xs eb-btn--outline" onClick={() => beginRateEdit(period)}><Pencil size={11} /> Edit Rate</button>) : null}
                                  {period.status === "closed" || period.revised ? <button className="eb-btn eb-btn--xs eb-btn--ghost" onClick={() => handleRevise(period.id)} disabled={reviseResult.isPending}><RefreshCw size={11} /> Re-run</button> : null}
                                  {period.status === "open" ? <button className="eb-btn eb-btn--xs eb-btn--danger" onClick={() => handleDeleteOpenPeriod(period)} disabled={deleteRecord.isPending}><Trash2 size={11} /> Delete</button> : null}
                                </td>
                              </tr>
                              {selectedPeriodId === period.id && (period.status === "closed" || period.revised) ? (
                                <tr className="eb-history-detail-row">
                                  <td colSpan={5} className="eb-history-detail-cell">{renderExpandedPeriodDetails(period)}</td>
                                </tr>
                              ) : null}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalPeriodPages > 1 ? (
                      <div className="eb-pagination">
                        <span className="eb-pagination__info">{periods.length} total period{periods.length !== 1 ? "s" : ""}</span>
                        <div className="eb-pagination__controls">
                          <button className="eb-page-btn" onClick={() => setPeriodsPage((current) => Math.max(1, current - 1))} disabled={periodsPage === 1}>&lt;</button>
                          {Array.from({ length: totalPeriodPages }, (_, index) => index + 1).map((page) => (
                            <button key={page} className={`eb-page-btn${periodsPage === page ? " eb-page-btn--active" : ""}`} onClick={() => setPeriodsPage(page)}>{page}</button>
                          ))}
                          <button className="eb-page-btn" onClick={() => setPeriodsPage((current) => Math.min(totalPeriodPages, current + 1))} disabled={periodsPage === totalPeriodPages}>&gt;</button>
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>
            )}
          </main>
        </div>
      </div>

      <ConfirmModal isOpen={confirmModal.open} onClose={() => setConfirmModal((current) => ({ ...current, open: false }))} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message} variant={confirmModal.variant} confirmText={confirmModal.confirmText} />

      {reviseModal.open ? (
        <div className="eb-modal-overlay" onClick={() => setReviseModal({ open: false, periodId: null })}>
          <div className="eb-modal" onClick={(event) => event.stopPropagation()}>
            <div className="eb-modal__header">
              <span>Re-run Billing Computation</span>
              <button className="eb-panel__close" onClick={() => setReviseModal({ open: false, periodId: null })}><X size={15} /></button>
            </div>
            <div className="eb-modal__body">
              <p className="wb-revision-copy">This re-runs the water billing result using the current draft values and tenant coverage.</p>
              <div className="eb-field">
                <label>Revision Note (optional)</label>
                <input type="text" value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} placeholder="Reason for recomputing this cycle" />
              </div>
            </div>
            <div className="eb-modal__footer">
              <button className="eb-btn eb-btn--primary" onClick={handleReviseConfirm} disabled={reviseResult.isPending}><RefreshCw size={13} /> {reviseResult.isPending ? "Re-running..." : "Re-run Computation"}</button>
              <button className="eb-btn eb-btn--ghost" onClick={() => setReviseModal({ open: false, periodId: null })}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
