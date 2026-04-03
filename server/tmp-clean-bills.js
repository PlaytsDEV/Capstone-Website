import mongoose from 'mongoose';

async function checkDate() {
  await mongoose.connect('mongodb+srv://pvinceacds:AZ4zEVtSofuA9ij4@dormitorymanagement.6kthxjv.mongodb.net/lilycrest-dormitory');
  const db = mongoose.connection;
  
  const deleted = await db.collection('bills').deleteMany({ 'charges.rent': { $gt: 0 }, dueDate: { $gte: new Date('2026-03-31') } });
  
  console.log('Deleted errant future automated rent bills:', deleted.deletedCount);

  process.exit(0);
}
checkDate();
