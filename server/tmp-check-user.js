import mongoose from 'mongoose';

async function checkDate() {
  await mongoose.connect('mongodb+srv://pvinceacds:AZ4zEVtSofuA9ij4@dormitorymanagement.6kthxjv.mongodb.net/lilycrest-dormitory');
  const db = mongoose.connection;
  const user = await db.collection('users').findOne({ email: /pinaspartan1/i });
  const r = await db.collection('reservations').findOne({ userId: user._id, status: 'checked-in' });
  console.log('Created At:', r.createdAt, 'CheckInDate:', r.checkInDate);
  process.exit(0);
}
checkDate();
