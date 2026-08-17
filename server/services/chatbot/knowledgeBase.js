/**
 * ============================================================================
 * LILYCREST DORMITORY KNOWLEDGE BASE
 * ============================================================================
 *
 * Official ground-truth knowledge repository for Lilycrest Dormitory Management
 * System (Lilycrest DMS) conversational AI agents, public FAQ assistants, and
 * lead escalation bots.
 *
 * Grounded data covers:
 * - Branch profiles (Gil Puyat & Guadalupe)
 * - Room tiers, amenities, and rate ranges
 * - Curfew policies and visitor guidelines
 * - Pro-rata electricity billing & free water
 * - Monthly appliance surcharge schedules
 * - 5-stage guided reservation lifecycle
 * - Accepted KYC identification documents
 * ============================================================================
 */

export const BRANCH_PROFILES = {
  gil_puyat: {
    id: "gil_puyat",
    name: "Gil Puyat Branch",
    city: "Pasay City",
    location: "Buendia / Taft Avenue, Pasay City",
    landmarks: "Near LRT-1 Gil Puyat Station, Arellano University, DLTB, and JAM Liner provincial bus terminals",
    contactPhone: "+63 (2) 8800-LILY",
    email: "gilpuyat@lilycrest.ph",
  },
  guadalupe: {
    id: "guadalupe",
    name: "Guadalupe Branch",
    city: "Makati City",
    location: "EDSA Guadalupe Nuevo, Makati City",
    landmarks: "Near MRT-3 Guadalupe Station, Guadalupe Mall, and BGC Bus Terminal",
    contactPhone: "+63 (2) 8801-LILY",
    email: "guadalupe@lilycrest.ph",
  },
};

export const ROOM_RATES = [
  {
    type: "quadruple_sharing",
    name: "Quadruple Sharing Room",
    capacity: 4,
    rateRange: "₱3,500 – ₱4,200 / month per bed",
    minRate: 3500,
    maxRate: 4200,
    features: "4 bunk beds, air-conditioned, personal locker, shared en-suite bathroom",
    description: "Budget-friendly option for students and professionals. Air-conditioned with individual lockers and shared en-suite bathroom.",
  },
  {
    type: "double_sharing",
    name: "Double Sharing Room",
    capacity: 2,
    rateRange: "₱5,500 – ₱6,500 / month per bed",
    minRate: 5500,
    maxRate: 6500,
    features: "2 single/bunk beds, air-conditioned, personal study table, shared en-suite bathroom",
    description: "Balanced comfort and focus. Features 2 single/bunk beds, dedicated study desks, air conditioning, and shared en-suite bathroom.",
  },
  {
    type: "private_room",
    name: "Private Room",
    capacity: 1,
    rateRange: "₱9,000 – ₱11,000 / month",
    minRate: 9000,
    maxRate: 11000,
    features: "1 single bed, dedicated study desk, air-conditioned, private en-suite bathroom",
    description: "Maximum privacy and quiet study sanctuary. Includes dedicated study desk, individual air conditioning, and private en-suite bathroom.",
  },
];

export const APPLIANCE_FEES = {
  laptopsPhones: { name: "Laptops & Smartphones", fee: 0, feeFormatted: "Free / Included" },
  miniRefrigerator: { name: "Mini-Refrigerator", fee: 200, feeFormatted: "₱200 / month" },
  riceCooker: { name: "Rice Cooker", fee: 150, feeFormatted: "₱150 / month" },
  electricFan: { name: "Electric Fan", fee: 100, feeFormatted: "₱100 / month" },
};

export const ACCEPTED_KYC_IDS = [
  "Philippine Passport",
  "UMID (Unified Multi-Purpose ID)",
  "Driver's License",
  "PhilSys National ID (Philippine Identification Card / ePhilID)",
  "Postal ID",
  "PRC ID (Professional Regulation Commission)",
  "Student ID + Current Semester COR (Certificate of Registration)",
];

export const APPLICATION_STAGES = [
  {
    step: 1,
    title: "Room Selection",
    description: "Choose preferred branch (Gil Puyat or Guadalupe), room type (Quadruple, Double, or Private), and bed position.",
  },
  {
    step: 2,
    title: "Viewing Schedule / Waiver",
    description: "Book an in-person site viewing slot or submit a remote viewing waiver.",
  },
  {
    step: 3,
    title: "Tenant Info & KYC",
    description: "Submit personal details, emergency/guardian contact, and upload valid government or student ID.",
  },
  {
    step: 4,
    title: "Payment Deposit",
    description: "Pay 1-month advance rent + 1-month security deposit via GCash, Maya, Bank Transfer, or PayMongo, and upload receipt proof.",
  },
  {
    step: 5,
    title: "Confirmation & Admin Approval",
    description: "Application is verified by Branch Admin within 24 to 48 hours for lease contract generation and key turnover.",
  },
];

export const dormitoryKnowledgeContext = `
1. Branch Profiles & Locations:
- Gil Puyat Branch (Pasay City): Located along Buendia / Taft Avenue, Pasay City. Highly accessible via LRT-1 Gil Puyat Station, near Arellano University, DLTB, and JAM Liner provincial bus terminals.
- Guadalupe Branch (Makati City): Located at EDSA Guadalupe Nuevo, Makati City. Highly accessible via MRT-3 Guadalupe Station, near Guadalupe Mall and BGC Bus Terminal.

2. Room Types & Rate Structure (Philippine Peso / ₱):
- Quadruple Sharing Room (4 beds): ₱3,500 – ₱4,200 / month per bed. Amenities: 4 bunk beds, air-conditioned, personal locker, shared en-suite bathroom.
- Double Sharing Room (2 beds): ₱5,500 – ₱6,500 / month per bed. Amenities: 2 single/bunk beds, air-conditioned, personal study table, shared en-suite bathroom.
- Private Room (Solo occupancy): ₱9,000 – ₱11,000 / month. Amenities: 1 single bed, dedicated study desk, air-conditioned, private en-suite bathroom.

3. Curfew Policy, House Rules & Visitors:
- Curfew Policy: Building main entrance gate locks at 11:00 PM and opens at 5:00 AM. 24/7 late entry is permitted for working professionals and students with a night-shift company ID / employee badge or prior written log with security.
- Visitor Policy: Registered daytime visitors are welcomed in common lounge areas from 8:00 AM to 8:00 PM. No overnight guests are allowed in tenant dorm rooms.
- Cleanliness & Safety: Quiet hours are 10:00 PM to 6:00 AM. Strictly no smoking, no vaping, and no illegal substances anywhere on premises.

4. Utility & Rent Billing Schedules:
- Rent: Due date is based on the tenant's individual lease start / move-in date cycle.
- Water: Free water consumption is included in the base monthly rent.
- Electricity: Metered per room and billed every 15th of the month based on pro-rata shared consumption among active room occupants.
- Included Appliances: Laptops and mobile phones are free of charge.
- Additional Monthly Appliance Fees:
  * Mini-Refrigerator: ₱200 / month
  * Rice Cooker: ₱150 / month
  * Electric Fan: ₱100 / month

5. 5-Stage Guided Application Lifecycle:
1. Room Selection: Choose branch (Gil Puyat or Guadalupe), room type, and specific bed slot.
2. Viewing Schedule / Waiver: Select an on-site viewing appointment or submit a remote viewing waiver.
3. Tenant Info & KYC: Fill in personal information, emergency contact details, and upload valid government or student ID.
4. Payment Deposit: Settle 1-month advance rent and 1-month security deposit, then upload payment proof.
5. Confirmation & Admin Approval: Branch Admin reviews the application within 24 to 48 hours for contract signing and move-in scheduling.

6. Accepted KYC Identification Documents:
- Philippine Passport
- UMID (Unified Multi-Purpose ID)
- Driver's License
- PhilSys National ID (Philippine Identification Card / ePhilID)
- Postal ID
- PRC ID (Professional Regulation Commission)
- Student ID accompanied by Certificate of Registration (COR) for the current semester
`;
