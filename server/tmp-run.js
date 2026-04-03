import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { Reservation, Bill } from './models/index.js';
import { syncBillAmounts } from './utils/billingPolicy.js';
import logger from './middleware/logger.js';

async function testRentGen() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lilycrest-dms');
  console.log("Connected to MongoDB. Running Force Generator");
  
  const now = dayjs();
  let generatedCount = 0;

  const reservations = await Reservation.find({
    status: "checked-in",
    isArchived: false,
  })
    .populate("userId", "firstName lastName email")
    .populate("roomId", "name branch price monthlyPrice type");

  for (const reservation of reservations) {
    if (!reservation.checkInDate || !reservation.userId || !reservation.roomId) {
      continue;
    }

    // Force rent generator without checking '5 days' rule
    const checkInDay = dayjs(reservation.checkInDate).date();
    
    let nextAnniversary = now.date(checkInDay).startOf('day');
    if (now.date() > checkInDay - 5) {
      nextAnniversary = nextAnniversary.add(1, 'month');
    }

    const isLongTerm = dayjs().diff(dayjs(reservation.checkInDate), "month", true) >= 6;
    let rentPrice = reservation.monthlyRent || reservation.totalPrice;
    if (!rentPrice) {
      rentPrice = isLongTerm ? (reservation.roomId.monthlyPrice ?? reservation.roomId.price ?? 0) : (reservation.roomId.price ?? 0);
    }

    let applianceFees = 0;
    let additionalCharges = [];
    const branch = reservation.roomId.branch;

    if (branch === "guadalupe") {
      const customCharges = reservation.customCharges || [];
      applianceFees = customCharges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      additionalCharges = customCharges.map((c) => ({
        name: c.name,
        amount: c.amount,
      }));
    }

    const grossAmount = rentPrice + applianceFees;
    const billingMonthStartDate = nextAnniversary.subtract(1, 'month').toDate();

    const dupeFilter = {
      userId: reservation.userId._id,
      reservationId: reservation._id,
      billingMonth: billingMonthStartDate,
      "charges.rent": { $gt: 0 },
      isArchived: false,
    };

    if (await Bill.findOne(dupeFilter)) {
      console.log(`Rent already auto-generated recently for ${reservation.userId.firstName}`);
      continue; 
    }

    const bill = new Bill({
      reservationId: reservation._id,
      userId: reservation.userId._id,
      branch: branch,
      roomId: reservation.roomId._id,
      billingMonth: billingMonthStartDate,
      billingCycleStart: billingMonthStartDate,
      billingCycleEnd: nextAnniversary.toDate(),
      dueDate: nextAnniversary.toDate(),
      isFirstCycleBill: false,
      proRataDays: dayjs(nextAnniversary).diff(dayjs(billingMonthStartDate), 'day'),
      charges: {
        rent: rentPrice,
        electricity: 0,
        water: 0,
        applianceFees: applianceFees,
        corkageFees: 0,
        penalty: 0,
        discount: 0,
      },
      additionalCharges: additionalCharges,
      grossAmount: grossAmount,
      reservationCreditApplied: 0,
      totalAmount: grossAmount,
      remainingAmount: grossAmount,
      status: "pending", 
    });

    syncBillAmounts(bill);
    await bill.save();
    generatedCount++;
    console.log(`Generated Rent Bill for ${reservation.userId.firstName}! Amount: ${bill.totalAmount}`);
  }
  
  console.log(`Simulation complete. Generated ${generatedCount} rent bills.`);
  process.exit(0);
}

testRentGen();
