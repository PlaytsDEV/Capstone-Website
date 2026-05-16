import React from "react";
import { formatBranch, formatRoomType } from "../../../../shared/utils/formatDate";
import {
  Home,
  MapPin,
  Bed,
  CheckCircle2,
  AlertCircle,
  Info,
  ArrowRight,
  Lock,
  DollarSign,
  Calendar,
  Sparkles,
} from "lucide-react";

const ReservationSummaryStep = ({ reservationData, onNext, readOnly }) => {
  const room = reservationData?.room || {};
  const monthlyRent = room.price || 0;
  const applianceFees = reservationData?.applianceFees || 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Step Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-full">
          <span className="text-xs font-semibold text-orange-700 uppercase tracking-wider">
            Step 1 · Getting Started
          </span>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl">
              <Home className="w-6 h-6 text-white" />
            </div>
            Room Summary
          </h2>
          <p className="text-slate-600 leading-relaxed">
            Review the details of your selected room below. Once confirmed,
            you'll proceed to choose your viewing or move-in preference.
          </p>
        </div>
      </div>

      {/* Room Details Card */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-lg overflow-hidden">
        {/* Card Header */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Sparkles className="w-5 h-5 text-orange-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Room Information</h3>
          </div>
        </div>

        {/* Summary Section */}
        <div className="p-6 space-y-4">
          {/* Branch */}
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-600">Branch</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">
              {formatBranch(room.branch)}
            </span>
          </div>

          {/* Room Type */}
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <Home className="w-5 h-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-600">Room Type</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">
              {formatRoomType(room.type)}
            </span>
          </div>

          {/* Room Number */}
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-600">Room Number</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">
              {room.roomNumber || room.name || room.title || room.id || "N/A"}
            </span>
          </div>

          {/* Selected Bed */}
          {reservationData?.selectedBed && (
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <Bed className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">
                  Selected Bed
                </span>
              </div>
              <span className="text-sm font-semibold text-slate-900 capitalize">
                {reservationData.selectedBed.position} Bed (
                {reservationData.selectedBed.id})
              </span>
            </div>
          )}

          {/* Appliance Fees */}
          {applianceFees > 0 && (
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">
                  Appliance Fees
                </span>
              </div>
              <span className="text-sm font-semibold text-slate-900">
                ₱{applianceFees.toLocaleString()}/month
              </span>
            </div>
          )}

          {/* Total Section */}
          <div className="mt-6 pt-6 border-t-2 border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-slate-900">
                  Monthly Rent
                </span>
              </div>
              <span className="text-3xl font-bold text-orange-600">
                ₱{monthlyRent.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-blue-500 rounded-xl flex-shrink-0">
            <Info className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-base font-bold text-blue-900 mb-2">
              What happens next?
            </h4>
            <p className="text-sm text-blue-700 leading-relaxed">
              After confirming, you'll choose between a physical visit, 2D
              remote viewing, or an urgent move-in review request before
              submitting your tenant application.
            </p>
          </div>
        </div>
      </div>

      {/* Read-Only Notice */}
      {readOnly && (
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-300 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-amber-500 rounded-xl flex-shrink-0">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-base font-bold text-amber-900 mb-1">
                This step is locked
              </h4>
              <p className="text-sm text-amber-700">
                Room selection has been confirmed and cannot be changed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      {!readOnly && (
        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={onNext}
            className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-semibold text-base shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all"
          >
            <CheckCircle2 className="w-5 h-5" />
            Confirm Room &amp; Continue
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <div className="bg-white rounded-xl border-2 border-green-200 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h5 className="text-sm font-bold text-slate-900 mb-1">
                Verified Room
              </h5>
              <p className="text-xs text-slate-600">
                Quality assured and inspected
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 border-blue-200 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h5 className="text-sm font-bold text-slate-900 mb-1">
                Flexible Booking
              </h5>
              <p className="text-xs text-slate-600">
                Schedule your visit anytime
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 border-purple-200 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h5 className="text-sm font-bold text-slate-900 mb-1">
                No Commitment
              </h5>
              <p className="text-xs text-slate-600">
                Cancel or modify anytime
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationSummaryStep;