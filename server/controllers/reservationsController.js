/**
 * Reservation Controllers
 */

import { Reservation, User, Room } from "../models/index.js";
import auditLogger from "../utils/auditLogger.js";

export const getReservations = async (req, res) => {
  try {
    const user = req.user;

    // Find user in database to get role and branch
    const dbUser = await User.findOne({ firebaseUid: user.uid });

    if (!dbUser) {
      return res.status(404).json({
        error: "User not found in database",
        code: "USER_NOT_FOUND",
      });
    }

    let reservations;

    // Super admin sees all reservations
    if (dbUser.role === "superAdmin") {
      reservations = await Reservation.find()
        .populate("userId", "firstName lastName email")
        .populate("roomId", "name branch type price")
        .select("-__v")
        .sort({ createdAt: -1 });
    }
    // Admin sees reservations for rooms in their branch
    else if (dbUser.role === "admin") {
      // First get all rooms for the admin's branch
      const branchRooms = await Room.find({ branch: dbUser.branch }).select(
        "_id",
      );
      const roomIds = branchRooms.map((room) => room._id);

      reservations = await Reservation.find({ roomId: { $in: roomIds } })
        .populate("userId", "firstName lastName email")
        .populate("roomId", "name branch type price")
        .select("-__v")
        .sort({ createdAt: -1 });
    }
    // Regular users/tenants see only their own reservations
    else {
      reservations = await Reservation.find({ userId: dbUser._id })
        .populate("userId", "firstName lastName email")
        .populate("roomId", "name branch type price")
        .select("-__v")
        .sort({ createdAt: -1 });
    }

    console.log(
      `✅ Retrieved ${reservations.length} reservations for ${dbUser.email} (${dbUser.role})`,
    );
    res.json(reservations);
  } catch (error) {
    console.error("❌ Fetch reservations error:", error);
    res.status(500).json({
      error: "Failed to fetch reservations",
      details: error.message,
      code: "FETCH_RESERVATIONS_ERROR",
    });
  }
};

export const getReservationById = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const user = req.user;

    if (!reservationId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "Invalid reservation ID format",
        code: "INVALID_RESERVATION_ID",
      });
    }

    const dbUser = await User.findOne({ firebaseUid: user.uid });
    if (!dbUser) {
      return res.status(404).json({
        error: "User not found in database",
        code: "USER_NOT_FOUND",
      });
    }

    const reservation = await Reservation.findById(reservationId)
      .populate("userId", "firstName lastName email")
      .populate("roomId", "name branch type price floor");

    if (!reservation) {
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    }

    if (
      dbUser.role !== "admin" &&
      dbUser.role !== "superAdmin" &&
      String(reservation.userId?._id) !== String(dbUser._id)
    ) {
      return res.status(403).json({
        error: "Access denied. You can only view your own reservations.",
        code: "RESERVATION_ACCESS_DENIED",
      });
    }

    res.json(reservation);
  } catch (error) {
    console.error("❌ Fetch reservation error:", error);
    res.status(500).json({
      error: "Failed to fetch reservation",
      details: error.message,
      code: "FETCH_RESERVATION_ERROR",
    });
  }
};

export const createReservation = async (req, res) => {
  try {
    // Find user in database
    const dbUser = await User.findOne({ firebaseUid: req.user.uid });

    if (!dbUser) {
      return res.status(404).json({
        error:
          "User not found in database. Please complete registration first.",
        code: "USER_NOT_FOUND",
      });
    }

    // Validate required fields
    const { roomId, roomName, checkInDate, totalPrice } = req.body;

    if ((!roomId && !roomName) || !checkInDate || !totalPrice) {
      return res.status(400).json({
        error:
          "Missing required fields: roomId or roomName, checkInDate, and totalPrice are required",
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    // Verify room exists - look up by ID or name
    let room;
    if (roomId) {
      room = await Room.findById(roomId);
    } else if (roomName) {
      room = await Room.findOne({ name: roomName });
    }

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
        code: "ROOM_NOT_FOUND",
      });
    }

    // Check if room is available
    if (!room.available) {
      return res.status(400).json({
        error: "Room is not available for reservation",
        code: "ROOM_NOT_AVAILABLE",
      });
    }

    // Create new reservation with ALL fields from the form
    const reservation = new Reservation({
      userId: dbUser._id,
      roomId: room._id,

      // Bed Assignment
      selectedBed: req.body.selectedBed
        ? {
            id: req.body.selectedBed.id || null,
            position: req.body.selectedBed.position || null,
          }
        : null,

      // Stage 1: Summary
      targetMoveInDate: req.body.targetMoveInDate
        ? new Date(req.body.targetMoveInDate)
        : null,
      leaseDuration: req.body.leaseDuration || 12,
      billingEmail: req.body.billingEmail || dbUser.email,

      // Stage 2: Visit
      viewingType: req.body.viewingType || "inperson",
      isOutOfTown: req.body.isOutOfTown || false,
      currentLocation: req.body.currentLocation || null,
      visitApproved: req.body.visitApproved || true,

      // Stage 3: Details - Photos
      selfiePhotoUrl: req.body.selfiePhotoUrl || null,

      // Stage 3: Personal Information
      firstName: req.body.firstName || null,
      lastName: req.body.lastName || null,
      middleName: req.body.middleName || null,
      nickname: req.body.nickname || null,
      mobileNumber: req.body.mobileNumber || null,
      birthday: req.body.birthday ? new Date(req.body.birthday) : null,
      maritalStatus: req.body.maritalStatus || null,
      nationality: req.body.nationality || null,
      educationLevel: req.body.educationLevel || null,

      // Stage 3: Address
      address: {
        unitHouseNo: req.body.addressUnitHouseNo || null,
        street: req.body.addressStreet || null,
        barangay: req.body.addressBarangay || null,
        city: req.body.addressCity || null,
        province: req.body.addressProvince || null,
      },

      // Stage 3: Identity Documents
      validIDFrontUrl: req.body.validIDFrontUrl || null,
      validIDBackUrl: req.body.validIDBackUrl || null,
      validIDType: req.body.validIDType || null,
      nbiClearanceUrl: req.body.nbiClearanceUrl || null,
      nbiReason: req.body.nbiReason || null,
      companyIDUrl: req.body.companyIDUrl || null,
      companyIDReason: req.body.companyIDReason || null,

      // Stage 3: Emergency Contact
      emergencyContact: {
        name: req.body.emergencyContactName || null,
        relationship: req.body.emergencyRelationship || null,
        contactNumber: req.body.emergencyContactNumber || null,
      },
      healthConcerns: req.body.healthConcerns || null,

      // Stage 3: Employment
      employment: {
        employerSchool: req.body.employerSchool || null,
        employerAddress: req.body.employerAddress || null,
        employerContact: req.body.employerContact || null,
        startDate: req.body.startDate ? new Date(req.body.startDate) : null,
        occupation: req.body.occupation || null,
        previousEmployment: req.body.previousEmployment || null,
      },

      // Stage 3: Dorm-Related
      preferredRoomType: req.body.roomType || null,
      preferredRoomNumber: req.body.preferredRoomNumber || null,
      referralSource: req.body.referralSource || null,
      referrerName: req.body.referrerName || null,
      estimatedMoveInTime: req.body.estimatedMoveInTime || null,
      workSchedule: req.body.workSchedule || null,
      workScheduleOther: req.body.workScheduleOther || null,

      // Stage 3: Agreements
      agreedToPrivacy: req.body.agreedToPrivacy || false,
      agreedToCertification: req.body.agreedToCertification || false,

      // Stage 4: Payment
      proofOfPaymentUrl: req.body.proofOfPaymentUrl || null,
      applianceFees: req.body.applianceFees || 0,

      // Reservation Dates & Status
      checkInDate: req.body.checkInDate,
      checkOutDate: req.body.checkOutDate || null,
      totalPrice: req.body.totalPrice,
      notes: req.body.notes || "",
      status: "pending",
      paymentStatus: "pending",
    });

    // Save reservation to database
    await reservation.save();

    // Populate user and room details for response
    await reservation.populate("userId", "firstName lastName email");
    await reservation.populate("roomId", "name branch type price");

    // Log reservation creation
    await auditLogger.logModification(
      req,
      "reservation",
      reservation._id,
      null,
      reservation.toObject(),
      `Created reservation for room: ${room.name}`,
    );

    console.log(
      `✅ Reservation created: ${reservation._id} (${reservation.reservationCode}) for ${dbUser.email}`,
    );
    res.status(201).json({
      message: "Reservation created successfully",
      reservationId: reservation._id,
      reservationCode: reservation.reservationCode,
      reservation,
    });
  } catch (error) {
    console.error("❌ Create reservation error:", error);
    console.error("Error stack:", error.stack);
    await auditLogger.logError(req, error, "Failed to create reservation");

    // Handle validation errors
    if (error.name === "ValidationError") {
      const validationErrors = {};
      Object.keys(error.errors).forEach((field) => {
        validationErrors[field] = error.errors[field].message;
      });
      console.error("Validation errors details:", validationErrors);

      return res.status(400).json({
        error: "Validation failed",
        details: error.message,
        validationErrors,
        code: "VALIDATION_ERROR",
      });
    }

    // Handle cast errors (invalid IDs)
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid ID format",
        details: error.message,
        code: "INVALID_ID_FORMAT",
      });
    }

    res.status(500).json({
      error: "Failed to create reservation",
      details: error.message,
      code: "CREATE_RESERVATION_ERROR",
    });
  }
};

export const updateReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;

    // Validate reservationId format
    if (!reservationId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "Invalid reservation ID format",
        code: "INVALID_RESERVATION_ID",
      });
    }

    // Find reservation first to check branch access
    const existingReservation = await Reservation.findById(
      reservationId,
    ).populate("roomId", "branch");

    if (!existingReservation) {
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    }

    // Store old data for audit log
    const oldReservationData = existingReservation.toObject();

    // Check branch access (admin can only update reservations for rooms in their branch)
    if (
      req.branchFilter &&
      existingReservation.roomId?.branch !== req.branchFilter
    ) {
      return res.status(403).json({
        error: `Access denied. You can only manage reservations for ${req.branchFilter} branch.`,
        code: "BRANCH_ACCESS_DENIED",
      });
    }

    // Update reservation and return the updated document
    const reservation = await Reservation.findByIdAndUpdate(
      reservationId,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("userId", "firstName lastName email")
      .populate("roomId", "name branch type price");

    // Log reservation modification
    await auditLogger.logModification(
      req,
      "reservation",
      reservationId,
      oldReservationData,
      reservation.toObject(),
    );

    console.log(
      `✅ Reservation updated: ${reservation._id} - Status: ${reservation.status}`,
    );
    res.json({
      message: "Reservation updated successfully",
      reservation,
    });
  } catch (error) {
    console.error("❌ Update reservation error:", error);
    await auditLogger.logError(req, error, "Failed to update reservation");

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.message,
        code: "VALIDATION_ERROR",
      });
    }

    // Handle cast errors (invalid ID)
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid reservation ID format",
        code: "INVALID_RESERVATION_ID",
      });
    }

    res.status(500).json({
      error: "Failed to update reservation",
      details: error.message,
      code: "UPDATE_RESERVATION_ERROR",
    });
  }
};

export const updateReservationByUser = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const user = req.user;

    if (!reservationId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "Invalid reservation ID format",
        code: "INVALID_RESERVATION_ID",
      });
    }

    const dbUser = await User.findOne({ firebaseUid: user.uid });
    if (!dbUser) {
      return res.status(404).json({
        error: "User not found in database",
        code: "USER_NOT_FOUND",
      });
    }

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    }

    if (String(reservation.userId) !== String(dbUser._id)) {
      return res.status(403).json({
        error: "Access denied. You can only update your own reservation.",
        code: "RESERVATION_ACCESS_DENIED",
      });
    }

    if (req.body?.paymentStatus && req.body.paymentStatus !== "pending") {
      return res.status(403).json({
        error: "Access denied. Payment status can only be set by admin.",
        code: "PAYMENT_STATUS_ADMIN_ONLY",
      });
    }

    const updates = {};
    const setField = (key, value) => {
      if (value !== undefined) {
        updates[key] = value;
      }
    };

    setField("selectedBed", req.body.selectedBed);
    setField("targetMoveInDate", req.body.targetMoveInDate);
    setField("leaseDuration", req.body.leaseDuration);
    setField("billingEmail", req.body.billingEmail);
    setField("viewingType", req.body.viewingType);
    setField("isOutOfTown", req.body.isOutOfTown);
    setField("currentLocation", req.body.currentLocation);
    setField("visitApproved", req.body.visitApproved);
    setField("selfiePhotoUrl", req.body.selfiePhotoUrl);
    setField("firstName", req.body.firstName);
    setField("lastName", req.body.lastName);
    setField("middleName", req.body.middleName);
    setField("nickname", req.body.nickname);
    setField("mobileNumber", req.body.mobileNumber);
    setField("birthday", req.body.birthday);
    setField("maritalStatus", req.body.maritalStatus);
    setField("nationality", req.body.nationality);
    setField("educationLevel", req.body.educationLevel);
    setField("validIDFrontUrl", req.body.validIDFrontUrl);
    setField("validIDBackUrl", req.body.validIDBackUrl);
    setField("validIDType", req.body.validIDType);
    setField("nbiClearanceUrl", req.body.nbiClearanceUrl);
    setField("nbiReason", req.body.nbiReason);
    setField("companyIDUrl", req.body.companyIDUrl);
    setField("companyIDReason", req.body.companyIDReason);
    setField("healthConcerns", req.body.healthConcerns);
    setField("preferredRoomType", req.body.roomType);
    setField("preferredRoomNumber", req.body.preferredRoomNumber);
    setField("referralSource", req.body.referralSource);
    setField("referrerName", req.body.referrerName);
    setField("estimatedMoveInTime", req.body.estimatedMoveInTime);
    setField("workSchedule", req.body.workSchedule);
    setField("workScheduleOther", req.body.workScheduleOther);
    setField("agreedToPrivacy", req.body.agreedToPrivacy);
    setField("agreedToCertification", req.body.agreedToCertification);
    setField("proofOfPaymentUrl", req.body.proofOfPaymentUrl);
    setField("checkInDate", req.body.checkInDate);
    setField("checkOutDate", req.body.checkOutDate);
    setField("totalPrice", req.body.totalPrice);
    setField("applianceFees", req.body.applianceFees);
    setField("notes", req.body.notes);

    if (req.body.addressUnitHouseNo !== undefined) {
      updates["address.unitHouseNo"] = req.body.addressUnitHouseNo;
    }
    if (req.body.addressStreet !== undefined) {
      updates["address.street"] = req.body.addressStreet;
    }
    if (req.body.addressBarangay !== undefined) {
      updates["address.barangay"] = req.body.addressBarangay;
    }
    if (req.body.addressCity !== undefined) {
      updates["address.city"] = req.body.addressCity;
    }
    if (req.body.addressProvince !== undefined) {
      updates["address.province"] = req.body.addressProvince;
    }

    if (req.body.emergencyContactName !== undefined) {
      updates["emergencyContact.name"] = req.body.emergencyContactName;
    }
    if (req.body.emergencyRelationship !== undefined) {
      updates["emergencyContact.relationship"] =
        req.body.emergencyRelationship;
    }
    if (req.body.emergencyContactNumber !== undefined) {
      updates["emergencyContact.contactNumber"] =
        req.body.emergencyContactNumber;
    }

    if (req.body.employerSchool !== undefined) {
      updates["employment.employerSchool"] = req.body.employerSchool;
    }
    if (req.body.employerAddress !== undefined) {
      updates["employment.employerAddress"] = req.body.employerAddress;
    }
    if (req.body.employerContact !== undefined) {
      updates["employment.employerContact"] = req.body.employerContact;
    }
    if (req.body.startDate !== undefined) {
      updates["employment.startDate"] = req.body.startDate;
    }
    if (req.body.occupation !== undefined) {
      updates["employment.occupation"] = req.body.occupation;
    }
    if (req.body.previousEmployment !== undefined) {
      updates["employment.previousEmployment"] = req.body.previousEmployment;
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(
      reservationId,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("userId", "firstName lastName email")
      .populate("roomId", "name branch type price");

    res.json({
      message: "Reservation updated successfully",
      reservation: updatedReservation,
    });
  } catch (error) {
    console.error("❌ User reservation update error:", error);
    res.status(500).json({
      error: "Failed to update reservation",
      details: error.message,
      code: "UPDATE_RESERVATION_ERROR",
    });
  }
};

/**
 * Delete a reservation
 */
export const deleteReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const user = req.user;

    // Find user in database to get role and branch
    const dbUser = await User.findOne({ firebaseUid: user.uid });

    if (!dbUser) {
      return res.status(404).json({
        error: "User not found in database",
        code: "USER_NOT_FOUND",
      });
    }

    // Find the reservation with populated room data for branch checking
    const reservation = await Reservation.findById(reservationId).populate(
      "roomId",
    );

    if (!reservation) {
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    }

    // Check branch access (admin can only delete reservations for rooms in their branch)
    if (
      req.branchFilter &&
      reservation.roomId?.branch !== req.branchFilter
    ) {
      return res.status(403).json({
        error: `Access denied. You can only manage reservations for ${req.branchFilter} branch.`,
        code: "BRANCH_ACCESS_DENIED",
      });
    }

    // Store data for audit log before deletion
    const reservationData = reservation.toObject();

    // Delete the reservation
    await Reservation.findByIdAndDelete(reservationId);

    // Log reservation deletion
    await auditLogger.logDeletion(
      req,
      "reservation",
      reservationId,
      reservationData,
    );

    console.log(`✅ Reservation deleted: ${reservationId}`);
    res.json({
      message: "Reservation deleted successfully",
      reservationId,
    });
  } catch (error) {
    console.error("❌ Delete reservation error:", error);
    await auditLogger.logError(req, error, "Failed to delete reservation");

    // Handle cast errors (invalid ID)
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid reservation ID format",
        code: "INVALID_RESERVATION_ID",
      });
    }

    res.status(500).json({
      error: "Failed to delete reservation",
      details: error.message,
      code: "DELETE_RESERVATION_ERROR",
    });
  }
};
