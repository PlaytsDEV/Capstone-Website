import { useCallback, useEffect, useMemo, useState } from "react";
import { FilePlus2, FileSignature, RefreshCw, Search } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { contractApi } from "../../../shared/api/contractApi";
import { useAuth } from "../../../shared/hooks/useAuth";
import { DataTable, PageShell, StatusBadge } from "../components/shared";
import ContractDetailDrawer from "../components/contracts/ContractDetailDrawer";
import CreateContractDraftModal from "../components/contracts/CreateContractDraftModal";
import {
  contractMatchesFilters,
  CONTRACT_STAGE_GROUPS,
  formatContractValue,
  getContractErrorMessage,
  getContractNextAction,
  getContractStage,
} from "../utils/contractUi.mjs";
import "../styles/admin-contracts.css";

const PAGE_SIZE = 12;
const ALL = "all";
const fmtDate = (value) => value
  ? new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
  : "—";

export default function AdminContractsPage() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(searchParams.get("create") === "true");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    search: "", branch: ALL, status: ALL, roomType: ALL, leaseType: ALL, archive: "active",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await contractApi.listContracts({
        status: filters.status,
        archive: filters.archive,
        branch: isOwner ? filters.branch : undefined,
        limit: 100,
      });
      setContracts(payload.contracts || []);
    } catch (requestError) {
      setError(getContractErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.branch, filters.archive, isOwner]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filters]);

  const filtered = useMemo(
    () => contracts.filter((item) => contractMatchesFilters(item, filters)),
    [contracts, filters],
  );
  const selectedId = contractId || searchParams.get("contractId");

  const openContract = (item) => navigate(`/admin/contracts/${item._id || item.id}`);
  const closeContract = () => navigate("/admin/contracts");
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const columns = [
    { key: "contractNumber", label: "Contract No.", sortable: true, render: (row) => <strong className="contract-number">{row.contractNumber || "Pending"}</strong> },
    { key: "tenantLegalName", label: "Tenant", sortable: true },
    ...(isOwner ? [{ key: "branch", label: "Branch", render: (row) => formatContractValue(row.branch) }] : []),
    { key: "roomNumber", label: "Room / Bed", render: (row) => <span>{row.roomNumber || "—"}<small className="contract-table-sub">{row.bedLabel || "No bed label"}</small></span> },
    { key: "status", label: "Current Stage", render: (row) => <StatusBadge status={row.status} label={getContractStage(row.status)} /> },
    ...(filters.archive === "archived" ? [
      { key: "archivedPreviousStatus", label: "Original Status", render: (row) => formatContractValue(row.archivedPreviousStatus) },
      { key: "archiveReason", label: "Archive Reason" },
      { key: "archivedAt", label: "Archived", render: (row) => fmtDate(row.archivedAt) },
      { key: "archivedBy", label: "Archived By", render: (row) =>
        [row.archivedBy?.firstName, row.archivedBy?.lastName].filter(Boolean).join(" ") ||
        row.archivedBy?.email || "—" },
      { key: "duplicateOfContractId", label: "Canonical Contract", render: (row) =>
        row.duplicateOfContractId?.contractNumber || "—" },
    ] : []),
    { key: "nextAction", label: "Next Action", render: (row) => <strong className="contract-next-action">{getContractNextAction(row.status)}</strong> },
    { key: "updatedAt", label: "Updated", sortable: true, render: (row) => fmtDate(row.updatedAt) },
  ];

  return (
    <div className="contract-workspace">
      <div className="contract-page-heading">
        <div><h2>Contracts</h2><p>Create, verify, and manage prepared lease Contract copies from official templates.</p></div>
        <button className="contract-button" type="button" onClick={() => setCreateOpen(true)}><FilePlus2 size={17} />Create Contract Draft</button>
      </div>
      <PageShell>
        <PageShell.Actions>
          <div className="contract-filter-bar">
            <label className="contract-search"><Search size={16} /><input aria-label="Search contracts" placeholder="Contract number or tenant name" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} /></label>
            <select aria-label="Contract archive view" value={filters.archive} onChange={(event) => updateFilter("archive", event.target.value)}>
              <option value="active">Active Contracts</option>
              <option value="archived">Archived Contracts</option>
              <option value="all">All Contracts</option>
            </select>
            {isOwner && <select aria-label="Branch" value={filters.branch} onChange={(event) => updateFilter("branch", event.target.value)}><option value={ALL}>All branches</option><option value="gil_puyat">Gil Puyat</option><option value="guadalupe">Guadalupe</option></select>}
            <select aria-label="Status" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value={ALL}>All Statuses</option>{Object.entries(CONTRACT_STAGE_GROUPS).map(([key, group]) => <option key={key} value={key}>{group.label}</option>)}</select>
            <select aria-label="Room type" value={filters.roomType} onChange={(event) => updateFilter("roomType", event.target.value)}><option value={ALL}>All room types</option><option value="private">Private Room</option><option value="double_sharing">Double Sharing</option><option value="quadruple_sharing">Quadruple Sharing</option></select>
            <select aria-label="Lease type" value={filters.leaseType} onChange={(event) => updateFilter("leaseType", event.target.value)}><option value={ALL}>All lease types</option><option value="short_term">Short Term</option><option value="long_term">Long Term</option></select>
            <button className="contract-icon-button" type="button" onClick={load} aria-label="Refresh contracts"><RefreshCw size={16} /></button>
          </div>
        </PageShell.Actions>
        <PageShell.Content>
          {error && <div className="contract-alert contract-alert--error">{error}<button type="button" onClick={load}>Retry</button></div>}
          <div className="contract-table-card">
            <DataTable
              columns={columns}
              data={filtered}
              loading={loading}
              onRowClick={openContract}
              pagination={{ page, pageSize: PAGE_SIZE, total: filtered.length, onPageChange: setPage }}
              emptyState={{ icon: FileSignature, title: filters.archive === "archived" ? "No archived Contracts found" : "No Contracts found", description: filters.archive === "archived" ? "Archived and voided Contracts remain available here for authorized audit review." : "Create a draft from an eligible resident reservation to begin." }}
            />
          </div>
        </PageShell.Content>
      </PageShell>
      <CreateContractDraftModal
        open={createOpen}
        branch={isOwner ? undefined : user?.branch}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => { setCreateOpen(false); load(); navigate(`/admin/contracts/${created._id || created.id}`); }}
        onExisting={(id) => { setCreateOpen(false); navigate(`/admin/contracts/${id}`); }}
      />
      <ContractDetailDrawer contractId={selectedId} open={Boolean(selectedId)} onClose={closeContract} onChanged={load} />
    </div>
  );
}
