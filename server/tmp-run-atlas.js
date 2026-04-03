import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { getReservationCreditAvailable } from './utils/billingPolicy.js';

async function generateAutomatedRentBills() {
  await mongoose.connect('mongodb+srv://pvinceacds:AZ4zEVtSofuA9ij4@dormitorymanagement.6kthxjv.mongodb.net/lilycrest-dormitory');
  const db = mongoose.connection;
  
  const reservations = await db.collection('reservations').find({ status: "checked-in", isArchived: false }).toArray();
  const rooms = await db.collection('rooms').find({}).toArray();
  const roomMap = Object.fromEntries(rooms.map(r => [r._id.toString(), r]));

  let gCount = 0;
  for (let r of reservations) {
    if (!r.userId || !r.roomId) continue;
    
    let rentPrice = r.monthlyRent || r.totalPrice;
    const room = roomMap[r.roomId.toString()];
    if (!room) continue;

    if (!rentPrice) {
      rentPrice = room.price || 0; 
    }

    let aFee = 0;
    if (room.branch === "guadalupe") {
       aFee = (r.customCharges || []).reduce((s, c) => s + (Number(c.amount)||0), 0);
    }
    
    const now = dayjs();
    const cDay = dayjs(r.checkInDate || now).date();
    let nAnn = now.date(cDay).startOf('day');
    if (now.date() > cDay - 5) nAnn = nAnn.add(1, 'month');

    // Force script: If nAnn is not after checkInDate, FORCE it to be the next month so we can test the UI!
    if (!nAnn.isAfter(dayjs(r.checkInDate).endOf('day'), 'day')) {
       nAnn = nAnn.add(1, 'month');
    }

    const st = nAnn.subtract(1, 'month').toDate();
    const ga = rentPrice + aFee;

    const exist = await db.collection('bills').findOne({ reservationId: r._id, "charges.rent": { $gt: 0 }, billingMonth: st });
    if (exist) continue;

    const creditAvailable = getReservationCreditAvailable(r);
    const reservationCreditApplied = Math.min(ga, creditAvailable);

    await db.collection('bills').insertOne({
        reservationId: r._id, userId: r.userId, branch: room.branch, roomId: room._id,
        billingMonth: st, billingCycleStart: st, billingCycleEnd: nAnn.toDate(), dueDate: nAnn.toDate(),
        isFirstCycleBill: reservationCreditApplied > 0, proRataDays: 30,
        charges: { rent: rentPrice, electricity: 0, water: 0, applianceFees: aFee, corkageFees: 0, penalty: 0, discount: 0 },
        additionalCharges: [], grossAmount: ga, reservationCreditApplied: reservationCreditApplied,
        totalAmount: ga - reservationCreditApplied, remainingAmount: ga - reservationCreditApplied,
        status: "pending", isActive: true, isArchived: false, createdAt: new Date(), updatedAt: new Date()
    });

    if (reservationCreditApplied > 0) {
      await db.collection('reservations').updateOne({ _id: r._id }, { $set: { reservationCreditConsumedAt: new Date() } });
    }
    console.log("Rented to", r.userId, "for", ga);
    gCount++;
  }
  console.log("Done!", gCount);
  process.exit(0);
}
generateAutomatedRentBills();
