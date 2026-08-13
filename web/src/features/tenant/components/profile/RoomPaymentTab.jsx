import React from "react";
import { Link } from "react-router-dom";
import { Bed, MapPin, Clock, Check } from "lucide-react";
import { fmtDate } from "../../../../shared/utils/formatDate";
import "../../../admin/styles/design-tokens.css";

/**
 * Room & Payment tab content for ProfilePage.
 * Displays selected room info, reservation details, and payment breakdown.
 */

const getReservationStatusStyle = (status) => {
 if (status === "reserved" || status === "active") {
 return { backgroundColor: "var(--success-light)", color: "var(--success-dark)" };
 }
 if (status === "visit-completed") {
 return { backgroundColor: "var(--info-light)", color: "var(--info-dark)" };
 }
 if (status === "pending") {
 return { backgroundColor: "var(--warning-light)", color: "var(--warning-dark)" };
 }
 return { backgroundColor: "var(--danger-light)", color: "var(--danger-dark)" };
};

const RoomPaymentTab = ({
 selectedRoom,
 activeReservation,
 activeStatusLabel,
}) => (
 <div className="max-w-5xl">
 <div className="mb-8">
 <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--foreground)" }}>
 Room & Payment
 </h1>
 <p className="text-sm text-muted-foreground">
 Your selected room, reservation, and payment details
 </p>
 </div>

 <div className="space-y-6">
 {/* Selected Room */}
 {selectedRoom && (
 <div
 className="bg-card rounded-xl p-6 border"
 style={{ borderColor: "var(--border)" }}
 >
 <h3
 className="font-semibold text-lg mb-4"
 style={{ color: "var(--foreground)" }}
 >
 Selected Room
 </h3>
 <div
 className="p-5 rounded-lg"
 style={{ backgroundColor: "var(--accent)" }}
 >
 <div className="flex items-start justify-between mb-4">
 <div>
 <h4
 className="text-2xl font-bold mb-1"
 style={{ color: "var(--foreground)" }}
 >
 Room {selectedRoom.roomNumber}
 </h4>
 <p className="text-sm text-muted-foreground mb-2">
 {selectedRoom.roomType}
 </p>
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <MapPin className="w-4 h-4" />
 <span>
 {selectedRoom.location} · Floor {selectedRoom.floor}
 </span>
 </div>
 </div>
 <div
 className="w-14 h-14 rounded-lg flex items-center justify-center"
 style={{ backgroundColor: "var(--primary)" }}
 >
 <Bed className="w-7 h-7 text-primary-foreground" />
 </div>
 </div>
 <div className="pt-4 border-t" style={{ borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)" }}>
 <p className="text-xs text-muted-foreground mb-1">Monthly Rent</p>
 <p className="text-3xl font-bold" style={{ color: "var(--primary)" }}>
 ₱{selectedRoom.price.toLocaleString()}
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Reservation details */}
 {activeReservation && (
 <div
 className="bg-card rounded-xl p-6 border"
 style={{ borderColor: "var(--border)" }}
 >
 <h3
 className="font-semibold text-lg mb-4"
 style={{ color: "var(--foreground)" }}
 >
 Reservation Details
 </h3>
 <div className="grid grid-cols-2 gap-6 mb-6">
 <div>
 <p className="text-xs font-medium text-muted-foreground mb-2">
 Reservation Status
 </p>
 <span
 className="inline-block px-3 py-1.5 rounded-lg text-sm font-medium"
 style={getReservationStatusStyle(activeStatusLabel)}
 >
 {activeStatusLabel}
 </span>
 </div>
 <div>
 <p className="text-xs font-medium text-muted-foreground mb-2">
 Move-In Date
 </p>
 <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
 {fmtDate(activeReservation.moveInDate)}
 </p>
 </div>
 </div>

 <div className="pt-6 border-t" style={{ borderColor: "var(--border)" }}>
 <div className="flex items-center justify-between mb-4">
 <h4 className="font-semibold">Payment Breakdown</h4>
 <span
 className="px-3 py-1 rounded-full text-xs font-medium"
 style={{ backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)" }}
 >
 {activeReservation.paymentStatus || "Pending"}
 </span>
 </div>
 <div className="space-y-3 mb-6">
 {activeReservation.paymentVerified ? (
 <div
 className="flex items-center justify-between p-4 rounded-lg"
 style={{ backgroundColor: "var(--success-light)" }}
 >
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--success)" }}>
 <Check className="w-5 h-5" style={{ color: "var(--success-foreground)" }} />
 </div>
 <div>
 <p className="text-sm font-medium">Security Deposit</p>
 <p className="text-xs text-muted-foreground">Paid</p>
 </div>
 </div>
 <p className="text-lg font-bold" style={{ color: "var(--success)" }}>
 ₱{(activeReservation.totalAmount || 0).toLocaleString()}
 </p>
 </div>
 ) : (
 <div
 className="flex items-center justify-between p-4 rounded-lg border"
 style={{ borderColor: "var(--border)" }}
 >
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center">
 <Clock className="w-5 h-5 text-muted-foreground" />
 </div>
 <div>
 <p className="text-sm font-medium">Payment Due</p>
 <p className="text-xs text-muted-foreground">Pending</p>
 </div>
 </div>
 <p className="text-lg font-bold" style={{ color: "var(--primary)" }}>
 ₱{(activeReservation.totalAmount || 0).toLocaleString()}
 </p>
 </div>
 )}
 </div>
 {!activeReservation.paymentVerified && (
 <button
 className="w-full py-3 text-sm font-medium rounded-lg transition-colors"
 style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
 >
 Pay Deposit - ₱
 {(activeReservation.totalAmount || 0).toLocaleString()}
 </button>
 )}
 </div>
 </div>
 )}

 {/* No active reservation */}
 {!activeReservation && (
 <div
 className="bg-card rounded-xl p-8 border text-center"
 style={{ borderColor: "var(--border)" }}
 >
 <Bed className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--neutral)" }} />
 <h3 className="text-lg font-semibold text-card-foreground mb-2">
 No Active Reservation
 </h3>
 <p className="text-sm text-muted-foreground mb-6">
 Start browsing rooms to make a reservation
 </p>
 <Link to="/applicant/check-availability">
 <button
 className="px-6 py-3 rounded-lg font-medium"
 style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
 >
 Browse Available Rooms
 </button>
 </Link>
 </div>
 )}
 </div>
 </div>
);

export default RoomPaymentTab;
