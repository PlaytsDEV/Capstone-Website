import { useState } from 'react';
import '../styles/inquiry-details-modal.css';

export default function InquiryDetailsModal({ inquiry, onClose }) {
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!inquiry) return null;

  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    if (!response.trim()) return;

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Response sent:', response);
      setResponse('');
      // You can add a success message here
    } catch (error) {
      console.error('Error sending response:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const dateTime = `${inquiry.date} at ${inquiry.time}`;

  return (
    <div className="inquiry-details-modal-overlay" onClick={onClose}>
      <div className="inquiry-details-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="inquiry-details-modal-header">
          <h2 className="inquiry-details-modal-title">Inquiry Details</h2>
          <button className="inquiry-details-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="inquiry-details-modal-tabs">
          <span className="inquiry-details-modal-tab-pill">General</span>
        </div>

        {/* Content */}
        <div className="inquiry-details-modal-content">
          {/* Inquiry Information */}
          <div className="inquiry-details-modal-section">
            <div className="inquiry-details-modal-form-group">
              <label className="inquiry-details-modal-label">Name</label>
              <p className="inquiry-details-modal-value">{inquiry.name}</p>
            </div>

            <div className="inquiry-details-modal-form-group">
              <label className="inquiry-details-modal-label">Email</label>
              <p className="inquiry-details-modal-value">{inquiry.email}</p>
            </div>

            <div className="inquiry-details-modal-form-group">
              <label className="inquiry-details-modal-label">Phone</label>
              <p className="inquiry-details-modal-value">{inquiry.phone}</p>
            </div>

            <div className="inquiry-details-modal-form-group">
              <label className="inquiry-details-modal-label">Branch</label>
              <p className="inquiry-details-modal-value">{inquiry.branch}</p>
            </div>

            <div className="inquiry-details-modal-form-group">
              <label className="inquiry-details-modal-label">Date & Time</label>
              <p className="inquiry-details-modal-value">{dateTime}</p>
            </div>

            <div className="inquiry-details-modal-form-group">
              <label className="inquiry-details-modal-label">Message</label>
              <div className="inquiry-details-modal-message-box">
                <p className="inquiry-details-modal-message-text">
                  I need information about your deluxe rooms and monthly rates. Also, are pets allowed?
                </p>
              </div>
            </div>
          </div>

          {/* Send Response Section */}
          <div className="inquiry-details-modal-response-section">
            <h3 className="inquiry-details-modal-response-title">Send Response</h3>
            <form onSubmit={handleSubmitResponse} className="inquiry-details-modal-response-form">
              <textarea
                className="inquiry-details-modal-response-textarea"
                placeholder="Type your response here..."
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows="6"
              />
              <button
                type="submit"
                className="inquiry-details-modal-response-button"
                disabled={!response.trim() || isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Send Response'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
