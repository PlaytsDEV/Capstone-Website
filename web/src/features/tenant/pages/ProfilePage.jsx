import React, { useEffect, useMemo, useState } from "react";
import "../../../shared/styles/notification.css";
import "../styles/profile-page.css";
import "../styles/profile-dark-overrides.css";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/hooks/useAuth";
import ProfilePageSkeleton from "../components/profile/ProfilePageSkeleton";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import { authFetch } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
import { formatDisplayName } from "../../../shared/utils/formatDate";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "../../../shared/hooks/queries/useUsers";
import { useReservations, useReservation } from "../../../shared/hooks/queries/useReservations";
import { billingApi } from "../../../shared/api/billingApi";
import { hasReservationStatus } from "../../../shared/utils/lifecycleNaming";
import { getReservationProgress, getNextAction } from "../utils/reservationProgress";
import { resolveCurrentReservation, sortByRecency } from "../utils/reservationSelection";
import { isStructuredWorkflow } from "../utils/reservationReadiness";
import TenantMaintenanceWorkspace from "../components/maintenance/TenantMaintenanceWorkspace";
import {
 ReceiptModal,
 DashboardTab,
 PersonalDetailsTab,
 ActivityHistoryTab,
 NotificationsTab,
 SettingsTab,
 ContractTab,
 ReservationAgreementPage,
 AnnouncementsTab,
} from "../components/profile";

const ProfilePage = () => {
 const { user: authUser, updateUser } = useAuth();
 const navigate = useNavigate();
 const location = useLocation();
 const queryClient = useQueryClient();
 const canViewAnnouncements = authUser?.role === "tenant";

 const [activeTab, setActiveTab] = useState(
 location.state?.tab === "announcements" && !canViewAnnouncements
 ? "dashboard"
 : location.state?.tab || "dashboard",
 );
 const [saving, setSaving] = useState(false);
 const [isEditingProfile, setIsEditingProfile] = useState(false);
 const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
 const [pendingTab, setPendingTab] = useState(null);
 const [receiptModal, setReceiptModal] = useState({ open: false, step: null });
 const [selectedReservationId, setSelectedReservationId] = useState(null);

 const [profileData, setProfileData] = useState({
 firstName: "",
 lastName: "",
 email: "",
 username: "",
 phone: "",
 profileImage: "",
 branch: "",
 role: "",
 tenantStatus: "applicant",
 createdAt: "",
 gender: "",
 civilStatus: "",
 nationality: "",
 occupation: "",
 address: "",
 city: "",
 province: "",
 zipCode: "",
 dateOfBirth: "",
 emergencyContact: "",
 emergencyPhone: "",
 emergencyRelationship: "",
 });

 const [editData, setEditData] = useState({
 firstName: "",
 lastName: "",
 profileImage: "",
 dateOfBirth: "",
 gender: "",
 civilStatus: "",
 nationality: "",
 occupation: "",
 });

 const { data: profile, isLoading: profileLoading } = useCurrentUser();
 const {
 data: reservationsData,
 isLoading: reservationsLoading,
 refetch: refetchReservations,
 } = useReservations();
 const loading = (!profile && profileLoading) || (!reservationsData && reservationsLoading);

 useEffect(() => {
 if (!profile) return;

 setProfileData(profile);
 setEditData({
 firstName: profile.firstName || "",
 lastName: profile.lastName || "",
 profileImage: profile.profileImage || "",
 dateOfBirth: profile.dateOfBirth || "",
 gender: profile.gender || "",
 civilStatus: profile.civilStatus || "",
 nationality: profile.nationality || "",
 occupation: profile.occupation || "",
 });
 }, [profile]);

 useEffect(() => {
 const nextTab =
 location.state?.tab === "announcements" && !canViewAnnouncements
 ? "dashboard"
 : location.state?.tab || "dashboard";

 setActiveTab(nextTab);
 }, [canViewAnnouncements, location.state]);

 useEffect(() => {
 const refreshReservations = () => {
 void refetchReservations();
 };

 refreshReservations();

 const handlePageShow = () => {
 refreshReservations();
 };
 const handleVisibilityChange = () => {
 if (!document.hidden) refreshReservations();
 };

 window.addEventListener("pageshow", handlePageShow);
 document.addEventListener("visibilitychange", handleVisibilityChange);

 return () => {
 window.removeEventListener("pageshow", handlePageShow);
 document.removeEventListener("visibilitychange", handleVisibilityChange);
 };
 }, [refetchReservations]);

 useEffect(() => {
 if (activeTab === "announcements" && !canViewAnnouncements) {
 setActiveTab("dashboard");
 }
 }, [activeTab, canViewAnnouncements]);

 useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentStatus = params.get("payment");
    const rawSessionId = params.get("session_id");

    if (!paymentStatus || params.get("tab") === "billing") return;

    // Clean up query parameters immediately
    navigate(location.pathname, { replace: true });

    const urlSessionId =
      rawSessionId && rawSessionId !== "{id}" && rawSessionId.startsWith("cs_")
        ? rawSessionId
        : null;

    if (paymentStatus === "cancelled") {
      showNotification(
        "Move-in checkout was cancelled. You can complete payment anytime before move-in.",
        "warning",
        5000,
      );
      return;
    }

    const verifyPayment = async () => {
      const storedMoveInSessionId =
        sessionStorage.getItem("lilycrest_movein_session_id") ||
        localStorage.getItem("lilycrest_movein_session_id");

      const active = (Array.isArray(reservationsData) ? reservationsData : []).find(
        (reservation) => reservation.status !== "cancelled",
      );

      // URL session ID is available immediately on redirect — no need for reservationsData.
      const sessionId =
        urlSessionId ||
        storedMoveInSessionId ||
        active?.initialPaymentSessionId ||
        active?.paymongoSessionId;

      /**
       * Flush all reservation/billing caches and force a synchronous refetch
       * so MoveInSettlementCard sees the new initialPaymentStatus immediately
       * without waiting for the 10 s background polling interval.
       */
      const flushCaches = async (activeReservationId) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["reservations"] }),
          queryClient.invalidateQueries({ queryKey: ["bills"] }),
          ...(activeReservationId
            ? [queryClient.invalidateQueries({ queryKey: ["reservations", "detail", activeReservationId] })]
            : []),
        ]);
        // Force an immediate refetch so the UI is updated before the user notices.
        await refetchReservations();
      };

      if (sessionId) {
        try {
          const result = await billingApi.checkPaymentStatus(sessionId);
          try {
            sessionStorage.removeItem("lilycrest_movein_session_id");
            localStorage.removeItem("lilycrest_movein_session_id");
          } catch {}

          if (result?.requiresReview) {
            showNotification(
              "Payment was received but needs admin review before your move-in settlement is confirmed.",
              "warning",
              5000,
            );
            await flushCaches(active?._id);
            await queryClient.invalidateQueries({ queryKey: ["tenant-contracts"] });
            return;
          }
          if (result?.status === "paid") {
            showNotification(
              "Move-in payment received! Your move-in requirements are fully settled.",
              "success",
              5000,
            );
            await flushCaches(active?._id);
            await queryClient.invalidateQueries({ queryKey: ["tenant-contracts"] });
            return;
          }
        } catch (error) {
          console.error("Move-in payment verification failed:", error);
        }
      }

      // Fallback: flush caches even if session ID lookup was delayed
      await flushCaches(active?._id);

      if (paymentStatus === "success") {
        showNotification(
          "Payment completed! Refreshing your reservation status...",
          "info",
          4000,
        );
      }
    };

    verifyPayment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

 const reservations = useMemo(() => reservationsData || [], [reservationsData]);

 // Deterministic rule: the "current" reservation is the most-recently-updated
 // (falling back to most-recently-created) non-archived, non-terminal
 // reservation — see reservationSelection.js (sortByRecency /
 // resolveCurrentReservation), shared with useReservationFlow.js so both the
 // flow's active-reservation resume logic and this profile view apply the
 // exact same tie-break rule.
 const activeReservations = useMemo(
 () =>
 sortByRecency(
 reservations.filter((reservation) => {
 const status = reservation.reservationStatus || reservation.status;
  return !hasReservationStatus(status, "moveOut", "cancelled", "rejected");
 }),
 ),
 [reservations],
 );

 // Re-resolve whenever the reservations list changes rather than caching a
 // stale selectedReservationId indefinitely — prevents the Dashboard and
 // Profile tabs from silently diverging onto different records (e.g. after a
 // new reservation is created, or the previously-selected one is archived).
 useEffect(() => {
 const { nextSelectedId } = resolveCurrentReservation(activeReservations, selectedReservationId);
 if (nextSelectedId !== selectedReservationId) {
 setSelectedReservationId(nextSelectedId);
 }
 }, [activeReservations, selectedReservationId]);

 // Single source of truth: both the Dashboard and Profile tabs derive from
 // this same value, so they can never point at different records.
 const activeReservation = activeReservations[0] || null;

 const visits = useMemo(
 () =>
 reservations
 .filter((reservation) => reservation.visitDate)
 .map((reservation) => ({
 id: reservation._id,
 roomNumber: reservation.roomId?.name || "N/A",
 location: reservation.roomId?.branch || "N/A",
 floor: reservation.roomId?.floor || 1,
 date: reservation.visitDate,
 time: reservation.visitTime || "TBD",
 status: reservation.visitCompleted
 ? "Completed"
 : new Date(reservation.visitDate) < new Date()
 ? "Missed"
 : "Scheduled",
 specialInstructions:
 "Please bring valid ID. Meet at the reception area.",
 })),
 [reservations],
 );

  const handleSaveProfile = async (overrideData) => {
    setSaving(true);
    const dataToSave = overrideData || editData;
    const imageChanged =
      dataToSave.profileImage && dataToSave.profileImage !== profileData.profileImage;

    try {
      const updatedUser = await authFetch("/auth/profile", {
        method: "PUT",
        body: JSON.stringify(dataToSave),
      });

      setProfileData((prev) => ({ ...prev, ...updatedUser.user }));
      setIsEditingProfile(false);
      if (updateUser) updateUser(updatedUser.user);
      queryClient.invalidateQueries({ queryKey: ["users", "currentUser"] });

      showNotification(
        imageChanged
          ? "Profile photo updated successfully!"
          : "Profile updated successfully!",
        "success",
        3000,
      );
    } catch (error) {
      console.error("Error updating profile:", error);
      showNotification(error?.message || "Failed to update profile. Please try again.", "error", 4000);
    } finally {
      setSaving(false);
    }
  };

 const handleCancelEdit = () => {
 setEditData({
 firstName: profileData.firstName || "",
 lastName: profileData.lastName || "",
 profileImage: profileData.profileImage || "",
 dateOfBirth: profileData.dateOfBirth || "",
 gender: profileData.gender || "",
 civilStatus: profileData.civilStatus || "",
 nationality: profileData.nationality || "",
 occupation: profileData.occupation || "",
 });
 setIsEditingProfile(false);
 };

 const hasUnsavedChanges =
 isEditingProfile &&
 (editData.firstName !== (profileData.firstName || "") ||
 editData.lastName !== (profileData.lastName || "") ||
 editData.profileImage !== (profileData.profileImage || "") ||
 editData.dateOfBirth !== (profileData.dateOfBirth || "") ||
 editData.gender !== (profileData.gender || "") ||
 editData.civilStatus !== (profileData.civilStatus || "") ||
 editData.nationality !== (profileData.nationality || "") ||
 editData.occupation !== (profileData.occupation || ""));

 const handleTabChange = (nextTab) => {
 if (hasUnsavedChanges) {
 setPendingTab(nextTab);
 setShowUnsavedWarning(true);
 return;
 }

 setActiveTab(nextTab);
 setIsEditingProfile(false);
 navigate("/applicant/profile", {
 replace: true,
 state: { tab: nextTab },
 });
 };

 const confirmDiscardChanges = () => {
 setShowUnsavedWarning(false);
 handleCancelEdit();

 if (pendingTab) {
 setActiveTab(pendingTab);
 navigate("/applicant/profile", {
 replace: true,
 state: { tab: pendingTab },
 });
 setPendingTab(null);
 }
 };

 const selectedReservation = selectedReservationId
 ? activeReservations.find((reservation) => reservation._id === selectedReservationId) ||
 activeReservations[0]
 : activeReservations[0];

 // The reservations LIST endpoint never attaches authoritative
 // moveInReadiness (it would fan out into Bill/Room/Stay/Reservation
 // queries per row — see attachMoveInReadiness in
 // reservationCrudController.js). Only the single-reservation DETAIL
 // endpoint carries it, so fetch it here — scoped to just the selected
 // reservation, and only when it's on the structured workflow — so the
 // dashboard's "Move-in ready!" label can make an authoritative claim
 // instead of falling back to non-final wording indefinitely.
  const authoritativeReadinessQuery = useReservation(selectedReservation?._id, {
    // Always fetch the detail for confirmed (reserved/moveIn/moveOut) reservations so
    // that initialPaymentStatus and paymentStatus are sourced from the DB-authoritative
    // detail endpoint, not the potentially-stale list snapshot.
    enabled:
      Boolean(selectedReservation?._id) &&
      (isStructuredWorkflow(selectedReservation) ||
        hasReservationStatus(
          selectedReservation?.reservationStatus || selectedReservation?.status,
          "reserved",
          "moveIn",
          "moveOut",
        )),
  });
  const dashboardReservation = useMemo(() => {
    if (!selectedReservation) return selectedReservation;
    const detail = authoritativeReadinessQuery.data;
    // Only inherit moveInReadiness from the detail endpoint — it is the only
    // field that the list endpoint intentionally omits (to avoid fan-out
    // queries per row). Payment status fields (initialPaymentStatus,
    // paymentStatus) are returned by the list endpoint via HEAVY_FIELDS
    // negative exclusion, so we MUST NOT override them from the detail here —
    // the detail may still be stale while the list has already been
    // force-refetched after payment confirmation.
    if (detail?._id === selectedReservation._id && detail?.moveInReadiness) {
      return { ...selectedReservation, moveInReadiness: detail.moveInReadiness };
    }
    return selectedReservation;
  }, [selectedReservation, authoritativeReadinessQuery.data]);

 const reservationProgress = getReservationProgress(selectedReservation);
 const nextAction = getNextAction(selectedReservation, reservationProgress);
 const isReservationConfirmed =
 selectedReservation &&
 hasReservationStatus(
 selectedReservation.reservationStatus || selectedReservation.status,
 "reserved",
 "moveIn",
 "moveOut",
 );

 const confirmedReservation = isReservationConfirmed
 ? selectedReservation || activeReservation
 : null;

 useEffect(() => {
 if (!isReservationConfirmed) return;

 window.history.pushState(null, "", window.location.href);
 const handlePopState = () => {
 window.history.pushState(null, "", window.location.href);
 };

 window.addEventListener("popstate", handlePopState);
 return () => window.removeEventListener("popstate", handlePopState);
 }, [isReservationConfirmed]);

  const fullName = formatDisplayName(
    `${profileData.firstName || ""} ${profileData.lastName || ""}`.trim() ||
      profileData.name ||
      profileData.username ||
      "User"
  );

 if (loading) return <ProfilePageSkeleton />;

 return (
    <div className="profile-page">
      {activeTab === "dashboard" && (
        <DashboardTab
          profileData={profileData}
          activeReservation={activeReservation}
          selectedReservation={dashboardReservation}
          visits={visits}
          nextAction={nextAction}
          onGoToPersonal={() => handleTabChange("personal")}
          onGoToReservation={() => handleTabChange("reservation")}
        />
      )}

      {activeTab === "personal" && (
        <PersonalDetailsTab
          profileData={profileData}
          editData={editData}
          setEditData={setEditData}
          fullName={fullName}
          isEditingProfile={isEditingProfile}
          setIsEditingProfile={setIsEditingProfile}
          saving={saving}
          onSave={handleSaveProfile}
          onCancel={handleCancelEdit}
        />
      )}

      {activeTab === "reservation" && (
        <ReservationAgreementPage
          reservation={confirmedReservation}
          onBack={() => handleTabChange("dashboard")}
          onReservationUpdated={refetchReservations}
        />
      )}

      {activeTab === "history" && (
        <ActivityHistoryTab
          reservations={reservations}
          isLoading={reservationsLoading}
        />
      )}

      {activeTab === "maintenance" && <TenantMaintenanceWorkspace embedded />}
      {activeTab === "announcements" && canViewAnnouncements && <AnnouncementsTab />}
      {activeTab === "notifications" && <NotificationsTab onTabChange={handleTabChange} />}
      {activeTab === "settings" && <SettingsTab />}
      {activeTab === "contract" && <ContractTab />}

      <ReceiptModal
        isOpen={receiptModal.open}
        step={receiptModal.step}
        reservation={activeReservation}
        onClose={() => setReceiptModal({ open: false, step: null })}
      />

      <ConfirmModal
        isOpen={showUnsavedWarning}
        onClose={() => {
          setShowUnsavedWarning(false);
          setPendingTab(null);
        }}
        onConfirm={confirmDiscardChanges}
        title="Unsaved Changes"
        message="You have unsaved changes. Are you sure you want to leave this tab? Your changes will be lost."
        variant="warning"
        confirmText="Discard Changes"
        cancelText="Keep Editing"
      />
    </div>
 );
};

export default ProfilePage;
