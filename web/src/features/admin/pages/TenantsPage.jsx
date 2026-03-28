import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { useAuth } from "../../../shared/hooks/useAuth";
import { useReservations } from "../../../shared/hooks/queries/useReservations";
import {
  PageShell,
  SummaryBar,
  ActionBar,
  DataTable,
  StatusBadge,
  DetailDrawer,
} from "../components/shared";
import "../styles/design-tokens.css";
import "../styles/admin-tenants.css";

const fmt = (branch) =>
  branch === "gil-puyat" ? "Gil Puyat" : branch === "guadalupe" ? "Guadalupe" : "N/A";

const fmtRoomType = (t) =>
  t === "private" ? "Private" : t === "double-sharing" ? "Double Sharing" : t === "quadruple-sharing" ? "Quad Sharing" : t || "—";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";

export default function TenantsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState(isOwner ? "all" : user?.branch || "all");
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Source of truth: checked-in reservations (these are the real tenants)
  const { data: reservationsData = [], isLoading } = useReservations();

  const tenants = useMemo(() => {
    const reservations = Array.isArray(reservationsData) ? reservationsData : [];

    // Only checked-in reservations = current tenants
    const checkedIn = reservations.filter((r) => r.status === "checked-in");

    return checkedIn.map((res) => {
      const u = res.userId || {};
      const firstName = u.firstName || res.firstName || "";
      const lastName = u.lastName || res.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim() || u.email || "Unknown";

      // Billing status → display status
      let tenantStatus = "Active";
      if (res.paymentStatus === "pending" || res.paymentStatus === "partial") {
        tenantStatus = "Overdue";
      }
      const room = res.roomId;
      if (res.checkOutDate) {
        const daysLeft = Math.ceil((new Date(res.checkOutDate) - new Date()) / 86_400_000);
        if (daysLeft <= 30 && daysLeft > 0) tenantStatus = "Moving Out";
        if (daysLeft <= 0) tenantStatus = "Overdue";
      }

      return {
        id: res._id,
        reservationId: res._id,
        reservationCode: res.reservationCode || "—",
        userId: u._id,
        name: fullName,
        initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?",
        email: u.email || "N/A",
        phone: res.mobileNumber || u.phone || "N/A",
        status: tenantStatus,
        room: room?.name || room?.roomNumber || "Not Assigned",
        roomId: room?._id,
        branch: fmt(room?.branch),
        branchRaw: room?.branch || "",
        floor: room?.floor || "—",
        roomType: fmtRoomType(room?.type),
        monthlyRent: res.monthlyRent || room?.price || null,
        moveIn: fmtDate(res.checkInDate),
        moveOut: fmtDate(res.checkOutDate),
        bed: res.selectedBed?.position ? `${res.selectedBed.position.charAt(0).toUpperCase()}${res.selectedBed.position.slice(1)} Bed` : "—",
        leaseDuration: res.leaseDuration ? `${res.leaseDuration} month${res.leaseDuration > 1 ? "s" : ""}` : "—",
        // From reservation form
        emergencyContact: res.emergencyContact?.name || "—",
        emergencyPhone: res.emergencyContact?.contactNumber || "—",
        emergencyRelation: res.emergencyContact?.relationship || "—",
        nationality: res.nationality || "—",
        maritalStatus: res.maritalStatus || "—",
        school: res.employment?.employerSchool || "—",
        occupation: res.employment?.occupation || "—",
      };
    });
  }, [reservationsData]);

  const stats = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter((t) => t.status === "Active").length,
    overdue: tenants.filter((t) => t.status === "Overdue").length,
    movingOut: tenants.filter((t) => t.status === "Moving Out").length,
  }), [tenants]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return tenants.filter((t) => {
      const matchSearch = !term || t.name.toLowerCase().includes(term) || t.email.toLowerCase().includes(term) || t.room.toLowerCase().includes(term) || t.reservationCode.toLowerCase().includes(term);
      const matchStatus = statusFilter === "all" || t.status.toLowerCase() === statusFilter;
      const matchBranch = branchFilter === "all" || t.branchRaw === branchFilter || t.branch.toLowerCase().includes(branchFilter);
      return matchSearch && matchStatus && matchBranch;
    });
  }, [searchTerm, statusFilter, branchFilter, tenants]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const summaryItems = [
    { label: "Total Tenants", value: stats.total, color: "blue" },
    { label: "Active", value: stats.active, color: "green" },
    { label: "Overdue", value: stats.overdue, color: "red" },
    { label: "Moving Out Soon", value: stats.movingOut, color: "orange" },
  ];

  const filters = [
    ...(isOwner ? [{
      key: "branch",
      options: [
        { value: "all", label: "All Branches" },
        { value: "gil-puyat", label: "Gil Puyat" },
        { value: "guadalupe", label: "Guadalupe" },
      ],
      value: branchFilter,
      onChange: setBranchFilter,
    }] : []),
    {
      key: "status",
      options: [
        { value: "all", label: "All Status" },
        { value: "active", label: "Active" },
        { value: "overdue", label: "Overdue" },
        { value: "moving out", label: "Moving Out" },
      ],
      value: statusFilter,
      onChange: setStatusFilter,
    },
  ];

  const columns = [
    {
      key: "name",
      label: "Tenant",
      sortable: true,
      render: (row) => (
        <div className="tenant-cell">
          <div className="tenant-cell__avatar">{row.initials}</div>
          <div className="tenant-cell__info">
            <span className="tenant-cell__name">{row.name}</span>
            <span className="tenant-cell__email">{row.email}</span>
          </div>
        </div>
      ),
    },
    { key: "room", label: "Room", sortable: true },
    ...(isOwner ? [{ key: "branch", label: "Branch", sortable: true }] : []),
    { key: "roomType", label: "Type", sortable: true },
    { key: "bed", label: "Bed" },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    { key: "moveIn", label: "Move In", sortable: true },
    { key: "moveOut", label: "Move Out", sortable: true },
  ];

  return (
    <PageShell>
      <PageShell.Summary>
        <SummaryBar items={summaryItems} />
      </PageShell.Summary>

      <PageShell.Actions>
        <ActionBar
          search={{ value: searchTerm, onChange: setSearchTerm, placeholder: "Search by name, email, room, or code..." }}
          filters={filters}
        />
      </PageShell.Actions>

      <PageShell.Content>
        <DataTable
          columns={columns}
          data={paginated}
          loading={isLoading}
          onRowClick={setSelectedTenant}
          pagination={{
            page: currentPage,
            pageSize: itemsPerPage,
            total: filtered.length,
            onPageChange: setCurrentPage,
          }}
          emptyState={{
            icon: Users,
            title: "No checked-in tenants",
            description: "Tenants appear here once an admin completes their check-in.",
          }}
        />

        <DetailDrawer
          open={!!selectedTenant}
          onClose={() => setSelectedTenant(null)}
          title="Tenant Details"
        >
          {selectedTenant && (
            <>
              <DetailDrawer.Section label="Personal Info">
                <DetailDrawer.Row label="Full Name" value={selectedTenant.name} />
                <DetailDrawer.Row label="Email" value={selectedTenant.email} />
                <DetailDrawer.Row label="Phone" value={selectedTenant.phone} />
                <DetailDrawer.Row label="Nationality" value={selectedTenant.nationality} />
                <DetailDrawer.Row label="Civil Status" value={selectedTenant.maritalStatus} />
              </DetailDrawer.Section>

              <DetailDrawer.Section label="Accommodation">
                <DetailDrawer.Row label="Reservation" value={selectedTenant.reservationCode} />
                <DetailDrawer.Row label="Room" value={selectedTenant.room} />
                <DetailDrawer.Row label="Branch" value={selectedTenant.branch} />
                <DetailDrawer.Row label="Floor" value={String(selectedTenant.floor)} />
                <DetailDrawer.Row label="Room Type" value={selectedTenant.roomType} />
                <DetailDrawer.Row label="Bed" value={selectedTenant.bed} />
                <DetailDrawer.Row label="Lease Duration" value={selectedTenant.leaseDuration} />
                <DetailDrawer.Row label="Monthly Rent">
                  {selectedTenant.monthlyRent
                    ? `₱${Number(selectedTenant.monthlyRent).toLocaleString()}`
                    : "—"}
                </DetailDrawer.Row>
                <DetailDrawer.Row label="Move In" value={selectedTenant.moveIn} />
                <DetailDrawer.Row label="Move Out" value={selectedTenant.moveOut} />
                <DetailDrawer.Row label="Status">
                  <StatusBadge status={selectedTenant.status} />
                </DetailDrawer.Row>
              </DetailDrawer.Section>

              <DetailDrawer.Section label="Emergency Contact">
                <DetailDrawer.Row label="Name" value={selectedTenant.emergencyContact} />
                <DetailDrawer.Row label="Phone" value={selectedTenant.emergencyPhone} />
                <DetailDrawer.Row label="Relationship" value={selectedTenant.emergencyRelation} />
              </DetailDrawer.Section>

              <DetailDrawer.Section label="Employment / School">
                <DetailDrawer.Row label="Employer / School" value={selectedTenant.school} />
                <DetailDrawer.Row label="Occupation" value={selectedTenant.occupation} />
              </DetailDrawer.Section>
            </>
          )}
        </DetailDrawer>
      </PageShell.Content>
    </PageShell>
  );
}
