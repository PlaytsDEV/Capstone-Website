import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { Reservation, Bill, User } from './models/index.js';
import { syncBillAmounts } from './utils/billingPolicy.js';

async function run() {
  await mongoose.connect('mongodb+srv://pvinceacds:AZ4zEVtSofuA9ij4@dormitorymanagement.6kthxjv.mongodb.net/lilycrest-dormitory');
  console.log("Connected to Atlas");
  const rs = await Reservation.find({ status: "checked-in", isArchived: false }).populate("roomId", "name branch price monthlyPrice type");
  let gen = 0;
  for (let r of rs) {
     if (!r.userId) continue;
     const u = await User.findById(r.userId);
     console.log(`Checking ${u?.firstName}`);
     
     const now = dayjs();
     const cDay = dayjs(r.checkInDate).date();
     let nAnn = now.date(cDay).startOf('day');
     if (now.date() > cDay - 5) nAnn = nAnn.add(1, 'month');

     console.log(`Anniversary: ${nAnn.format('YYYY-MM-DD')} for Rent Generation`);

     let rp = r.monthlyRent || r.totalPrice || (r.roomId?.price ?? 100);
     let addCharges = []; let aFee = 0;
     if (r.roomId?.branch === "guadalupe") {
       aFee = (r.customCharges || []).reduce((s, c) => s + (Number(c.amount)||0), 0);
     }
     const ga = rp + aFee;
     const st = nAnn.subtract(1, 'month').toDate();

     const exist = await Bill.findOne({ reservationId: r._id, "charges.rent": { $gt: 0 } });
     if (exist) { console.log("Already exist rent"); continue; }

     const b = new Bill({
        reservationId: r._id, userId: u._id, branch: r.roomId?.branch, roomId: r.roomId?._id,
        billingMonth: st, billingCycleStart: st, billingCycleEnd: nAnn.toDate(), dueDate: nAnn.toDate(),
        isFirstCycleBill: false, proRataDays: 30,
        charges: { rent: rp, electricity: 0, water: 0, applianceFees: aFee, corkageFees: 0, penalty: 0, discount: 0 },
        additionalCharges: [], grossAmount: ga, reservationCreditApplied: 0, totalAmount: ga, remainingAmount: ga,
        status: "pending"
     });
     syncBillAmounts(b);
     await b.save();
     gen++;
     console.log("Saved Rent Invoice!");
  }
  console.log("Generated rent bills =", gen);
  process.exit(0);
}
run();
