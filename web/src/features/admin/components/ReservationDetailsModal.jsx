import { useState } from 'react';
import '../styles/reservation-details-modal.css';

export default function ReservationDetailsModal({ reservation, onClose }) {
  const [adminNotes, setAdminNotes] = useState(reservation?.adminNotes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!reservation) return null;

  const handleMarkAsReady = async () => {
    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Marked as ready for move-in');
      // You can add a success message here
    } catch (error) {
      console.error('Error marking reservation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReleaseSlot = async () => {
    if (window.confirm('Are you sure you want to release this slot? This action cannot be undone.')) {
      setIsSubmitting(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Slot released');
        // You can add a success message here
      } catch (error) {
        console.error('Error releasing slot:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleUpdateNotes = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Admin notes updated:', adminNotes);
      // You can add a success message here
    } catch (error) {
      console.error('Error updating notes:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="reservation-details-modal-overlay" onClick={onClose}>
      <div className="reservation-details-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="reservation-details-modal-header">
          <div>
            <h2 className="reservation-details-modal-title">Reservation Details</h2>
            <p className="reservation-details-modal-id">{reservation.id}</p>
          </div>
          <button className="reservation-details-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="reservation-details-modal-content">
          {/* Customer Information Container */}
          <div className="reservation-details-container">
            <h3 className="reservation-details-section-title">Customer Information</h3>
            <div className="reservation-details-container-body">
              <div className="reservation-details-grid">
                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Name</label>
                  <p className="reservation-details-value">{reservation.customerName}</p>
                </div>

                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Email</label>
                  <p className="reservation-details-value">{reservation.customerEmail}</p>
                </div>

                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Phone</label>
                  <p className="reservation-details-value">{reservation.customerPhone}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Reservation Details Container */}
          <div className="reservation-details-container">
            <h3 className="reservation-details-section-title">Reservation Details</h3>
            <div className="reservation-details-container-body">
              <div className="reservation-details-grid-2col">
                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Room Type</label>
                  <p className="reservation-details-value">{reservation.roomType}</p>
                </div>

                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Branch</label>
                  <p className="reservation-details-value">{reservation.branch}</p>
                </div>

                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Preferred Move-In</label>
                  <p className="reservation-details-value">{reservation.preferredMoveIn}</p>
                </div>

                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Reservation Fee</label>
                  <p className="reservation-details-value reservation-details-fee">{reservation.reservationFee}</p>
                </div>

                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Expires On</label>
                  <p className="reservation-details-value">{reservation.expiresOn}</p>
                </div>

                <div className="reservation-details-form-group">
                  <label className="reservation-details-label">Days Remaining</label>
                  <p className="reservation-details-value reservation-details-days-remaining">{reservation.daysRemaining}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Declared Appliances Container */}
          <div className="reservation-details-container">
            <h3 className="reservation-details-section-title">Declared Appliances (₱{reservation.appliancePriceEach} each)</h3>
            <div className="reservation-details-container-body">
              <div className="reservation-details-appliances">
                {reservation.appliances.length > 0 ? (
                  reservation.appliances.map((appliance, index) => (
                    <span key={index} className="reservation-details-appliance-badge">{appliance}</span>
                  ))
                ) : (
                  <p className="reservation-details-no-appliances">No appliances declared</p>
                )}
              </div>
              {reservation.totalApplianceFee && reservation.totalApplianceFee !== '0' && (
                <div className="reservation-details-appliance-fee">
                  <span className="reservation-details-label">Total Appliance Fee:</span>
                  <span className="reservation-details-value">₱{reservation.totalApplianceFee}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Proof Container */}
          {reservation.paymentProofAmount && (
            <div className="reservation-details-container">
              <h3 className="reservation-details-section-title">Payment Proof (₱{reservation.paymentProofAmount})</h3>
              <div className="reservation-details-container-body">
                {reservation.paymentProofImage ? (
                  <img src={reservation.paymentProofImage} alt="Payment Proof" className="reservation-details-payment-image" />
                ) : (
                  <p className="reservation-details-no-image">No payment proof image available</p>
                )}
              </div>
            </div>
          )}

          {/* Requirements Status Container */}
          <div className="reservation-details-container reservation-details-container-highlight">
            <div className="reservation-details-container-body">
              <div className="reservation-details-requirements-check">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" fill="#10b981"/>
                </svg>
                <div>
                  <p className="reservation-details-requirements-title">Requirements Uploaded</p>
                  <p className="reservation-details-requirements-subtitle">All documents submitted</p>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Notes Container */}
          <div className="reservation-details-container">
            <h3 className="reservation-details-section-title">Admin Notes</h3>
            <div className="reservation-details-container-body">
              <form onSubmit={handleUpdateNotes} className="reservation-details-notes-form">
                <textarea
                  className="reservation-details-notes-textarea"
                  placeholder="Add notes about this reservation..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows="4"
                />
                {adminNotes !== (reservation?.adminNotes || '') && (
                  <button
                    type="submit"
                    className="reservation-details-notes-button"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Notes'}
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Current Status Container */}
          <div className="reservation-details-container">
            <h3 className="reservation-details-section-title">Current Status</h3>
            <div className="reservation-details-container-body">
              <p className="reservation-details-status">{reservation.status}</p>
            </div>
          </div>

          {/* Action Buttons Container */}
          <div className="reservation-details-container">
            <div className="reservation-details-container-body">
              <div className="reservation-details-actions">
                <button
                  className="reservation-details-button reservation-details-button-success"
                  onClick={handleMarkAsReady}
                  disabled={isSubmitting}
                >
                  Mark as Ready for Move-In
                </button>
                <button
                  className="reservation-details-button reservation-details-button-danger"
                  onClick={handleReleaseSlot}
                  disabled={isSubmitting}
                >
                  Release Slot (No-Show / Cancel)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
