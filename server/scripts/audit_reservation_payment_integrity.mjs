import "dotenv/config";
import mongoose from "mongoose";
import { Contract, Payment, Reservation, Room } from "../models/index.js";

if (process.argv.includes("--write")) {
  throw new Error("This audit is permanently read-only and does not support --write.");
}

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required.");

const safeIds = (documents) => documents.map((document) => String(document._id));
const report = {};

try {
  await mongoose.connect(uri);

  const reservations = await Reservation.find({})
    .select(
      "_id status paymentStatus reservationFeeAmount paymongoPaymentId roomId selectedBed proofOfPaymentUrl",
    )
    .lean();
  const reservationIds = reservations.map((reservation) => reservation._id);
  const payments = await Payment.find({
    reservationId: { $in: reservationIds },
    purpose: "reservation_deposit",
  })
    .select("_id reservationId status source paidAmount externalPaymentId")
    .lean();
  const rooms = await Room.find({
    _id: { $in: reservations.map((reservation) => reservation.roomId).filter(Boolean) },
  })
    .select("_id beds currentOccupancy")
    .lean();
  const contracts = await Contract.find({
    reservationId: { $in: reservationIds },
  })
    .select("_id reservationId pricingSnapshot")
    .lean();

  const paymentsByReservation = new Map();
  for (const payment of payments) {
    const key = String(payment.reservationId);
    paymentsByReservation.set(key, [...(paymentsByReservation.get(key) || []), payment]);
  }
  const roomById = new Map(rooms.map((room) => [String(room._id), room]));
  const contractByReservation = new Map(
    contracts.map((contract) => [String(contract.reservationId), contract]),
  );
  const confirmed = (reservation) =>
    (paymentsByReservation.get(String(reservation._id)) || []).filter((payment) =>
      ["confirmed", "paid"].includes(payment.status),
    );

  report.paidWithoutLedger = safeIds(
    reservations.filter(
      (reservation) => reservation.paymentStatus === "paid" && confirmed(reservation).length === 0,
    ),
  );
  report.reservedWithoutEvidence = safeIds(
    reservations.filter(
      (reservation) =>
        reservation.status === "reserved" &&
        confirmed(reservation).length === 0 &&
        !reservation.paymongoPaymentId,
    ),
  );
  report.paymongoIdStillPending = safeIds(
    reservations.filter(
      (reservation) =>
        reservation.paymongoPaymentId && reservation.paymentStatus !== "paid",
    ),
  );
  report.multipleSuccessfulDeposits = safeIds(
    reservations.filter((reservation) => confirmed(reservation).length > 1),
  );
  report.manualProofMissingAmount = payments
    .filter(
      (payment) =>
        payment.source === "manual_proof" && payment.paidAmount == null,
    )
    .map((payment) => String(payment._id));
  report.paidWithoutOccupancy = safeIds(
    reservations.filter((reservation) => {
      if (reservation.paymentStatus !== "paid" || !reservation.roomId) return false;
      const room = roomById.get(String(reservation.roomId));
      if (!room) return true;
      const bedId = reservation.selectedBed?.id;
      return bedId
        ? !room.beds?.some(
            (bed) =>
              bed.id === bedId &&
              String(bed.occupiedBy?.reservationId || "") === String(reservation._id),
          )
        : Number(room.currentOccupancy || 0) < 1;
    }),
  );
  report.reservedWithoutRoomOrBed = safeIds(
    reservations.filter(
      (reservation) =>
        reservation.status === "reserved" &&
        (!reservation.roomId ||
          (reservation.selectedBed?.required && !reservation.selectedBed?.id)),
    ),
  );
  report.cancelledWithSuccessfulPaymongo = safeIds(
    reservations.filter(
      (reservation) =>
        ["cancelled", "rejected", "archived"].includes(reservation.status) &&
        confirmed(reservation).some((payment) => payment.source === "paymongo"),
    ),
  );
  report.explicitZeroFee = safeIds(
    reservations.filter((reservation) => reservation.reservationFeeAmount === 0),
  );
  report.missingFee = safeIds(
    reservations.filter((reservation) => reservation.reservationFeeAmount == null),
  );
  report.contractPricingMismatch = safeIds(
    reservations.filter((reservation) => {
      const contract = contractByReservation.get(String(reservation._id));
      const contractFee = contract?.pricingSnapshot?.reservationFee;
      return contractFee != null &&
        reservation.reservationFeeAmount != null &&
        Math.round(Number(contractFee) * 100) !==
          Math.round(Number(reservation.reservationFeeAmount) * 100);
    }),
  );

  console.log(JSON.stringify({
    mode: "dry-run",
    writesPerformed: 0,
    reservationCount: reservations.length,
    findings: Object.fromEntries(
      Object.entries(report).map(([name, ids]) => [name, { count: ids.length, ids }]),
    ),
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
