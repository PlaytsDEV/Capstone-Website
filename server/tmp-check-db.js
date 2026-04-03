import mongoose from 'mongoose';
import { Reservation } from './models/index.js';

async function checkDB() {
  await mongoose.connect('mongodb://127.0.0.1:27017/lilycrest-dms');
  console.log("Checking DB...");
  const rs = await Reservation.find({}).populate('userId', 'firstName lastName');
  console.log("Total Reservations:", rs.length);
  for(let r of rs) {
     const name = r.userId ? `${r.userId.firstName} ${r.userId.lastName}` : 'No User';
     console.log(` - ${name}: ${r.status} (CheckIn: ${r.checkInDate})`);
  }
  process.exit(0);
}
checkDB();
