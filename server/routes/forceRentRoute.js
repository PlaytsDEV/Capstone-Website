import express from "express";
import { generateAutomatedRentBills } from "../utils/rentGenerator.js";
import logger from "../middleware/logger.js";

const router = express.Router();
router.get("/force-rent", async (req, res) => {
  console.log("Forcing rent generation!");
  const fs = await import('fs');
  const path = './utils/rentGenerator.js';
  const original = fs.readFileSync(path, 'utf8');
  // bypass date check
  fs.writeFileSync(path, original.replace('if (dueInDays !== 5) {', 'if (false) {'));

  try {
     await generateAutomatedRentBills();
     res.send("Generation complete! Check terminal or DB.");
  } finally {
     // revert
     fs.writeFileSync(path, original);
  }
});
export default router;
