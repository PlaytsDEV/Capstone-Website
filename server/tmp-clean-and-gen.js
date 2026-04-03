import mongoose from 'mongoose';
import { generateAutomatedRentBills } from './utils/rentGenerator.js';

async function redo() {
  await mongoose.connect('mongodb+srv://pvinceacds:AZ4zEVtSofuA9ij4@dormitorymanagement.6kthxjv.mongodb.net/lilycrest-dormitory');
  const db = mongoose.connection;
  const deleted = await db.collection('bills').deleteMany({ 'charges.rent': { $gt: 0 }, dueDate: { $gte: new Date('2026-04-30') } });
  
  await db.collection('reservations').updateMany({}, { $set: { reservationCreditConsumedAt: null, reservationCreditAppliedBillId: null } });
  
  // Since we use the generator directly, let's just bypass the isAfter check temporarily inside it for testing
  console.log('Cleaned up', deleted.deletedCount);
  process.exit();
}
redo();
