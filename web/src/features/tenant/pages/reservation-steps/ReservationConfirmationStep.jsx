import React from "react";
import { 
  CheckCircle, 
  FileText, 
  Home,
  Calendar,
  MapPin,
  DollarSign,
  Bed,
  CreditCard,
  Phone,
  Mail,
  Copy,
  Download,
  ArrowRight,
  Shield,
  Clock,
  IdCard
} from "lucide-react";

const ReservationConfirmationStep = ({
  reservationData,
  reservationCode,
  finalMoveInDate,
  onViewDetails,
  onReturnHome,
}) => {
  const handleCopyCode = () => {
    navigator.clipboard.writeText(reservationCode);
    // You could add a toast notification here
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div
          className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center relative"
          style={{ 
            background: "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)",
            boxShadow: "0 8px 32px rgba(16, 185, 129, 0.3)"
          }}
        >
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{ 
              background: "linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)",
              opacity: 0.5
            }}
          ></div>
          <CheckCircle className="w-14 h-14 relative z-10" style={{ color: "#059669" }} />
        </div>
        <h2 className="text-4xl font-bold mb-3" style={{ color: "#0C375F" }}>
          Reservation Confirmed!
        </h2>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          Your dormitory reservation has been successfully secured. Check your email for the full details.
        </p>
      </div>

      <div className="space-y-6">
        {/* Reservation Code Card */}
        <div
          className="rounded-2xl p-6 text-center"
          style={{
            background: "linear-gradient(135deg, #FEF3E7 0%, #FDEAD7 100%)",
            border: "2px solid #FED7AA",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#92400E" }}>
            Your Reservation Code
          </p>
          <div className="flex items-center justify-center gap-3 mb-4">
            <p
              className="text-3xl font-bold font-mono"
              style={{ color: "#0C375F" }}
            >
              {reservationCode}
            </p>
            <button
              onClick={handleCopyCode}
              className="p-2 rounded-lg transition-all hover:bg-orange-200"
              style={{ backgroundColor: "#FED7AA" }}
              title="Copy code"
            >
              <Copy className="w-5 h-5" style={{ color: "#C2410C" }} />
            </button>
          </div>
          <p className="text-xs" style={{ color: "#92400E" }}>
            Save this code for your records and check-in
          </p>
        </div>

        {/* Reservation Summary Card */}
        <div
          className="bg-white rounded-2xl shadow-lg border p-6"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#FEF3E7" }}
            >
              <FileText className="w-5 h-5" style={{ color: "#E7710F" }} />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: "#0C375F" }}>
              Reservation Summary
            </h3>
          </div>

          <div
            className="rounded-xl p-5"
            style={{
              background: "linear-gradient(135deg, #FAFAFA 0%, #FFFFFF 100%)",
              border: "1px solid #E5E7EB",
            }}
          >
            <div className="space-y-3">
              {/* Branch */}
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "#F3F4F6" }}>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Branch</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 capitalize">
                  {reservationData.room.branch}
                </span>
              </div>

              {/* Room Type */}
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "#F3F4F6" }}>
                <div className="flex items-center gap-2">
                  <Bed className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Room Type</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 capitalize">
                  {reservationData.room.type}
                </span>
              </div>

              {/* Monthly Rate */}
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "#F3F4F6" }}>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Monthly Rate</span>
                </div>
                <span className="text-sm font-bold" style={{ color: "#E7710F" }}>
                  ₱{reservationData.room.price.toLocaleString()}
                </span>
              </div>

              {/* Final Move-In Date */}
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "#F3F4F6" }}>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Final Move-In Date</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {finalMoveInDate}
                </span>
              </div>

              {/* Payment Status */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Payment Status</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#10B981" }}></div>
                  <span className="text-sm font-semibold" style={{ color: "#059669" }}>
                    Paid
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* What to Prepare Section */}
        <div
          className="bg-white rounded-2xl shadow-lg border p-6"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#EFF6FF" }}
            >
              <Shield className="w-5 h-5" style={{ color: "#1E40AF" }} />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: "#0C375F" }}>
              What to Prepare
            </h3>
          </div>

          <div className="space-y-4">
            {/* Important Dates */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "#FEF3E7", border: "1px solid #FED7AA" }}
            >
              <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "#92400E" }}>
                <Calendar className="w-4 h-4" />
                Important Dates
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Move-In Date:</span>
                  <span className="font-semibold" style={{ color: "#0C375F" }}>
                    {finalMoveInDate}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Reservation Valid Until:</span>
                  <span className="font-semibold" style={{ color: "#0C375F" }}>
                    {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Required Documents */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}
            >
              <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "#065F46" }}>
                <IdCard className="w-4 h-4" />
                Required Documents for Check-In
              </h4>
              <div className="space-y-2">
                {[
                  "Valid ID (Government-issued)",
                  "This reservation code",
                  "First month's rent payment",
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#10B981" }} />
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Information */}
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}
            >
              <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "#1E3A8A" }}>
                <Phone className="w-4 h-4" />
                Admin Contact
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" style={{ color: "#3B82F6" }} />
                  <span className="text-gray-700">(02) 123-4567</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" style={{ color: "#3B82F6" }} />
                  <span className="text-gray-700">reservations@lilycrest.com</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Next Steps Card */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "linear-gradient(135deg, #E0E7FF 0%, #C7D2FE 100%)",
            border: "2px solid #A5B4FC",
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#DBEAFE" }}
            >
              <Clock className="w-6 h-6" style={{ color: "#1E40AF" }} />
            </div>
            <div>
              <h4 className="font-semibold mb-2" style={{ color: "#1E3A8A" }}>
                What Happens Next?
              </h4>
              <ul className="space-y-2 text-sm" style={{ color: "#3730A3" }}>
                <li className="flex items-start gap-2">
                  <span className="font-bold mt-0.5">1.</span>
                  <span>You'll receive a confirmation email with all the details</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold mt-0.5">2.</span>
                  <span>Our team will contact you 3 days before your move-in date</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold mt-0.5">3.</span>
                  <span>Prepare your documents and arrive on your scheduled date</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onViewDetails}
            className="flex-1 px-6 py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: "#E7710F",
              boxShadow: "0 4px 14px rgba(231, 113, 15, 0.25)",
            }}
          >
            <FileText className="w-5 h-5" />
            View Reservation Details
          </button>
          <button
            onClick={onReturnHome}
            className="flex-1 px-6 py-4 rounded-xl font-semibold border-2 transition-all flex items-center justify-center gap-2 hover:bg-gray-50"
            style={{ 
              borderColor: "#E5E7EB",
              color: "#374151"
            }}
          >
            <Home className="w-5 h-5" />
            Return to Home
          </button>
        </div>

        {/* Download Receipt Option */}
        <div className="text-center">
          <button
            className="text-sm font-medium inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all hover:bg-gray-100"
            style={{ color: "#6B7280" }}
          >
            <Download className="w-4 h-4" />
            Download Receipt (PDF)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReservationConfirmationStep;
