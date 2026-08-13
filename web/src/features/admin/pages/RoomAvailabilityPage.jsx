/**
 * RoomAvailabilityPage — Unified Room & Inventory Management Workspace
 * Consolidated Live Occupancy & Vacancy Forecast View
 */
import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LayoutGrid,
  Plus,
  Bed,
  Wrench,
  DoorOpen,
  Search,
  RotateCcw,
  X,
  FilterX,
  CheckCircle2,
  AlertTriangle,
  CircleDot,
  Layers,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";

// Components
import RoomConfigModal from "../components/rooms/RoomConfigModal";
import RoomFormModal from "../components/rooms/RoomFormModal";
import DeleteRoomModal from "../components/rooms/DeleteRoomModal";
import DoubleDeckRoomCard from "../components/rooms/DoubleDeckRoomCard";
import RoomBedHistoryDrawer from "../components/rooms/RoomBedHistoryDrawer";

// Hooks & API
import { useRooms } from "../../../shared/hooks/queries/useRooms";
import { useRoomStats } from "../../../shared/hooks/queries/useRoomStats";
import { useAuth } from "../../../shared/hooks/useAuth";
import { usePermissions } from "../../../shared/hooks/usePermissions";
import { roomApi } from "../../../shared/api/apiClient";
import { useQueryClient } from "@tanstack/react-query";
import { showNotification } from "../../../shared/utils/notification";
import { exportToCSV } from "../../../shared/utils/exportUtils";
import { OWNER_BRANCH_FILTER_OPTIONS } from "../../../shared/utils/constants";
import {
  normalizeBranchFilterValue,
  syncBranchSearchParam,
} from "../../../shared/utils/branchFilterQuery.mjs";
import { formatRoomType, formatBranch } from "../utils/formatters";
import { getBedDisplayLabel } from "../../../shared/utils/bedIdentifier";

// Styles
import "../styles/admin-room-availability.css";
import "../styles/admin-room-configuration.css";

const getEffectiveOccupancy = (room) => {
  if (!room) return 0;
  const occupiedFromBeds = (room.beds || []).filter(
    (b) => b.status === "occupied" || b.status === "reserved" || Boolean(b.occupiedBy?.userId)
  ).length;
  return Math.max(Number(room.currentOccupancy || 0), occupiedFromBeds);
};

function RoomAvailabilityPage() {
  const { can } = usePermissions();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const isOwner = user?.role === "owner";
  const [searchTerm, setSearchTerm] = useState("");
  const requestedBranch = searchParams.get("branch");
  const [branchFilter, setBranchFilter] = useState(() =>
    normalizeBranchFilterValue({
      requestedBranch: isOwner ? requestedBranch : null,
      fallbackBranch: isOwner ? null : user?.branch,
      allValue: "all",
    }),
  );
  const [floorFilter, setFloorFilter] = useState(() => searchParams.get("floor") || "all");
  const [roomTypeFilter, setRoomTypeFilter] = useState(() => searchParams.get("type") || "all");
  const [roomStatusFilter, setRoomStatusFilter] = useState(() => searchParams.get("status") || "all");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [deletingRoom, setDeletingRoom] = useState(null);
  const [historyRoomId, setHistoryRoomId] = useState(null);
  const [showVacancyModal, setShowVacancyModal] = useState(false);
  const [vacancySearch, setVacancySearch] = useState("");
  const [vacancyUrgencyFilter, setVacancyUrgencyFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ROOMS_PER_PAGE = 12;

  // Use the Digital Twin snapshot as a read model so bed dots and occupancy stay reservation-aware.
  // Always fetch the full scope allowed for the user (defaultBranch) to avoid API-level occupancy calculation bugs,
  // and rely entirely on client-side filtering for the branch selection.
  const defaultBranch =
    user?.branch && user.role !== "owner" ? user.branch : "all";
  const { data: roomsData, isLoading: loading } = useRooms(
    defaultBranch === "all" ? {} : { branch: defaultBranch },
  );
  const rooms = Array.isArray(roomsData) ? roomsData : (roomsData?.items ?? []);

  // Compute upcoming vacancies list for the quick-view modal/space
  const upcomingVacancies = useMemo(() => {
    const list = [];
    rooms.forEach((room) => {
      (room.beds || []).forEach((bed, bedIdx) => {
        const hasDate = Boolean(bed.expectedVacancyDate);
        const hasDays = bed.daysRemaining !== null && bed.daysRemaining !== undefined;
        if (hasDate || hasDays) {
          const formattedBedLabel = getBedDisplayLabel(bed, bedIdx, room.type);
          list.push({
            roomId: room._id,
            roomName: room.name || `Room ${room.roomNumber}`,
            roomNumber: room.roomNumber,
            branch: room.branch,
            floor: room.floor,
            bedId: bed.id,
            bedCode: bed.code || bed.id,
            bedPosition: bed.position,
            bedObj: bed,
            bedLabel: formattedBedLabel,
            occupantName:
              bed.occupiedBy?.name ||
              (bed.occupiedBy?.firstName || bed.occupiedBy?.lastName
                ? `${bed.occupiedBy?.firstName || ""} ${bed.occupiedBy?.lastName || ""}`.trim()
                : "Current Occupant"),
            expectedVacancyDate: bed.expectedVacancyDate,
            daysRemaining: bed.daysRemaining,
            roomObj: room,
          });
        }
      });
    });

    return list.sort((a, b) => {
      if (a.daysRemaining != null && b.daysRemaining != null) {
        return a.daysRemaining - b.daysRemaining;
      }
      if (a.expectedVacancyDate && b.expectedVacancyDate) {
        return new Date(a.expectedVacancyDate) - new Date(b.expectedVacancyDate);
      }
      return 0;
    });
  }, [rooms]);

  const vacancyKPIs = useMemo(() => {
    let urgent = 0;
    let upcoming = 0;
    let longTerm = 0;
    upcomingVacancies.forEach((v) => {
      const d = v.daysRemaining;
      if (d != null) {
        if (d <= 30) urgent++;
        else if (d <= 90) upcoming++;
        else longTerm++;
      } else {
        longTerm++;
      }
    });
    return { urgent, upcoming, longTerm, total: upcomingVacancies.length };
  }, [upcomingVacancies]);

  const filteredUpcomingVacancies = useMemo(() => {
    return upcomingVacancies.filter((item) => {
      const term = vacancySearch.trim().toLowerCase();
      const matchesSearch =
        !term ||
        item.roomName.toLowerCase().includes(term) ||
        item.roomNumber.toLowerCase().includes(term) ||
        item.bedCode.toLowerCase().includes(term) ||
        (item.bedLabel && item.bedLabel.toLowerCase().includes(term)) ||
        item.occupantName.toLowerCase().includes(term);

      const days = item.daysRemaining;
      let matchesUrgency = true;
      if (vacancyUrgencyFilter === "urgent") {
        matchesUrgency = days != null ? days <= 30 : false;
      } else if (vacancyUrgencyFilter === "upcoming") {
        matchesUrgency = days != null ? days > 30 && days <= 90 : false;
      } else if (vacancyUrgencyFilter === "longterm") {
        matchesUrgency = days != null ? days > 90 : true;
      }

      return matchesSearch && matchesUrgency;
    });
  }, [upcomingVacancies, vacancySearch, vacancyUrgencyFilter]);

  const [vacancyPage, setVacancyPage] = useState(1);
  const VACANCIES_PER_PAGE = 10;

  useEffect(() => {
    setVacancyPage(1);
  }, [vacancySearch, vacancyUrgencyFilter]);

  const totalVacancyPages = Math.ceil(filteredUpcomingVacancies.length / VACANCIES_PER_PAGE) || 1;

  const paginatedUpcomingVacancies = useMemo(() => {
    const start = (vacancyPage - 1) * VACANCIES_PER_PAGE;
    return filteredUpcomingVacancies.slice(start, start + VACANCIES_PER_PAGE);
  }, [filteredUpcomingVacancies, vacancyPage]);

  // Processing
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch =
        room.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.roomNumber?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBranch =
        branchFilter === "all" || room.branch === branchFilter;
      const matchesFloor =
        floorFilter === "all" || String(room.floor) === floorFilter;
      const matchesType =
        roomTypeFilter === "all" || room.type === roomTypeFilter;

      const matchesStatus =
        roomStatusFilter === "all" ||
        (roomStatusFilter === "vacant_soon"
          ? (room.beds || []).some(
              (b) =>
                (b.daysRemaining !== null && b.daysRemaining !== undefined && b.daysRemaining <= 30) ||
                (b.expectedVacancyDate &&
                  new Date(b.expectedVacancyDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
            )
          : (() => {
              const bedsInMaintenance = (room.beds || []).filter(
                (b) => b.status === "maintenance",
              ).length;
              const roomLevelMaintenance =
                bedsInMaintenance === room.capacity && room.capacity > 0;
              const effectiveCapacity = roomLevelMaintenance
                ? 0
                : room.capacity - bedsInMaintenance;

              const occupiedCount = getEffectiveOccupancy(room);
              let displayStatus = "available";
              if (roomLevelMaintenance) displayStatus = "maintenance";
              else if (
                occupiedCount >= effectiveCapacity &&
                effectiveCapacity > 0
              )
                displayStatus = "full";
              else if (occupiedCount > 0) displayStatus = "partial";
              return displayStatus === roomStatusFilter;
            })());

      return (
        matchesSearch &&
        matchesBranch &&
        matchesFloor &&
        matchesType &&
        matchesStatus
      );
    });
  }, [
    rooms,
    searchTerm,
    branchFilter,
    floorFilter,
    roomTypeFilter,
    roomStatusFilter,
  ]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    branchFilter,
    floorFilter,
    roomTypeFilter,
    roomStatusFilter,
  ]);

  useEffect(() => {
    const nextBranch = normalizeBranchFilterValue({
      requestedBranch: user?.role === "owner" ? requestedBranch : null,
      fallbackBranch: user?.role === "owner" ? null : user?.branch,
      allValue: "all",
    });

    setBranchFilter((current) =>
      current === nextBranch ? current : nextBranch,
    );
  }, [requestedBranch, user?.branch, user?.role]);

  useEffect(() => {
    if (!user?.role) return;

    const nextParams = syncBranchSearchParam(searchParams, branchFilter, {
      enabled: user?.role === "owner",
      allValue: "all",
    });

    if (nextParams.toString() === searchParams.toString()) return;
    setSearchParams(nextParams, { replace: true });
  }, [branchFilter, searchParams, setSearchParams, user?.role]);

  // Dynamically compute valid floor numbers for the currently selected branch
  const availableFloors = useMemo(() => {
    const branchRooms =
      branchFilter === "all"
        ? rooms
        : rooms.filter((r) => r.branch === branchFilter);
    const set = new Set();
    branchRooms.forEach((r) => {
      if (r.floor !== undefined && r.floor !== null && r.floor !== "") {
        set.add(String(r.floor));
      }
    });
    return Array.from(set).sort(
      (a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0),
    );
  }, [rooms, branchFilter]);

  // Cascading sanity reset: if selected floor is not in availableFloors, reset to "all"
  useEffect(() => {
    if (floorFilter !== "all" && !availableFloors.includes(floorFilter)) {
      setFloorFilter("all");
    }
  }, [availableFloors, floorFilter]);

  // Sync status, floor, and room type filter states to URL search parameters
  useEffect(() => {
    const currentStatus = searchParams.get("status") || "all";
    const currentFloor = searchParams.get("floor") || "all";
    const currentType = searchParams.get("type") || "all";

    if (
      currentStatus === roomStatusFilter &&
      currentFloor === floorFilter &&
      currentType === roomTypeFilter
    ) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (roomStatusFilter !== "all") nextParams.set("status", roomStatusFilter);
    else nextParams.delete("status");

    if (floorFilter !== "all") nextParams.set("floor", floorFilter);
    else nextParams.delete("floor");

    if (roomTypeFilter !== "all") nextParams.set("type", roomTypeFilter);
    else nextParams.delete("type");

    setSearchParams(nextParams, { replace: true });
  }, [roomStatusFilter, floorFilter, roomTypeFilter, searchParams, setSearchParams]);

  // Stats — shared hook (bed-accurate)
  const stats = useRoomStats(rooms);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim() !== "") count++;
    if (isOwner && branchFilter !== "all") count++;
    if (floorFilter !== "all") count++;
    if (roomTypeFilter !== "all") count++;
    if (roomStatusFilter !== "all") count++;
    return count;
  }, [searchTerm, isOwner, branchFilter, floorFilter, roomTypeFilter, roomStatusFilter]);

  const handleResetFilters = () => {
    setSearchTerm("");
    if (isOwner) setBranchFilter("all");
    setFloorFilter("all");
    setRoomTypeFilter("all");
    setRoomStatusFilter("all");
  };

  // Handlers
  const handleConfigure = (room) => {
    setSelectedRoom({
      ...room,
      beds: (room.beds || []).map((bed) => ({
        ...bed,
        originalId: bed.originalId || bed.id,
      })),
    });
  };

  const handleSaveConfig = async (updatedRoom) => {
    try {
      // 1. Update core room properties (images, amenities, policies, isPopular, pricing, etc.)
      await roomApi.update(updatedRoom._id, {
        name: updatedRoom.name,
        roomNumber: updatedRoom.roomNumber,
        description: updatedRoom.description,
        floor: updatedRoom.floor,
        branch: updatedRoom.branch,
        type: updatedRoom.type,
        capacity: updatedRoom.capacity,
        price: updatedRoom.price,
        monthlyPrice: updatedRoom.monthlyPrice,
        amenities: updatedRoom.amenities,
        policies: updatedRoom.policies,
        intendedTenant: updatedRoom.intendedTenant,
        images: updatedRoom.images,
        isPopular: updatedRoom.isPopular,
      });

      const originalRoom = rooms.find((room) => room._id === updatedRoom._id);
      const originalBeds = originalRoom?.beds || [];
      const updatedBeds = updatedRoom.beds || [];
      const originalById = new Map(originalBeds.map((bed) => [bed.id, bed]));
      const keptOriginalIds = new Set(
        updatedBeds.map((bed) => bed.originalId).filter(Boolean),
      );
      const removedBeds = originalBeds.filter(
        (bed) => !keptOriginalIds.has(bed.id),
      );
      const newBeds = updatedBeds.filter((bed) => !bed.originalId);
      const existingBeds = updatedBeds.filter((bed) => bed.originalId);

      for (const bed of removedBeds) {
        await roomApi.deleteBed(updatedRoom._id, bed.id);
      }

      for (const bed of existingBeds) {
        const previousBed = originalById.get(bed.originalId);
        if (!previousBed) continue;

        if (
          previousBed.id !== bed.id ||
          previousBed.position !== bed.position
        ) {
          await roomApi.updateBed(updatedRoom._id, previousBed.id, {
            id: bed.id,
            position: bed.position,
          });
        }

        if (
          (previousBed.status || "available") !== (bed.status || "available")
        ) {
          await roomApi.updateBedStatus(updatedRoom._id, bed.id, bed.status);
        }
      }

      for (const bed of newBeds) {
        await roomApi.addBed(updatedRoom._id, {
          id: bed.id,
          position: bed.position,
        });
        if (bed.status === "maintenance") {
          await roomApi.updateBedStatus(updatedRoom._id, bed.id, bed.status);
        }
      }

      await roomApi.reorderBeds(
        updatedRoom._id,
        updatedBeds.map((bed) => bed.id),
      );

      showNotification("Room configuration updated", "success");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setSelectedRoom(null);
    } catch (err) {
      showNotification(err.message || "Failed to update", "error");
    }
  };

  // CRUD handlers
  const handleSaveRoom = async (payload, roomId) => {
    try {
      if (roomId) {
        await roomApi.update(roomId, payload);
        showNotification("Room updated successfully", "success");
      } else {
        await roomApi.create(payload);
        showNotification("Room created successfully", "success");
      }
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setShowCreateModal(false);
      setEditingRoom(null);
    } catch (err) {
      showNotification(err.message || "Failed to save room", "error");
      throw err;
    }
  };

  const handleDeleteRoom = async (roomId) => {
    try {
      await roomApi.delete(roomId);
      showNotification("Room archived successfully", "success");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setDeletingRoom(null);
    } catch (err) {
      showNotification(err.message || "Failed to archive room", "error");
    }
  };

  const handleTabChange = (nextTab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", nextTab);
    setSearchParams(next);
  };

  const handleExportRooms = () => {
    exportToCSV(
      filteredRooms.map((room) => ({
        roomName: room.name,
        roomNumber: room.roomNumber,
        branch: formatBranch(room.branch),
        type: formatRoomType(room.type),
        floor: room.floor,
        capacity: room.capacity,
        currentOccupancy: getEffectiveOccupancy(room),
        status: String(room.type || "").toLowerCase().includes("private")
          ? `${Math.min(1, getEffectiveOccupancy(room))}/1`
          : `${getEffectiveOccupancy(room)}/${room.capacity || 0}`,
      })),
      [
        { key: "roomName", label: "Room Name" },
        { key: "roomNumber", label: "Room Number" },
        { key: "branch", label: "Branch" },
        { key: "type", label: "Type" },
        { key: "floor", label: "Floor" },
        { key: "capacity", label: "Capacity" },
        { key: "currentOccupancy", label: "Occupied" },
        { key: "status", label: "Occupancy" },
      ],
      "room-inventory",
    );
  };

  const roomFilters = [
    ...(isOwner
      ? [
          {
            key: "branch",
            label: "Branch",
            options: [
              { value: "all", label: "All Branches" },
              ...OWNER_BRANCH_FILTER_OPTIONS.filter((o) => o.value !== "all"),
            ],
            value: branchFilter,
            onChange: setBranchFilter,
          },
        ]
      : []),
    {
      key: "floor",
      label: "Floor",
      options: [
        { value: "all", label: "All Floors" },
        ...availableFloors.map((fl) => ({
          value: fl,
          label: `Floor ${fl}`,
        })),
      ],
      value: floorFilter,
      onChange: setFloorFilter,
    },
    {
      key: "type",
      label: "Type",
      options: [
        { value: "all", label: "All Types" },
        { value: "private", label: "Private" },
        { value: "double-sharing", label: "Double" },
        { value: "quadruple-sharing", label: "Quadruple" },
      ],
      value: roomTypeFilter,
      onChange: setRoomTypeFilter,
    },
  ];


  const roomStatusLegend = [
    { key: "available", label: "Available / Vacant", dot: "bg-emerald-500" },
    { key: "partial", label: "Partially Occupied", dot: "bg-amber-500" },
    { key: "full", label: "Full / Occupied Bed", dot: "bg-red-500" },
    { key: "reserved", label: "Reserved Bed", dot: "bg-amber-600" },
    { key: "maintenance", label: "Maintenance", dot: "bg-slate-500" },
  ];

  const getRoomStatusConfig = (status) => {
    switch (status) {
      case "available":
        return {
          dot: "bg-emerald-500",
          label: "Available",
          color: "text-emerald-600",
        };
      case "partial":
        return {
          dot: "bg-amber-500",
          label: "Partially Occupied",
          color: "text-warning-dark",
        };
      case "full":
        return { dot: "bg-red-500", label: "Full", color: "text-red-600" };
      case "maintenance":
        return {
          dot: "bg-slate-500",
          label: "Maintenance",
          color: "text-slate-600",
        };
      case "reserved":
        return {
          dot: "bg-blue-500",
          label: "Reserved",
          color: "text-blue-600",
        };
      default:
        return {
          dot: "bg-border",
          label: "Unknown",
          color: "text-muted-foreground",
        };
    }
  };

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredRooms.length / ROOMS_PER_PAGE));
  }, [filteredRooms]);

  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * ROOMS_PER_PAGE;
    return filteredRooms.slice(start, start + ROOMS_PER_PAGE);
  }, [filteredRooms, currentPage]);

  const groupedByFloor = useMemo(() => {
    const acc = {};
    paginatedRooms.forEach((room) => {
      const key = `Floor ${room.floor}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(room);
    });
    return acc;
  }, [paginatedRooms]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">
            Room Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Track available capacity, assignments, and turnover across rooms
            without leaving operations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowVacancyModal(true)}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold border flex items-center gap-2 bg-card hover:bg-muted transition-colors text-foreground border-border shadow-sm self-start md:self-auto"
          title="Check upcoming vacancy schedule for rooms and beds"
        >
          <Calendar className="w-4 h-4 text-amber-500" />
          <span>Check Vacancy Schedule</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
            {upcomingVacancies.length}
          </span>
        </button>
      </div>

      {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div
              className="rounded-lg p-3"
              style={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <DoorOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Total Rooms
                </span>
              </div>
              <div className="text-2xl font-semibold text-foreground">
                {stats.total}
              </div>
            </div>
            <div
              className="rounded-lg p-3"
              style={{
                backgroundColor: "var(--card)",

                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">Available</span>
              </div>
              <div className="text-2xl font-semibold text-foreground">
                {stats.available}
              </div>
            </div>
            <div
              className="rounded-lg p-3"
              style={{
                backgroundColor: "var(--card)",

                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs text-muted-foreground">Partial</span>
              </div>
              <div className="text-2xl font-semibold text-foreground">
                {stats.partial}
              </div>
            </div>
            <div
              className="rounded-lg p-3"
              style={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground">Full</span>
              </div>
              <div className="text-2xl font-semibold text-foreground">
                {stats.full}
              </div>
            </div>
            <div
              className="rounded-lg p-3"
              style={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-neutral-500" />
                <span className="text-xs text-muted-foreground">
                  Maintenance
                </span>
              </div>
              <div className="text-2xl font-semibold text-foreground">
                {stats.maintenance}
              </div>
            </div>
            <div
              className="rounded-lg p-3"
              style={{
                backgroundColor: "var(--card)",

                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Bed className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Beds</span>
              </div>
              <div className="text-2xl font-semibold text-foreground">
                {rooms.reduce((sum, r) => sum + (r.capacity || 0), 0)}
              </div>
            </div>
          </div>

          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: "var(--card)",

              border: "1px solid var(--border)",
            }}
          >
            {/* Optimized Toolbar with Preset Chips, Search, & Active Filter Controls */}
            <div className="flex flex-col gap-4 mb-6">
              {/* Quick Preset Filter Chips Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border/60">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">
                    Presets:
                  </span>
                  {[
                    { id: "all", label: "All Rooms", icon: LayoutGrid, count: rooms.length,
                      active: "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-950 dark:border-slate-100 shadow-sm",
                      inactive: "bg-card text-foreground border-border hover:bg-accent/50",
                      iconBgActive: "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-950",
                      iconBgInactive: "bg-muted text-muted-foreground",
                      countActive: "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-950",
                      countInactive: "bg-muted text-muted-foreground"
                    },
                    { id: "available", label: "Available", icon: CheckCircle2, count: stats.available,
                      active: "bg-emerald-600 text-white border-emerald-600 shadow-sm",
                      inactive: "bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 hover:bg-emerald-100/70",
                      iconBgActive: "bg-emerald-700/60 text-white",
                      iconBgInactive: "bg-emerald-200/70 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300",
                      countActive: "bg-white/20 text-white",
                      countInactive: "bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300"
                    },
                    { id: "partial", label: "Partial", icon: AlertTriangle, count: stats.partial,
                      active: "bg-amber-600 text-white border-amber-600 shadow-sm",
                      inactive: "bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 hover:bg-amber-100/70",
                      iconBgActive: "bg-amber-700/60 text-white",
                      iconBgInactive: "bg-amber-200/70 dark:bg-amber-900/80 text-amber-700 dark:text-amber-300",
                      countActive: "bg-white/20 text-white",
                      countInactive: "bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300"
                    },
                    { id: "full", label: "Full", icon: CircleDot, count: stats.full,
                      active: "bg-red-600 text-white border-red-600 shadow-sm",
                      inactive: "bg-red-50 text-red-800 border-red-200/80 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60 hover:bg-red-100/70",
                      iconBgActive: "bg-red-700/60 text-white",
                      iconBgInactive: "bg-red-200/70 dark:bg-red-900/80 text-red-700 dark:text-red-300",
                      countActive: "bg-white/20 text-white",
                      countInactive: "bg-red-200/60 dark:bg-red-900/60 text-red-800 dark:text-red-300"
                    },
                    { id: "maintenance", label: "Maintenance", icon: Wrench, count: stats.maintenance,
                      active: "bg-slate-700 text-white border-slate-700 shadow-sm",
                      inactive: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-200/60",
                      iconBgActive: "bg-slate-800/60 text-white",
                      iconBgInactive: "bg-slate-300/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
                      countActive: "bg-white/20 text-white",
                      countInactive: "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300"
                    },
                  ].map((preset) => {
                    const isActive = roomStatusFilter === preset.id;
                    const Icon = preset.icon;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setRoomStatusFilter(preset.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                          isActive ? preset.active : preset.inactive
                        }`}
                      >
                        <span className={`p-1 rounded-full flex items-center justify-center ${
                          isActive ? preset.iconBgActive : preset.iconBgInactive
                        }`}>
                          <Icon className="w-3 h-3" />
                        </span>
                        <span>{preset.label}</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          isActive ? preset.countActive : preset.countInactive
                        }`}>
                          {preset.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Clear All Filters Button */}
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear Filters ({activeFilterCount})</span>
                  </button>
                )}
              </div>

              {/* Search Bar & Dropdown Select Controls */}
              <div className="flex flex-col lg:flex-row gap-3 items-end">
                {/* Enhanced Search Input with Micro-Label */}
                <div className="flex-1 flex flex-col gap-1 min-w-[240px]">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-0.5">
                    Search
                  </label>
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by room number or type..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-9 pl-9 pr-10 bg-card rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 placeholder:text-muted-foreground/70"
                      style={{ border: "1px solid var(--border)" }}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded"
                        title="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Dropdowns & Add Room Button */}
                <div className="flex gap-2.5 flex-wrap items-end">
                  {roomFilters.map((filter) => {
                    const isActive = filter.value !== "all";
                    return (
                      <div key={filter.key} className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-0.5">
                          {filter.label}
                        </label>
                        <select
                          aria-label={`Filter rooms by ${filter.label}`}
                          value={filter.value}
                          onChange={(e) => filter.onChange(e.target.value)}
                          className={`h-9 px-3 rounded-lg text-xs font-medium cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-ring/20 ${
                            isActive
                              ? "bg-primary-50/60 dark:bg-primary-950/30 text-foreground font-semibold shadow-sm"
                              : "bg-card text-foreground hover:bg-accent/40"
                          }`}
                          style={{
                            border: isActive
                              ? "1px solid var(--primary)"
                              : "1px solid var(--border)",
                          }}
                        >
                          {filter.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}

                  {can("manageRooms") && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="h-9 px-4 text-primary-foreground rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 text-xs bg-primary hover:opacity-90 ml-auto lg:ml-0 self-end shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add Room
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Redesigned Multi-Category Status Legend Bar */}
            <div className="mb-5 rounded-xl p-3.5 border border-border bg-card shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                
                {/* Room Status Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold uppercase tracking-wider text-muted-foreground mr-1 text-[11px]">
                    Room Status:
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Available
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Partial
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    Full
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    Maintenance
                  </span>
                </div>

                {/* Bed Deck Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-2.5 lg:pt-0 border-t lg:border-t-0 lg:border-l border-border lg:pl-3.5">
                  <span className="font-bold uppercase tracking-wider text-muted-foreground mr-1 text-[11px]">
                    Bed Layout:
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Vacant
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded bg-red-600 dark:bg-red-700 text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-200" />
                    Occupied
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-[#D4AF37] text-slate-950">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-800" />
                    Reserved
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Payment Pending
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    Maint
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground ml-1">
                    <Wrench className="w-3.5 h-3.5 text-amber-500" />
                    <span>Beds in Maint</span>
                  </span>
                </div>

              </div>
            </div>

            {/* Room List or Empty State */}
            {filteredRooms.length === 0 ? (
              <div className="p-12 text-center rounded-xl border border-dashed border-border bg-muted/20 my-6 flex flex-col items-center justify-center gap-3">
                <div className="p-3 rounded-full bg-muted/60 text-muted-foreground">
                  <FilterX className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-foreground">No matching rooms found</h4>
                <p className="text-sm text-muted-foreground max-w-sm">
                  We couldn't find any rooms matching your search term or active filter criteria.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground shadow-sm hover:opacity-90"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-8 mt-2">
                {Object.keys(groupedByFloor).length > 0 ? (
                  Object.entries(groupedByFloor).map(([floor, floorRooms]) => {
                    const availableInFloor = floorRooms.filter((r) => {
                      const mBeds = (r.beds || []).filter(
                        (b) => b.status === "maintenance",
                      ).length;
                      const isFullMaint = mBeds === r.capacity && r.capacity > 0;
                      const effectiveCapacity = isFullMaint ? 0 : r.capacity - mBeds;
                      return getEffectiveOccupancy(r) < effectiveCapacity && effectiveCapacity > 0;
                    }).length;
                    return (
                      <div key={floor} className="space-y-3">
                        {/* High-Contrast Emphasized Floor Section Header */}
                        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-card border border-border shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                              <Layers className="w-4 h-4" />
                            </div>
                            <h3 className="text-sm font-bold text-foreground tracking-wide">
                              {floor}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted/60 text-muted-foreground border border-border/60">
                              {floorRooms.length} {floorRooms.length === 1 ? "room" : "rooms"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span
                              className={`font-semibold px-2.5 py-0.5 rounded-full border ${
                                availableInFloor > 0
                                  ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/50"
                                  : "text-muted-foreground bg-muted/60 border-border/60"
                              }`}
                            >
                              {availableInFloor} Available
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
                          {floorRooms.map((room) => (
                            <DoubleDeckRoomCard
                              key={room._id || room.id}
                              room={room}
                              onConfigure={handleConfigure}
                              onViewHistory={(id) => setHistoryRoomId(id)}
                              canManageRooms={can("manageRooms")}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : null}
              </div>
            )}

            {/* Bottom Summary & Fast Page Controls Footer */}
            {filteredRooms.length > 0 && (
              <div className="flex items-center justify-between flex-wrap gap-3 pt-4 mt-6 px-1 border-t border-border/60 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>
                    Showing <strong className="text-foreground">
                      {Math.min((currentPage - 1) * ROOMS_PER_PAGE + 1, filteredRooms.length)}–
                      {Math.min(currentPage * ROOMS_PER_PAGE, filteredRooms.length)}
                    </strong> of <strong className="text-foreground">{filteredRooms.length}</strong> rooms
                    {filteredRooms.length !== rooms.length && ` (filtered from ${rooms.length})`}
                  </span>
                  {activeFilterCount > 0 && (
                    <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/50 text-[11px]">
                      {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
                    </span>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-3 ml-auto">
                    <span className="text-muted-foreground font-medium hidden sm:inline">
                      Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed text-foreground bg-card hover:bg-muted transition-colors border border-border shadow-xs cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Previous
                      </button>

                      <div className="hidden md:flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                          .map((p, i, arr) => {
                            const prev = arr[i - 1];
                            const showEllipsis = prev && p - prev > 1;
                            return (
                              <React.Fragment key={p}>
                                {showEllipsis && <span className="px-1 text-muted-foreground">...</span>}
                                <button
                                  onClick={() => setCurrentPage(p)}
                                  className={`w-7 h-7 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                    currentPage === p
                                      ? "bg-primary text-primary-foreground shadow-xs"
                                      : "bg-card text-foreground hover:bg-muted border border-border"
                                  }`}
                                >
                                  {p}
                                </button>
                              </React.Fragment>
                            );
                          })}
                      </div>

                      <button
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed text-foreground bg-card hover:bg-muted transition-colors border border-border shadow-xs cursor-pointer"
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
      {/* Modals */}
      {selectedRoom && (
        <RoomConfigModal
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onSave={handleSaveConfig}
          onEdit={(room) => {
            setSelectedRoom(null);
            setEditingRoom(room);
          }}
          onDelete={(room) => {
            setSelectedRoom(null);
            setDeletingRoom(room);
          }}
        />
      )}

      {(showCreateModal || editingRoom) && (
        <RoomFormModal
          room={editingRoom}
          onClose={() => {
            setShowCreateModal(false);
            setEditingRoom(null);
          }}
          onSave={handleSaveRoom}
        />
      )}

      {deletingRoom && (
        <DeleteRoomModal
          room={deletingRoom}
          onClose={() => setDeletingRoom(null)}
          onDelete={handleDeleteRoom}
        />
      )}

      {/* Upcoming Vacancies Modal */}
      {showVacancyModal && (
        <div className="admin-modal-overlay" onClick={() => setShowVacancyModal(false)}>
          <div
            className="admin-modal-content vacancy-modal-wide p-6 space-y-5 rounded-2xl shadow-xl border border-border bg-card max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground tracking-tight">
                    Upcoming Vacancies & Move-Out Schedule
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Overview of active tenant contracts, notice periods, and bed vacancy timeline forecasts.
                  </p>
                </div>
              </div>
              <button
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                onClick={() => setShowVacancyModal(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Executive KPI Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setVacancyUrgencyFilter("urgent")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
                    vacancyUrgencyFilter === "urgent"
                      ? "bg-amber-500/15 border-amber-500/50 shadow-xs ring-2 ring-amber-500/40"
                      : "bg-amber-500/10 border-amber-500/25 hover:border-amber-500/40 hover:bg-amber-500/15"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <span>Urgent (&le;30 Days)</span>
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold text-amber-950 dark:text-amber-100 mt-1">
                    {vacancyKPIs.urgent}
                  </div>
                  <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5 font-medium">
                    Immediate turnovers
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setVacancyUrgencyFilter("upcoming")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
                    vacancyUrgencyFilter === "upcoming"
                      ? "bg-blue-500/15 border-blue-500/50 shadow-xs ring-2 ring-blue-500/40"
                      : "bg-blue-500/10 border-blue-500/25 hover:border-blue-500/40 hover:bg-blue-500/15"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-400">
                    <span>31 &ndash; 90 Days</span>
                    <Calendar className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold text-blue-950 dark:text-blue-100 mt-1">
                    {vacancyKPIs.upcoming}
                  </div>
                  <p className="text-[10px] text-blue-700/80 dark:text-blue-400/80 mt-0.5 font-medium">
                    Next quarter move-outs
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setVacancyUrgencyFilter("longterm")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
                    vacancyUrgencyFilter === "longterm"
                      ? "bg-emerald-500/15 border-emerald-500/50 shadow-xs ring-2 ring-emerald-500/40"
                      : "bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500/40 hover:bg-emerald-500/15"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <span>90+ Days</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-950 dark:text-emerald-100 mt-1">
                    {vacancyKPIs.longTerm}
                  </div>
                  <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 font-medium">
                    Distant contract ends
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setVacancyUrgencyFilter("all")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
                    vacancyUrgencyFilter === "all"
                      ? "bg-indigo-500/15 border-indigo-500/50 shadow-xs ring-2 ring-indigo-500/40"
                      : "bg-indigo-500/10 border-indigo-500/25 hover:border-indigo-500/40 hover:bg-indigo-500/15"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                    <span>Total Move-Outs</span>
                    <Bed className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-bold text-indigo-950 dark:text-indigo-100 mt-1">
                    {vacancyKPIs.total}
                  </div>
                  <p className="text-[10px] text-indigo-700/80 dark:text-indigo-400/80 mt-0.5 font-medium">
                    Active scheduled list
                  </p>
                </button>
              </div>

              {/* Search & Filter Controls Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search room, bed code, or occupant name..."
                    value={vacancySearch}
                    onChange={(e) => setVacancySearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                  />
                  {vacancySearch && (
                    <button
                      type="button"
                      onClick={() => setVacancySearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border text-xs">
                  {[
                    { id: "all", label: `All (${upcomingVacancies.length})` },
                    { id: "urgent", label: `Urgent (${vacancyKPIs.urgent})` },
                    { id: "upcoming", label: `31-90 Days (${vacancyKPIs.upcoming})` },
                    { id: "longterm", label: `90+ Days (${vacancyKPIs.longTerm})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setVacancyUrgencyFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg transition-all text-[11px] font-medium cursor-pointer ${
                        vacancyUrgencyFilter === tab.id
                          ? "bg-background text-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Table */}
              {filteredUpcomingVacancies.length === 0 ? (
                <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-muted-foreground border border-dashed rounded-xl bg-muted/20 min-h-[280px]">
                  {upcomingVacancies.length === 0
                    ? "No upcoming vacancies scheduled at this time."
                    : "No move-out records match your current search/filter."}
                </div>
              ) : (
                <div className="overflow-x-auto border border-border rounded-xl shadow-xs bg-card min-h-[280px]">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-muted/60 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3.5 pl-4">Room & Bed</th>
                        <th className="p-3.5">Occupant</th>
                        <th className="p-3.5">Expected Vacancy Date</th>
                        <th className="p-3.5">Timeline Status</th>
                        <th className="p-3.5 pr-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {paginatedUpcomingVacancies.map((item, idx) => {
                        const dateStr = item.expectedVacancyDate
                          ? new Date(item.expectedVacancyDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Scheduled";

                        const days = item.daysRemaining;
                        let timelineBadge = {
                          bg: "bg-secondary text-muted-foreground border border-border",
                          label: "Scheduled",
                        };
                        if (days != null) {
                          if (days <= 0) {
                            timelineBadge = {
                              bg: "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 font-bold",
                              label: "Vacant Today / Overdue",
                            };
                          } else if (days <= 30) {
                            timelineBadge = {
                              bg: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-semibold",
                              label: `${days} days left`,
                            };
                          } else if (days <= 90) {
                            timelineBadge = {
                              bg: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-medium",
                              label: `${days} days left`,
                            };
                          } else {
                            timelineBadge = {
                              bg: "bg-muted text-muted-foreground border border-border font-normal",
                              label: `${days} days left`,
                            };
                          }
                        }

                        return (
                          <tr key={idx} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3.5 pl-4 font-medium text-foreground">
                              <span className="font-bold text-sm text-foreground block">
                                {item.roomName}
                              </span>
                              <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] text-muted-foreground font-mono bg-muted/60 rounded border border-border/50">
                                {item.bedLabel || getBedDisplayLabel(item.bedObj)}
                              </span>
                            </td>
                            <td className="p-3.5 font-medium text-foreground">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                  {item.occupantName.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-foreground font-medium">
                                  {item.occupantName}
                                </span>
                              </div>
                            </td>
                            <td className="p-3.5 font-semibold text-foreground">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>{dateStr}</span>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] ${timelineBadge.bg}`}
                              >
                                {timelineBadge.label}
                              </span>
                            </td>
                            <td className="p-3.5 pr-4 text-right">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-primary/30 text-primary bg-primary/5 hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer shadow-xs ms-auto"
                                onClick={() => {
                                  setShowVacancyModal(false);
                                  setSelectedRoom(item.roomObj);
                                }}
                              >
                                Manage Room
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Bar */}
              {filteredUpcomingVacancies.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 text-xs text-muted-foreground border-t border-border">
                  <div>
                    Showing{" "}
                    <span className="font-semibold text-foreground">
                      {(vacancyPage - 1) * VACANCIES_PER_PAGE + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold text-foreground">
                      {Math.min(vacancyPage * VACANCIES_PER_PAGE, filteredUpcomingVacancies.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-foreground">
                      {filteredUpcomingVacancies.length}
                    </span>{" "}
                    vacancies
                  </div>

                  {totalVacancyPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setVacancyPage((prev) => Math.max(1, prev - 1))}
                        disabled={vacancyPage === 1}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed text-foreground bg-card hover:bg-muted transition-colors border border-border shadow-xs cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Previous
                      </button>
                      <span className="px-2 py-1 text-xs font-medium text-foreground">
                        Page {vacancyPage} of {totalVacancyPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setVacancyPage((prev) => Math.min(totalVacancyPages, prev + 1))}
                        disabled={vacancyPage === totalVacancyPages}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed text-foreground bg-card hover:bg-muted transition-colors border border-border shadow-xs cursor-pointer"
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Room Bed History Drawer */}
      {historyRoomId && (
        <RoomBedHistoryDrawer
          roomId={historyRoomId}
          onClose={() => setHistoryRoomId(null)}
        />
      )}
    </div>
  );
}

export default RoomAvailabilityPage;
