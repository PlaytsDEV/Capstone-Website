import React from "react";
import { AlertCircle, Bed, Home, MapPin, CheckCircle, ArrowRight } from "lucide-react";

const ReservationSummaryStep = ({ reservationData, onNext }) => {
  const room = reservationData?.room || {};
  const roomName =
    room.roomNumber || room.name || room.title || room.id || "N/A";
  const roomBranch = room.branch || "N/A";
  const roomType = room.type || "N/A";
  const roomFloor = room.floor || "N/A";
  const roomSize = room.size || "";
  const roomPrice = room.price || 0;
  const roomDeposit = room.deposit || 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ 
              backgroundColor: "#E7710F",
              boxShadow: "0 4px 14px rgba(231, 113, 15, 0.25)"
            }}
          >
            <Home className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 
              className="text-3xl font-bold mb-1"
              style={{ color: "#0C375F" }}
            >
              Reservation Summary
            </h2>
            <p className="text-gray-600">
              Review your selected room details before scheduling a visit
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div 
        className="bg-white rounded-3xl shadow-xl border overflow-hidden"
        style={{ borderColor: "#E5E7EB" }}
      >
        {/* Room Details Section */}
        <div 
          className="p-8"
          style={{
            background: "linear-gradient(135deg, #FAFAFA 0%, #FFFFFF 100%)"
          }}
        >
          <div className="flex items-start justify-between gap-6">
            {/* Left: Room Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: "#FEF3E7" }}
                >
                  <Bed 
                    className="w-8 h-8"
                    style={{ color: "#E7710F" }}
                  />
                </div>
                <div>
                  <h3 
                    className="text-2xl font-bold mb-1"
                    style={{ color: "#0C375F" }}
                  >
                    Room {roomName}
                  </h3>
                  <p className="text-base text-gray-600 font-medium">
                    {roomType}
                  </p>
                </div>
              </div>

              {/* Room Details Grid */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-gray-700">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "#F3F4F6" }}
                  >
                    <MapPin className="w-4 h-4" style={{ color: "#6B7280" }} />
                  </div>
                  <span className="text-sm font-medium">
                    {roomBranch} · Floor {roomFloor}
                  </span>
                </div>
                {roomSize && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: "#F3F4F6" }}
                    >
                      <Bed className="w-4 h-4" style={{ color: "#6B7280" }} />
                    </div>
                    <span className="text-sm font-medium">{roomSize}</span>
                  </div>
                )}
              </div>

              {/* Bed Selection Badge */}
              {reservationData?.selectedBed && (
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ 
                    backgroundColor: "#FEF3E7",
                    color: "#C2410C",
                    border: "2px solid #FDBA74"
                  }}
                >
                  <CheckCircle className="w-4 h-4" />
                  {reservationData.selectedBed.position} Bed (
                  {reservationData.selectedBed.id})
                </div>
              )}
            </div>

            {/* Right: Pricing Section */}
            <div 
              className="rounded-2xl p-6 min-w-[280px]"
              style={{
                background: "linear-gradient(135deg, #FEF3E7 0%, #FDEAD7 100%)",
                border: "2px solid #FED7AA"
              }}
            >
              <h4 
                className="text-sm font-semibold mb-4 uppercase tracking-wide"
                style={{ color: "#92400E" }}
              >
                Pricing Details
              </h4>
              
              {/* Monthly Rent */}
              <div className="mb-4">
                <p className="text-xs text-gray-600 mb-1">Monthly Rent</p>
                <div className="flex items-baseline gap-1">
                  <span 
                    className="text-3xl font-bold"
                    style={{ color: "#E7710F" }}
                  >
                    ₱{roomPrice.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-500">/month</span>
                </div>
              </div>

              {/* Security Deposit */}
              <div 
                className="pt-4 border-t"
                style={{ borderColor: "#FED7AA" }}
              >
                <p className="text-xs text-gray-600 mb-1">Security Deposit</p>
                <div className="flex items-baseline gap-1">
                  <span 
                    className="text-2xl font-bold"
                    style={{ color: "#0C375F" }}
                  >
                    ₱{roomDeposit.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Appliance Fees */}
              {reservationData?.applianceFees > 0 && (
                <div 
                  className="mt-4 pt-4 border-t"
                  style={{ borderColor: "#FED7AA" }}
                >
                  <p className="text-xs text-gray-600 mb-1">Appliance Fees</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-gray-700">
                      ₱{reservationData.applianceFees.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500">/month</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Next Step Info Banner */}
        <div 
          className="px-8 py-6"
          style={{ backgroundColor: "#EFF6FF" }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#DBEAFE" }}
            >
              <AlertCircle 
                className="w-5 h-5"
                style={{ color: "#1E40AF" }}
              />
            </div>
            <div className="flex-1">
              <h5 
                className="text-base font-semibold mb-1"
                style={{ color: "#1E3A8A" }}
              >
                Next Step: Schedule a Visit
              </h5>
              <p className="text-sm" style={{ color: "#1E40AF" }}>
                You will place a soft hold on this room. Schedule your visit to
                proceed with the application process.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-8 bg-white">
          <button
            onClick={onNext}
            className="w-full py-4 px-6 rounded-xl font-semibold text-white text-base flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: "#E7710F",
              boxShadow: "0 4px 14px rgba(231, 113, 15, 0.25)"
            }}
          >
            Continue to Schedule Visit
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-center text-xs text-gray-500 mt-3">
            You can review and modify your selection anytime
          </p>
        </div>
      </div>

      {/* Additional Info Cards */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div 
          className="bg-white rounded-xl p-4 border text-center"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div 
            className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
            style={{ backgroundColor: "#D1FAE5" }}
          >
            <CheckCircle className="w-5 h-5" style={{ color: "#059669" }} />
          </div>
          <p className="text-xs font-medium text-gray-900 mb-1">Verified Room</p>
          <p className="text-xs text-gray-500">Quality assured</p>
        </div>
        
        <div 
          className="bg-white rounded-xl p-4 border text-center"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div 
            className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
            style={{ backgroundColor: "#FEF3E7" }}
          >
            <Home className="w-5 h-5" style={{ color: "#E7710F" }} />
          </div>
          <p className="text-xs font-medium text-gray-900 mb-1">Soft Hold</p>
          <p className="text-xs text-gray-500">Room reserved</p>
        </div>
        
        <div 
          className="bg-white rounded-xl p-4 border text-center"
          style={{ borderColor: "#E5E7EB" }}
        >
          <div 
            className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
            style={{ backgroundColor: "#E0E7FF" }}
          >
            <AlertCircle className="w-5 h-5" style={{ color: "#4F46E5" }} />
          </div>
          <p className="text-xs font-medium text-gray-900 mb-1">No Commitment</p>
          <p className="text-xs text-gray-500">Cancel anytime</p>
        </div>
      </div>
    </div>
  );
};

export default ReservationSummaryStep;
