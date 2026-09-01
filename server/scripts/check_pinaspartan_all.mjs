import "dotenv/config";
import mongoose from "mongoose";
import { User, Reservation, Contract } from "../models/index.js";
import { readMoveInDate } from "../utils/lifecycleNaming.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: "pinaspartan1@gmail.com" }).lean();
  console.log("User:", user._id, user.email, user.firstName, user.lastName);

  const reservations = await Reservation.find({ userId: user._id }).lean();
  console.log(`Found ${reservations.length} reservations for pinaspartan:`);

  for (const r of reservations) {
    const contracts = await Contract.find({ reservationId: r._id }).lean();
    console.log("--------------------------------------------------");
    console.log(`Reservation: ${r.reservationCode} | Status: ${r.status} | Duration: ${r.leaseDuration}`);
    console.log(`Move-in Dates: confirmed=${r.confirmedMoveInDate} | moveIn=${r.moveInDate} | intended=${r.intendedMoveInDate} | resolved=${readMoveInDate(r)}`);
    console.log(`Contracts count: ${contracts.length}`);
    for (const c of contracts) {
      console.log(`  -> Contract: ${c.contractNumber} | Status: ${c.status} | Current: ${c.isCurrent}`);
      console.log(`     Lease Start: ${c.leaseStartDate} | Lease End: ${c.leaseEndDate}`);
      console.log(`     Prepared Docs count: ${c.preparedDocuments?.length}`);
      if (c.preparedDocuments?.length) {
        c.preparedDocuments.forEach(p => {
          console.log(`       - Version ${p.version}: Start="${p.generationSnapshot?.fields?.leaseStartDate}" End="${p.generationSnapshot?.fields?.leaseEndDate}" Superseded=${p.superseded}`);
        });
      }
    }
  }

  // Also check if any contracts directly reference this user as tenantId
  const directContracts = await Contract.find({ tenantId: user._id }).lean();
  console.log(`Total contracts referencing tenantId ${user._id}: ${directContracts.length}`);
  for (const c of directContracts) {
    console.log(`Direct Contract: ${c.contractNumber} | Status: ${c.status} | Current: ${c.isCurrent}`);
  }

  await mongoose.disconnect();
}
main().catch(console.error);
