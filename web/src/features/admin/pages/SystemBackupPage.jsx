/**
 * =============================================================================
 * SYSTEM BACKUP PAGE (Owner-Only)
 * =============================================================================
 *
 * Full-featured backup management page:
 * - Configure automatic backups (toggle + interval)
 * - Trigger manual backups
 * - View backup history with status, size, duration
 * - Download completed backups
 * - Delete backup records and files
 *
 * =============================================================================
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Database,
  Settings,
  History,
  Download,
  Trash2,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  HardDrive,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Zap,
  User,
  RotateCcw,
  Upload,
} from "lucide-react";
import { backupApi } from "../../../shared/api/backupApi";
import { AdminTablePageSkeleton } from "../components/AdminContentSkeletons";
import "../styles/admin-backup.css";

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const INTERVAL_OPTIONS = [
  { value: 1, label: "Every day" },
  { value: 3, label: "Every 3 days" },
  { value: 7, label: "Every 7 days" },
  { value: 14, label: "Every 14 days" },
  { value: 30, label: "Every 30 days" },
];

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtDuration = (ms) => {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const fmtTriggeredBy = (t) => {
  if (!t || (!t.email && !t.userId)) return "System";
  return t.email || "Admin";
};

/* ── Confirm Modal ────────────────────────────────────────────────────────── */

function ConfirmModal({ title, description, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="backup-confirm-overlay" onClick={onCancel}>
      <div className="backup-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="backup-confirm-modal__title">{title}</h3>
        <p className="backup-confirm-modal__desc">{description}</p>
        <div className="backup-confirm-modal__actions">
          <button type="button" className="backup-btn backup-btn--secondary backup-btn--sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`backup-btn backup-btn--sm ${danger ? "backup-btn--danger" : "backup-btn--primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Restore Confirm Modal (typed confirmation) ──────────────────────────── */

function RestoreConfirmModal({ record, onConfirm, onCancel }) {
  const [typed, setTyped] = useState("");
  const canConfirm = typed === "RESTORE";

  return (
    <div className="backup-confirm-overlay" onClick={onCancel}>
      <div className="backup-confirm-modal backup-confirm-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="backup-restore-warning-icon">
          <AlertTriangle size={28} />
        </div>
        <h3 className="backup-confirm-modal__title">Restore Database</h3>
        <div className="backup-confirm-modal__desc">
          <p style={{ margin: "0 0 8px" }}>
            You are about to <strong>replace all current data</strong> with the backup from{" "}
            <strong>{fmtDate(record.createdAt)}</strong>.
          </p>
          <div className="backup-restore-callout">
            <AlertTriangle size={14} />
            <span>This action will <strong>replace all current data</strong> with the selected backup. This cannot be undone.</span>
          </div>
          <p style={{ margin: "12px 0 6px", fontWeight: 600, color: "var(--foreground)" }}>
            Type <code className="backup-code">RESTORE</code> to confirm:
          </p>
          <input
            type="text"
            className="backup-restore-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
            placeholder="Type RESTORE"
            autoFocus
          />
        </div>
        <div className="backup-confirm-modal__actions">
          <button type="button" className="backup-btn backup-btn--secondary backup-btn--sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="backup-btn backup-btn--warning backup-btn--sm"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            <RotateCcw size={13} />
            Restore Database
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Upload Restore Modal ────────────────────────────────────────────────── */

function UploadRestoreModal({ onConfirm, onCancel }) {
  const [file, setFile] = useState(null);
  const [typed, setTyped] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const canConfirm = typed === "RESTORE" && file;

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) setFile(droppedFile);
  };

  return (
    <div className="backup-confirm-overlay" onClick={onCancel}>
      <div className="backup-confirm-modal backup-confirm-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="backup-restore-warning-icon">
          <Upload size={28} />
        </div>
        <h3 className="backup-confirm-modal__title">Upload & Restore Backup</h3>
        <div className="backup-confirm-modal__desc">
          <p style={{ margin: "0 0 10px" }}>
            Upload a previously downloaded <code className="backup-code">.json.gz</code> backup file to
            restore the database to that point.
          </p>

          {/* Drop zone / file picker */}
          <div
            className={`backup-upload-zone ${dragOver ? "backup-upload-zone--active" : ""} ${file ? "backup-upload-zone--has-file" : ""}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".gz,.json.gz"
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <>
                <HardDrive size={20} />
                <span className="backup-upload-zone__filename">{file.name}</span>
                <span className="backup-upload-zone__size">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </>
            ) : (
              <>
                <Upload size={20} />
                <span>Drop a .json.gz file here or click to browse</span>
              </>
            )}
          </div>

          <div className="backup-restore-callout" style={{ marginTop: 10 }}>
            <AlertTriangle size={14} />
            <span>This action will <strong>replace all current data</strong> with the uploaded backup. This cannot be undone.</span>
          </div>

          <p style={{ margin: "12px 0 6px", fontWeight: 600, color: "var(--foreground)" }}>
            Type <code className="backup-code">RESTORE</code> to confirm:
          </p>
          <input
            type="text"
            className="backup-restore-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value.toUpperCase())}
            placeholder="Type RESTORE"
          />
        </div>
        <div className="backup-confirm-modal__actions">
          <button type="button" className="backup-btn backup-btn--secondary backup-btn--sm" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="backup-btn backup-btn--warning backup-btn--sm"
            onClick={() => onConfirm(file)}
            disabled={!canConfirm}
          >
            <Upload size={13} />
            Upload & Restore
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Status Badge ─────────────────────────────────────────────────────────── */

function StatusBadge({ status }) {
  const icon =
    status === "completed" ? <CheckCircle size={11} /> :
    status === "failed" ? <XCircle size={11} /> :
    <span className="backup-status-spinner" />;

  const label =
    status === "completed" ? "Completed" :
    status === "failed" ? "Failed" :
    "In Progress";

  return (
    <span className={`backup-status-badge backup-status-badge--${status}`}>
      {icon}
      {label}
    </span>
  );
}

/* ── Type Badge ───────────────────────────────────────────────────────────── */

function TypeBadge({ type }) {
  const icon =
    type === "automatic" ? <Zap size={10} /> :
    type === "restore" ? <RotateCcw size={10} /> :
    <User size={10} />;

  const label =
    type === "automatic" ? "Auto" :
    type === "restore" ? "Restore" :
    "Manual";

  return (
    <span className={`backup-type-badge backup-type-badge--${type}`}>
      {icon}
      {label}
    </span>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */

export default function SystemBackupPage() {
  /* State */
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);

  const [localAutoEnabled, setLocalAutoEnabled] = useState(false);
  const [localInterval, setLocalInterval] = useState(7);

  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [historyLoading, setHistoryLoading] = useState(true);
  const [pageSize, setPageSize] = useState(5);

  const [triggerLoading, setTriggerLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [restoreModal, setRestoreModal] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  /* ── Load config ──────────────────────────────────────────────────────── */

  const loadConfig = useCallback(async () => {
    try {
      setConfigLoading(true);
      const data = await backupApi.getConfig();
      setConfig(data);
      setLocalAutoEnabled(data.autoBackupEnabled);
      setLocalInterval(data.intervalDays);
    } catch (err) {
      console.error("Failed to load backup config:", err);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  /* ── Load history ─────────────────────────────────────────────────────── */

  const loadHistory = useCallback(async (page = 1, limit = pageSize) => {
    try {
      setHistoryLoading(true);
      const data = await backupApi.getHistory(page, limit);
      setRecords(data.records || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      console.error("Failed to load backup history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    loadConfig();
    loadHistory();
  }, [loadConfig, loadHistory]);

  /* ── Auto-refresh when a backup is in progress ────────────────────────── */

  useEffect(() => {
    const hasInProgress = records.some((r) => r.status === "in_progress");
    if (!hasInProgress) return;

    const interval = setInterval(() => loadHistory(pagination.page, pageSize), 3000);
    return () => clearInterval(interval);
  }, [records, pagination.page, loadHistory]);

  /* ── Save config ──────────────────────────────────────────────────────── */

  const handleSaveConfig = async () => {
    try {
      setConfigSaving(true);
      const data = await backupApi.updateConfig({
        autoBackupEnabled: localAutoEnabled,
        intervalDays: localInterval,
      });
      setConfig(data);
    } catch (err) {
      console.error("Failed to save backup config:", err);
    } finally {
      setConfigSaving(false);
    }
  };

  const configDirty =
    config &&
    (localAutoEnabled !== config.autoBackupEnabled || localInterval !== config.intervalDays);

  /* ── Trigger manual backup ────────────────────────────────────────────── */

  const handleTriggerBackup = () => {
    setConfirmModal({
      title: "Start Manual Backup",
      description:
        "This will create a full database backup immediately. The process may take a few minutes depending on database size.",
      confirmLabel: "Start Backup",
      danger: false,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          setTriggerLoading(true);
          await backupApi.triggerBackup();
          await loadHistory(1);
        } catch (err) {
          console.error("Failed to trigger backup:", err);
        } finally {
          setTriggerLoading(false);
        }
      },
    });
  };

  /* ── Download backup ──────────────────────────────────────────────────── */

  const handleDownload = async (record) => {
    try {
      const blob = await backupApi.downloadBackup(record.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = record.fileName || "backup.gz";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download backup:", err);
    }
  };

  /* ── Delete backup ────────────────────────────────────────────────────── */

  const handleDeleteClick = (record) => {
    setConfirmModal({
      title: "Delete Backup",
      description: `Are you sure you want to permanently delete the backup from ${fmtDate(record.createdAt)}? This will also remove the backup file from the server.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await backupApi.deleteBackup(record.id);
          await loadHistory(pagination.page);
        } catch (err) {
          console.error("Failed to delete backup:", err);
        }
      },
    });
  };

  /* ── Restore backup ──────────────────────────────────────────────────── */

  const handleRestoreClick = (record) => {
    setRestoreModal(record);
  };

  const handleRestoreConfirm = async () => {
    if (!restoreModal) return;
    const recordId = restoreModal.id;
    setRestoreModal(null);
    try {
      setRestoreLoading(true);
      await backupApi.restoreBackup(recordId);
      await loadHistory(1);
    } catch (err) {
      console.error("Failed to restore backup:", err);
    } finally {
      setRestoreLoading(false);
    }
  };

  /* ── Upload & Restore ────────────────────────────────────────────────── */

  const handleUploadRestore = async (file) => {
    setUploadModal(false);
    try {
      setUploadLoading(true);
      await backupApi.uploadAndRestore(file);
      await loadHistory(1);
    } catch (err) {
      console.error("Failed to upload and restore:", err);
    } finally {
      setUploadLoading(false);
    }
  };

  /* ── Render ───────────────────────────────────────────────────────────── */

  const isBackupRunning = records.some((r) => r.status === "in_progress");
  const isAnyOperationRunning = isBackupRunning || restoreLoading || uploadLoading;

  if (configLoading && historyLoading && records.length === 0) {
    return <AdminTablePageSkeleton />;
  }

  return (
    <div className="backup-page">
      {/* Header */}
      <div className="backup-page__header">
        <h1 className="backup-page__title">
          <Database size={24} className="backup-page__title-icon" />
          System Backup
        </h1>
        <p className="backup-page__subtitle">
          Configure automatic backups or create manual snapshots of the entire database.
        </p>
      </div>

      {/* Configuration Card */}
      <div className="backup-config-card">
        <h2 className="backup-config-card__title">
          <Settings size={16} className="backup-config-card__title-icon" />
          Backup Configuration
        </h2>

        {configLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="backup-skeleton" style={{ width: "100%", height: 56 }} />
            <div className="backup-skeleton" style={{ width: "60%", height: 40 }} />
          </div>
        ) : (
          <>
            <div className="backup-config-grid">
              {/* Auto-backup toggle */}
              <div className="backup-toggle-row">
                <div className="backup-toggle-label">
                  <span className="backup-toggle-label__main">Automatic Backup</span>
                  <span className="backup-toggle-label__hint">
                    {localAutoEnabled ? "Backups run on schedule" : "Backups are manual only"}
                  </span>
                </div>
                <label className="backup-toggle-switch">
                  <input
                    type="checkbox"
                    checked={localAutoEnabled}
                    onChange={(e) => setLocalAutoEnabled(e.target.checked)}
                  />
                  <span className="backup-toggle-switch__track" />
                </label>
              </div>

              {/* Interval selector */}
              <div className="backup-interval-group">
                <span className="backup-interval-group__label">Backup Frequency</span>
                <select
                  className="backup-interval-select"
                  value={localInterval}
                  onChange={(e) => setLocalInterval(Number(e.target.value))}
                  disabled={!localAutoEnabled}
                >
                  {INTERVAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions bar */}
            <div className="backup-actions">
              <div className="backup-actions__info">
                {config?.lastAutoBackupAt ? (
                  <span className="backup-actions__last-backup">
                    Last auto-backup: <strong>{fmtDate(config.lastAutoBackupAt)}</strong>
                  </span>
                ) : (
                  <span className="backup-actions__last-backup">No automatic backup has run yet.</span>
                )}
              </div>

              {configDirty && (
                <button
                  type="button"
                  className="backup-btn backup-btn--secondary"
                  onClick={handleSaveConfig}
                  disabled={configSaving}
                >
                  {configSaving ? (
                    <>
                      <RefreshCw size={14} style={{ animation: "backup-spin 0.8s linear infinite" }} />
                      Saving…
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              )}

              <button
                type="button"
                className="backup-btn backup-btn--primary"
                onClick={handleTriggerBackup}
                disabled={triggerLoading || isAnyOperationRunning}
              >
                {triggerLoading || isBackupRunning ? (
                  <>
                    <RefreshCw size={14} style={{ animation: "backup-spin 0.8s linear infinite" }} />
                    {isBackupRunning ? "Backup Running…" : "Starting…"}
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Backup Now
                  </>
                )}
              </button>

              <button
                type="button"
                className="backup-btn backup-btn--warning"
                onClick={() => setUploadModal(true)}
                disabled={isAnyOperationRunning}
              >
                {uploadLoading ? (
                  <>
                    <RefreshCw size={14} style={{ animation: "backup-spin 0.8s linear infinite" }} />
                    Restoring…
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Upload & Restore
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* History Card */}
      <div className="backup-history-card">
        <div className="backup-history-card__header">
          <h2 className="backup-history-card__title">
            <History size={16} className="backup-history-card__title-icon" />
            Backup History
          </h2>
          <button
            type="button"
            className="backup-btn backup-btn--secondary backup-btn--sm"
            onClick={() => loadHistory(pagination.page)}
            disabled={historyLoading}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {historyLoading && records.length === 0 ? (
          <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="backup-skeleton" style={{ height: 42 }} />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="backup-empty-state">
            <div className="backup-empty-state__icon">
              <HardDrive size={22} />
            </div>
            <div className="backup-empty-state__title">No backups yet</div>
            <div className="backup-empty-state__desc">
              Create your first backup by clicking &ldquo;Backup Now&rdquo; above, or enable automatic backups.
            </div>
          </div>
        ) : (
          <>
            <table className="backup-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Size</th>
                  <th>Duration</th>
                  <th>Triggered By</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{fmtDate(record.createdAt)}</td>
                    <td>
                      <TypeBadge type={record.type} />
                    </td>
                    <td>
                      <StatusBadge status={record.status} />
                    </td>
                    <td>
                      {record.status === "completed"
                        ? record.type === "restore"
                          ? `${record.totalDocuments?.toLocaleString() || 0} docs`
                          : record.fileSizeFormatted
                        : "—"}
                    </td>
                    <td>{fmtDuration(record.durationMs)}</td>
                    <td style={{ fontSize: "var(--font-size-sm)", color: "var(--muted-foreground)" }}>
                      {fmtTriggeredBy(record.triggeredBy)}
                    </td>
                    <td>
                      <div className="backup-table-actions" style={{ justifyContent: "flex-end" }}>
                        {record.status === "completed" && record.type !== "restore" && (
                          <button
                            type="button"
                            className="backup-btn backup-btn--secondary backup-btn--sm"
                            onClick={() => handleDownload(record)}
                            title="Download backup"
                          >
                            <Download size={12} />
                          </button>
                        )}
                        {record.status === "completed" && record.type !== "restore" && (
                          <button
                            type="button"
                            className="backup-btn backup-btn--warning backup-btn--sm"
                            onClick={() => handleRestoreClick(record)}
                            title="Restore database from this backup"
                            disabled={isAnyOperationRunning}
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                        {record.status !== "in_progress" && (
                          <button
                            type="button"
                            className="backup-btn backup-btn--danger backup-btn--sm"
                            onClick={() => handleDeleteClick(record)}
                            title="Delete backup"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        {record.status === "failed" && record.error && (
                          <span title={record.error} style={{ cursor: "help" }}>
                            <AlertTriangle size={14} color="var(--danger)" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="backup-pagination">
              <div className="backup-pagination__left">
                <label className="backup-pagination__size-label">
                  Rows per page:
                  <select
                    className="backup-pagination__size-select"
                    value={pageSize}
                    onChange={(e) => {
                      const newSize = Number(e.target.value);
                      setPageSize(newSize);
                      loadHistory(1, newSize);
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </label>
                <span className="backup-pagination__info">
                  {pagination.total === 0
                    ? "No records"
                    : `${(pagination.page - 1) * pageSize + 1}–${Math.min(pagination.page * pageSize, pagination.total)} of ${pagination.total}`}
                </span>
              </div>
              <div className="backup-pagination__buttons">
                <button
                  type="button"
                  className="backup-btn backup-btn--secondary backup-btn--sm"
                  disabled={pagination.page <= 1}
                  onClick={() => loadHistory(pagination.page - 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="backup-pagination__page-indicator">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  className="backup-btn backup-btn--secondary backup-btn--sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadHistory(pagination.page + 1)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          description={confirmModal.description}
          confirmLabel={confirmModal.confirmLabel}
          danger={confirmModal.danger}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {/* Restore Confirm Modal */}
      {restoreModal && (
        <RestoreConfirmModal
          record={restoreModal}
          onConfirm={handleRestoreConfirm}
          onCancel={() => setRestoreModal(null)}
        />
      )}

      {/* Upload Restore Modal */}
      {uploadModal && (
        <UploadRestoreModal
          onConfirm={handleUploadRestore}
          onCancel={() => setUploadModal(false)}
        />
      )}
    </div>
  );
}
