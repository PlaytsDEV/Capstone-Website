import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { reservationApi } from "../../../../shared/api/apiClient";
import { contractApi } from "../../../../shared/api/contractApi";
import { getContractErrorMessage } from "../../utils/contractUi.mjs";

export default function CreateContractDraftModal({ open, branch, onClose, onCreated, onExisting }) {
  const [tenants, setTenants] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existingContract, setExistingContract] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setExistingContract(null);
    reservationApi.getTenantWorkspace({ branch })
      .then((payload) => setTenants(payload?.tenants || []))
      .catch((requestError) => setError(getContractErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [open, branch]);

  const selected = useMemo(
    () => tenants.find((tenant) => tenant.reservationId === selectedId),
    [tenants, selectedId],
  );

  if (!open) return null;

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await contractApi.createContractDraft({
        reservationId: selected.reservationId,
        stayId: selected.currentStayId || undefined,
      });
      onCreated(response.contract);
    } catch (requestError) {
      const payload = requestError?.response?.data;
      if (payload?.code === "DUPLICATE_CONTRACT" && payload?.details?.existingContract?.id) {
        setExistingContract(payload.details.existingContract);
      } else {
        setError(getContractErrorMessage(requestError));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="contract-modal-backdrop" role="presentation">
      <div className="contract-modal" role="dialog" aria-modal="true" aria-label="Create Contract Draft">
        <header>
          <div>
            <h2>Create Contract Draft</h2>
            <p>Select an eligible tenant. All legal and lease values are resolved by the backend.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </header>
        <div className="contract-modal__body">
          <label className="contract-field">
            <span>Tenant / Reservation</span>
            <select value={selectedId} onChange={(event) => {
              setSelectedId(event.target.value);
              setExistingContract(null);
              setError("");
            }} disabled={loading}>
              <option value="">{loading ? "Loading eligible tenants…" : "Select a tenant"}</option>
              {tenants.map((tenant) => (
                <option key={tenant.reservationId} value={tenant.reservationId}>
                  {tenant.tenantName} — {tenant.room || "No room"} ({tenant.branch})
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <div className="contract-readonly-grid">
              <span><small>Tenant</small>{selected.tenantName}</span>
              <span><small>Branch</small>{selected.branch}</span>
              <span><small>Room / Bed</small>{selected.room} / {selected.bed || "—"}</span>
              <span><small>Lease Start</small>{selected.moveInDate ? new Date(selected.moveInDate).toLocaleDateString() : "—"}</span>
              <span><small>Lease End</small>{selected.leaseEndDate ? new Date(selected.leaseEndDate).toLocaleDateString() : "—"}</span>
              <span><small>Approved Monthly Rate</small>{selected.financialSummary?.monthlyRate != null ? `₱${Number(selected.financialSummary.monthlyRate).toLocaleString()}` : "—"}</span>
            </div>
          )}
          {error && <div className="contract-alert contract-alert--error">{error}</div>}
          {existingContract && <div className="contract-alert contract-alert--warning">
            <strong>Contract Already Exists</strong>
            <p>A contract has already been created for this reservation or stay. Use the existing Contract instead of creating another draft.</p>
            <dl>
              <dt>Contract No.</dt><dd>{existingContract.contractNumber}</dd>
              <dt>Current Stage</dt><dd>{String(existingContract.status || "").replaceAll("_", " ")}</dd>
              <dt>Tenant</dt><dd>{existingContract.tenantName || "—"}</dd>
              <dt>Branch</dt><dd>{String(existingContract.branch || "").replaceAll("_", " ")}</dd>
              <dt>Room / Bed</dt><dd>{[existingContract.roomNumber, existingContract.bedLabel].filter(Boolean).join(" / ") || "—"}</dd>
              <dt>Updated</dt><dd>{existingContract.updatedAt ? new Date(existingContract.updatedAt).toLocaleDateString() : "—"}</dd>
            </dl>
            <button className="contract-button" type="button"
              onClick={() => onExisting(existingContract.id)}>View Existing Contract</button>
          </div>}
        </div>
        <footer>
          <button type="button" className="contract-button contract-button--secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="contract-button" disabled={!selected || saving || Boolean(existingContract)} onClick={submit}>
            {saving ? "Creating…" : "Create Draft"}
          </button>
        </footer>
      </div>
    </div>
  );
}
