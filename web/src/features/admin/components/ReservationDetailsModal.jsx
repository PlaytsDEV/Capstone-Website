import { useState } from "react";
import { reservationApi } from "../../../shared/api/apiClient";
import { showNotification } from "../../../shared/utils/notification";
import "../styles/reservation-details-modal.css";

export default function ReservationDetailsModal({
  reservation,
  onClose,
  onUpdate,
}) {
  const [adminNotes, setAdminNotes] = useState(reservation?.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);

  if (!reservation) return null;

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === "") return "N/A";
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return value;
    return `₱${numeric.toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const openImageInNewTab = (url, title) => {
    if (!url) {
      showNotification("No file available", "error");
      return;
    }
    const newWindow = window.open("", "_blank");
    newWindow.document.write(`
      <html>
        <head><title>${title}</title></head>
        <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a2e;">
          <img src="${url}" style="max-width:100%;max-height:100vh;object-fit:contain;" alt="${title}" />
        </body>
      </html>
    `);
  };

  const customerName =
    reservation.customerName ?? reservation.customer ?? "Unknown";
  const customerEmail = reservation.customerEmail ?? reservation.email ?? "N/A";
  const customerPhone = reservation.customerPhone ?? reservation.phone ?? "N/A";
  const roomName = reservation.room ?? reservation.roomName ?? "N/A";
  const roomType = reservation.roomType ?? "N/A";
  const branchName = reservation.branch ?? "N/A";
  const moveInDate =
    reservation.moveInDate ?? reservation.preferredMoveIn ?? "N/A";
  const totalPrice =
    reservation.totalPrice ?? reservation.reservationFee ?? null;
  const paymentStatus = reservation.paymentStatus ?? "N/A";
  const statusLabel = reservation.status ?? "N/A";
  const normalizedStatus = (reservation.status || "").toLowerCase();
  const appliancePriceEach = reservation.appliancePriceEach ?? 0;
  const appliances = reservation.appliances ?? [];
  const totalApplianceFee = reservation.totalApplianceFee ?? "0";
  const paymentProofAmount = reservation.paymentProofAmount ?? null;
  const paymentProofImage = reservation.paymentProofImage ?? null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await reservationApi.update(reservation.id, { status: "confirmed" });
      showNotification("Reservation confirmed successfully", "success");
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error("Error confirming reservation:", error);
      showNotification("Failed to confirm reservation", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (
      window.confirm(
        "Are you sure you want to cancel this reservation? This action cannot be undone.",
      )
    ) {
      setIsSubmitting(true);
      try {
        await reservationApi.update(reservation.id, { status: "cancelled" });
        showNotification("Reservation cancelled successfully", "success");
        onUpdate?.();
        onClose();
      } catch (error) {
        console.error("Error cancelling reservation:", error);
        showNotification("Failed to cancel reservation", "error");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleUpdateNotes = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await reservationApi.update(reservation.id, { notes: adminNotes });
      showNotification("Notes updated successfully", "success");
      onUpdate?.();
    } catch (error) {
      console.error("Error updating notes:", error);
      showNotification("Failed to update notes", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="reservation-details-modal-overlay" onClick={onClose}>
      <div
        className="reservation-details-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="reservation-details-modal-header">
          <div>
            <h2 className="reservation-details-modal-title">
              Reservation Details
            </h2>
            <p className="reservation-details-modal-id">
              {reservation.reservationCode || reservation.id}
            </p>
          </div>
          <button className="reservation-details-modal-close" onClick={onClose}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18 6L6 18M6 6L18 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="reservation-details-modal-content">
          {/* Customer Information Container */}
          <div className="reservation-details-container">
            <h3 className="reservation-details-section-title">
              Customer Information
            </h3>
            <div className="reservation-details-container-body">
              <div className="reservation-details-grid">
                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Name</label>
                  <p className="reservation-details-value">{customerName}</p>
                </div>

                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Email</label>
                  <p className="reservation-details-value">{customerEmail}</p>
                </div>

                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Phone</label>
                  <p className="reservation-details-value">{customerPhone}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Reservation Details Container */}
          <div className="reservation-details-container">
            <h3 className="reservation-details-section-title">
              Reservation Details
            </h3>
            <div className="reservation-details-container-body">
              <div className="reservation-details-grid-2col">
                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Room</label>
                  <p className="reservation-details-value">{roomName}</p>
                </div>

                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Room Type</label>
                  <p className="reservation-details-value">{roomType}</p>
                </div>

                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Branch</label>
                  <p className="reservation-details-value">{branchName}</p>
                </div>

                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">
                    Move-In Date
                  </label>
                  <p className="reservation-details-value">{moveInDate}</p>
                </div>

                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">
                    Total Price
                  </label>
                  <p className="reservation-details-value reservation-details-fee">
                    {formatCurrency(totalPrice)}
                  </p>
                </div>

                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">
                    Payment Status
                  </label>
                  <p className="reservation-details-value">{paymentStatus}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Declared Appliances Container */}
          <div className="reservation-details-container">
            <h3 className="reservation-details-section-title">
              Declared Appliances (₱{appliancePriceEach} each)
            </h3>
            <div className="reservation-details-container-body">
              <div className="reservation-details-appliances">
                {(appliances?.length ?? 0) > 0 ? (
                  appliances?.map((appliance, index) => (
                    <span
                      key={index}
                      className="reservation-details-appliance-badge"
                    >
                      {appliance}
                    </span>
                  ))
                ) : (
                  <p className="reservation-details-no-appliances">
                    No appliances declared
                  </p>
                )}
              </div>
              {totalApplianceFee && totalApplianceFee !== "0" && (
                <div className="reservation-details-appliance-fee">
                  <span className="reservation-details-label">
                    Total Appliance Fee:
                  </span>
                  <span className="reservation-details-value">
                    ₱{totalApplianceFee}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Proof Container - Legacy */}
          {paymentProofAmount && (
            <div className="reservation-details-container">
              <h3 className="reservation-details-section-title">
                Payment Proof (₱{paymentProofAmount})
              </h3>
              <div className="reservation-details-container-body">
                {paymentProofImage ? (
                  <img
                    src={paymentProofImage}
                    alt="Payment Proof"
                    className="reservation-details-payment-image"
                  />
                ) : (
                  <p className="reservation-details-no-image">
                    No payment proof image available
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Submitted Requirements - Clickable Section */}
          <div className="reservation-details-container">
            <button
              type="button"
              className="reservation-details-collapsible-header"
              onClick={() => setShowRequirements(!showRequirements)}
            >
              <h3 className="reservation-details-section-title">
                📋 Submitted Requirements
              </h3>
              <span className="reservation-details-collapse-icon">
                {showRequirements ? "▲" : "▼"}
              </span>
            </button>
            {showRequirements && (
              <div className="reservation-details-container-body">
                <div className="reservation-details-documents-grid">
                  {/* Selfie Photo */}
                  <div className="reservation-details-document-item">
                    <label className="reservation-details-label">
                      Selfie Photo
                    </label>
                    {reservation.selfiePhotoUrl ? (
                      <button
                        type="button"
                        className="reservation-details-view-doc-btn"
                        onClick={() =>
                          openImageInNewTab(
                            reservation.selfiePhotoUrl,
                            "Selfie Photo",
                          )
                        }
                      >
                        📷 View Selfie
                      </button>
                    ) : (
                      <span className="reservation-details-no-doc">
                        Not submitted
                      </span>
                    )}
                  </div>

                  {/* Valid ID Front */}
                  <div className="reservation-details-document-item">
                    <label className="reservation-details-label">
                      Valid ID (Front){" "}
                      {reservation.validIDType &&
                        `- ${reservation.validIDType}`}
                    </label>
                    {reservation.validIDFrontUrl ? (
                      <button
                        type="button"
                        className="reservation-details-view-doc-btn"
                        onClick={() =>
                          openImageInNewTab(
                            reservation.validIDFrontUrl,
                            "Valid ID Front",
                          )
                        }
                      >
                        🪪 View ID Front
                      </button>
                    ) : (
                      <span className="reservation-details-no-doc">
                        Not submitted
                      </span>
                    )}
                  </div>

                  {/* Valid ID Back */}
                  <div className="reservation-details-document-item">
                    <label className="reservation-details-label">
                      Valid ID (Back)
                    </label>
                    {reservation.validIDBackUrl ? (
                      <button
                        type="button"
                        className="reservation-details-view-doc-btn"
                        onClick={() =>
                          openImageInNewTab(
                            reservation.validIDBackUrl,
                            "Valid ID Back",
                          )
                        }
                      >
                        🪪 View ID Back
                      </button>
                    ) : (
                      <span className="reservation-details-no-doc">
                        Not submitted
                      </span>
                    )}
                  </div>

                  {/* NBI Clearance */}
                  <div className="reservation-details-document-item">
                    <label className="reservation-details-label">
                      NBI Clearance
                    </label>
                    {reservation.nbiClearanceUrl ? (
                      <button
                        type="button"
                        className="reservation-details-view-doc-btn"
                        onClick={() =>
                          openImageInNewTab(
                            reservation.nbiClearanceUrl,
                            "NBI Clearance",
                          )
                        }
                      >
                        📄 View NBI
                      </button>
                    ) : (
                      <span className="reservation-details-no-doc">
                        {reservation.nbiReason
                          ? `Skipped: ${reservation.nbiReason}`
                          : "Not submitted"}
                      </span>
                    )}
                  </div>

                  {/* Company ID */}
                  <div className="reservation-details-document-item">
                    <label className="reservation-details-label">
                      Company/School ID
                    </label>
                    {reservation.companyIDUrl ? (
                      <button
                        type="button"
                        className="reservation-details-view-doc-btn"
                        onClick={() =>
                          openImageInNewTab(
                            reservation.companyIDUrl,
                            "Company ID",
                          )
                        }
                      >
                        🏢 View Company ID
                      </button>
                    ) : (
                      <span className="reservation-details-no-doc">
                        {reservation.companyIDReason
                          ? `Skipped: ${reservation.companyIDReason}`
                          : "Not submitted"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Details - Clickable Section */}
          <div className="reservation-details-container">
            <button
              type="button"
              className="reservation-details-collapsible-header"
              onClick={() => setShowPaymentDetails(!showPaymentDetails)}
            >
              <h3 className="reservation-details-section-title">
                💳 Payment Details
              </h3>
              <span className="reservation-details-collapse-icon">
                {showPaymentDetails ? "▲" : "▼"}
              </span>
            </button>
            {showPaymentDetails && (
              <div className="reservation-details-container-body">
                <div className="reservation-details-grid-2col">
                  <div className="reservation-details-form-group">
                    <label className="reservation-details-label">
                      Payment Status
                    </label>
                    <p
                      className={`reservation-details-value reservation-details-payment-status-${paymentStatus?.toLowerCase()}`}
                    >
                      {paymentStatus}
                    </p>
                  </div>

                  <div className="reservation-details-form-group">
                    <label className="reservation-details-label">
                      Payment Method
                    </label>
                    <p className="reservation-details-value">
                      {reservation.paymentMethod || "N/A"}
                    </p>
                  </div>

                  <div className="reservation-details-form-group">
                    <label className="reservation-details-label">
                      Final Move-In Date
                    </label>
                    <p className="reservation-details-value">
                      {formatDate(reservation.finalMoveInDate)}
                    </p>
                  </div>

                  <div className="reservation-details-form-group">
                    <label className="reservation-details-label">
                      Lease Duration
                    </label>
                    <p className="reservation-details-value">
                      {reservation.leaseDuration
                        ? `${reservation.leaseDuration} months`
                        : "N/A"}
                    </p>
                  </div>

                  <div className="reservation-details-form-group">
                    <label className="reservation-details-label">
                      Total Amount
                    </label>
                    <p className="reservation-details-value reservation-details-fee">
                      {formatCurrency(totalPrice)}
                    </p>
                  </div>

                  <div className="reservation-details-form-group">
                    <label className="reservation-details-label">
                      Billing Email
                    </label>
                    <p className="reservation-details-value">
                      {reservation.billingEmail || customerEmail}
                    </p>
                  </div>
                </div>

                {/* Proof of Payment */}
                <div className="reservation-details-payment-proof-section">
                  <label className="reservation-details-label">
                    Proof of Payment
                  </label>
                  {reservation.proofOfPaymentUrl ? (
                    <div className="reservation-details-payment-proof-actions">
                      <button
                        type="button"
                        className="reservation-details-view-doc-btn reservation-details-view-doc-btn-large"
                        onClick={() =>
                          openImageInNewTab(
                            reservation.proofOfPaymentUrl,
                            "Proof of Payment",
                          )
                        }
                      >
                        🧾 View Proof of Payment
                      </button>
                      <img
                        src={reservation.proofOfPaymentUrl}
                        alt="Proof of Payment Preview"
                        className="reservation-details-payment-thumbnail"
                        onClick={() =>
                          openImageInNewTab(
                            reservation.proofOfPaymentUrl,
                            "Proof of Payment",
                          )
                        }
                      />
                    </div>
                  ) : (
                    <p className="reservation-details-no-doc">
                      No proof of payment submitted yet
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Requirements Status Summary */}
          <div className="reservation-details-container reservation-details-container-highlight">
            <div className="reservation-details-container-body">
              <div className="reservation-details-requirements-check">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z"
                    fill="#10b981"
                  />
                </svg>
                <div>
                  <p className="reservation-details-requirements-title">
                    Requirements Uploaded
                  </p>
                  <p className="reservation-details-requirements-subtitle">
                    All documents submitted
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Notes Container */}
          <div className="reservation-details-container">
            <h3 className="reservation-details-section-title">Admin Notes</h3>
            <div className="reservation-details-container-body">
              <form
                onSubmit={handleUpdateNotes}
                className="reservation-details-notes-form"
              >
                <textarea
                  className="reservation-details-notes-textarea"
                  placeholder="Add notes about this reservation..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows="4"
                />
                {adminNotes !== (reservation?.notes || "") && (
                  <button
                    type="submit"
                    className="reservation-details-notes-button"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Saving..." : "Save Notes"}
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Current Status Container */}
          <div className="reservation-details-container">
            <h3 className="reservation-details-section-title">
              Current Status
            </h3>
            <div className="reservation-details-container-body">
              <p className="reservation-details-status">{statusLabel}</p>
            </div>
          </div>

          {/* Action Buttons Container */}
          <div className="reservation-details-container">
            <div className="reservation-details-container-body">
              <div className="reservation-details-actions">
                {normalizedStatus === "pending" && (
                  <button
                    className="reservation-details-button reservation-details-button-success"
                    onClick={handleConfirm}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Confirming..." : "Confirm Reservation"}
                  </button>
                )}
                {normalizedStatus !== "cancelled" &&
                  normalizedStatus !== "checked-out" && (
                    <button
                      className="reservation-details-button reservation-details-button-danger"
                      onClick={handleCancel}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Cancelling..." : "Cancel Reservation"}
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
