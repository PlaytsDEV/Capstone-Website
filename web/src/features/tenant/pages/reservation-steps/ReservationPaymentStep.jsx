import React from "react";
import { 
  Clock, 
  DollarSign, 
  Upload, 
  Calendar,
  Bed,
  MapPin,
  Home,
  CheckCircle,
  CreditCard,
  AlertCircle,
  ArrowRight,
  Building,
  User,
  RefreshCw
} from "lucide-react";

// Helper function to format branch name
const formatBranch = (branch) => {
  if (!branch) return "N/A";
  // If already formatted (e.g., "Gil Puyat"), return as-is
  if (branch.includes(" ") && !branch.includes("-")) return branch;
  // Otherwise format from slug (e.g., "gil-puyat" -> "Gil Puyat")
  return branch
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper function to format room type
const formatRoomType = (type) => {
  if (!type) return "N/A";
  // If already formatted (e.g., "Private", "Shared", "Quadruple"), return as-is
  if (!type.includes("-")) return type;
  // Otherwise format from slug
  return type
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return "Not set";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Helper function to get room name from various possible fields
const getRoomName = (room) => {
  if (!room) return "N/A";
  // Direct name fields
  if (room.name) return room.name;
  if (room.roomNumber) return room.roomNumber;
  // Extract from title (e.g., "Room 101" -> "101")
  if (room.title) {
    const match = room.title.match(/Room\s+(.+)/i);
    return match ? match[1] : room.title;
  }
  // Use id as fallback
  if (room.id) return room.id;
  return "N/A";
};

const ReservationPaymentStep = ({
  reservationData,
  leaseDuration,
  finalMoveInDate,
  setFinalMoveInDate,
  onMoveInDateUpdate,
  paymentMethod,
  setPaymentMethod,
  proofOfPayment,
  setProofOfPayment,
  isLoading,
  onPrev,
  onNext,
}) => {
  const room = reservationData?.room || {};

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
            style={{
              backgroundColor: "#E7710F",
              boxShadow: "0 4px 14px rgba(231, 113, 15, 0.25)",
            }}
          >
            <DollarSign className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-1" style={{ color: "#0C375F" }}>
              Reservation Fee Payment
            </h2>
            <p className="text-gray-600">
              Review your final details and secure your reservation with a ₱2,000 fee
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Payment Deadline Alert */}
        <div
          className="p-5 rounded-2xl border-2"
          style={{ backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#FEF9C3" }}
            >
              <Clock className="w-5 h-5" style={{ color: "#D97706" }} />
            </div>
            <div>
              <h4 className="font-semibold mb-1" style={{ color: "#92400E" }}>
                Payment must be submitted within 48 hours
              </h4>
              <p className="text-sm" style={{ color: "#B45309" }}>
                Your application will expire if payment is not received within the deadline.
              </p>
            </div>
          </div>
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
              <Bed className="w-5 h-5" style={{ color: "#E7710F" }} />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: "#0C375F" }}>
              Reservation Details
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
              {/* Room */}
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "#F3F4F6" }}>
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Room</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {getRoomName(room)}
                </span>
              </div>

              {/* Branch */}
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "#F3F4F6" }}>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Branch</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatBranch(room.branch)}
                </span>
              </div>

              {/* Room Type */}
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "#F3F4F6" }}>
                <div className="flex items-center gap-2">
                  <Bed className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Room Type</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatRoomType(room.type)}
                </span>
              </div>

              {/* Monthly Rent */}
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "#F3F4F6" }}>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Monthly Rent</span>
                </div>
                <span className="text-sm font-bold" style={{ color: "#E7710F" }}>
                  ₱{(room.price || 0).toLocaleString()}
                </span>
              </div>

              {/* Lease Duration */}
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "#F3F4F6" }}>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Lease Duration</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {leaseDuration || 12} months
                </span>
              </div>

              {/* Target Move-In Date */}
              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "#F3F4F6" }}>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Target Move-In Date</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatDate(finalMoveInDate)}
                </span>
              </div>

              {/* Selected Bed */}
              {reservationData?.selectedBed && (
                <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: "#F3F4F6" }}>
                  <div className="flex items-center gap-2">
                    <Bed className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Selected Bed</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {reservationData.selectedBed.position} ({reservationData.selectedBed.id})
                  </span>
                </div>
              )}

              {/* Total Fee */}
              <div
                className="flex items-center justify-between py-4 mt-4 pt-4 border-t-2"
                style={{ borderColor: "#E5E7EB" }}
              >
                <span className="text-base font-semibold" style={{ color: "#0C375F" }}>
                  Reservation Fee
                </span>
                <span className="text-2xl font-bold" style={{ color: "#E7710F" }}>
                  ₱2,000
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Move-In Date Update Section */}
        <div
          className="bg-white rounded-2xl shadow-lg border p-6"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#FEF3E7" }}
            >
              <Calendar className="w-5 h-5" style={{ color: "#E7710F" }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold" style={{ color: "#0C375F" }}>
                Final Move-In Date
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Need to adjust your move-in date? Click "Re-Check" to verify room availability
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="date"
                  className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm"
                  value={finalMoveInDate}
                  onChange={(e) => setFinalMoveInDate(e.target.value)}
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onMoveInDateUpdate}
              className="px-6 py-3 rounded-xl font-semibold text-gray-700 border-2 transition-all hover:bg-gray-50 whitespace-nowrap flex items-center gap-2"
              style={{ borderColor: "#E5E7EB" }}
              title="Verify if the room is still available on the selected date"
            >
              <RefreshCw className="w-4 h-4" />
              Re-Check Availability
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            The Re-Check button verifies if your selected room is still available on the new move-in date
          </p>
        </div>

        {/* Payment Method Section */}
        <div
          className="bg-white rounded-2xl shadow-lg border p-6"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#FEF3E7" }}
            >
              <CreditCard className="w-5 h-5" style={{ color: "#E7710F" }} />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: "#0C375F" }}>
              Payment Method
            </h3>
          </div>

          <div className="mb-5">
            <select
              className="w-full px-4 py-3 border rounded-xl text-sm appearance-none bg-white font-medium"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{ borderColor: "#E5E7EB" }}
            >
              <option value="bank">🏦 Bank Transfer</option>
              <option value="gcash">💳 GCash</option>
              <option value="card">💳 Credit/Debit Card</option>
              <option value="check">📝 Check</option>
            </select>
          </div>

          {/* Payment Details Box */}
          <div
            className="rounded-xl p-5"
            style={{
              background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
              border: "1px solid #BFDBFE",
            }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#DBEAFE" }}
              >
                <Building className="w-5 h-5" style={{ color: "#1E40AF" }} />
              </div>
              <div>
                <h4 className="font-semibold mb-1" style={{ color: "#1E3A8A" }}>
                  Payment Details
                </h4>
                <p className="text-xs" style={{ color: "#1E40AF" }}>
                  Please transfer the exact amount to the account below
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                <span className="text-xs font-medium text-gray-600">Bank Account</span>
                <span className="text-sm font-bold" style={{ color: "#0C375F" }}>
                  BDO - 1234-5678-9012
                </span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                <span className="text-xs font-medium text-gray-600">Account Name</span>
                <span className="text-sm font-semibold text-gray-900">
                  Dormitory Services Inc.
                </span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-white rounded-lg">
                <span className="text-xs font-medium text-gray-600">Amount</span>
                <span className="text-sm font-bold" style={{ color: "#E7710F" }}>
                  ₱2,000
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Proof of Payment Section */}
        <div
          className="bg-white rounded-2xl shadow-lg border p-6"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#FEF3E7" }}
            >
              <Upload className="w-5 h-5" style={{ color: "#E7710F" }} />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: "#0C375F" }}>
              Proof of Payment
            </h3>
          </div>

          <label
            className="flex items-center gap-4 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-orange-400 hover:bg-orange-50"
            htmlFor="payment-file"
            style={{ borderColor: proofOfPayment ? "#E7710F" : "#E5E7EB" }}
          >
            <input
              id="payment-file"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setProofOfPayment(e.target.files?.[0] || null)}
              className="sr-only"
            />
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: proofOfPayment ? "#FEF3E7" : "#F3F4F6",
              }}
            >
              <Upload
                className="w-6 h-6"
                style={{ color: proofOfPayment ? "#E7710F" : "#6B7280" }}
              />
            </div>
            <div className="flex-1">
              <p
                className="text-sm font-medium"
                style={{ color: proofOfPayment ? "#E7710F" : "#374151" }}
              >
                {proofOfPayment ? proofOfPayment.name : "Upload receipt or screenshot"}
              </p>
              <p className="text-xs text-gray-500">
                {proofOfPayment ? "Click to change" : "JPG, PNG, PDF up to 5MB"}
              </p>
            </div>
            {proofOfPayment && (
              <CheckCircle className="w-5 h-5" style={{ color: "#10B981" }} />
            )}
          </label>

          <div
            className="mt-4 p-4 rounded-xl border"
            style={{ backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }}
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#059669" }} />
              <p className="text-xs" style={{ color: "#065F46" }}>
                <strong>Important:</strong> Make sure your receipt clearly shows the transaction details, amount, and date.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onPrev}
            className="px-6 py-3 rounded-xl font-semibold text-gray-700 border-2 transition-all hover:bg-gray-50"
            style={{ borderColor: "#E5E7EB" }}
            disabled={isLoading}
          >
            Back
          </button>
          <button
            onClick={onNext}
            disabled={isLoading}
            className="flex-1 px-6 py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: isLoading ? "#D1D5DB" : "#E7710F",
              boxShadow: isLoading ? "none" : "0 4px 14px rgba(231, 113, 15, 0.25)",
            }}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Processing...
              </>
            ) : (
              <>
                Confirm Payment & Reserve
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReservationPaymentStep;
