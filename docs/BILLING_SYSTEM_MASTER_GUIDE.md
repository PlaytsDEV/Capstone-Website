# Lilycrest DMS — Billing System Master Guide

This master guide provides complete technical documentation for Module 4 (Billing, Utility Billing, PayMongo Checkout, Utility Drift Repairs, and AI Billing Intelligence).

---

## 1. Billing Module Boundaries & Canonical Route Ownership

Module 4 is structured into four distinct route groups governed by single ownership boundaries:

| Route Group | Base Endpoint | Domain Ownership |
| :--- | :--- | :--- |
| `billingRoutes` | `/api/billing` | Monthly bills, proof-of-payment verification, penalties, readiness audits, invoice publishing, and financial exports. |
| `paymentRoutes` | `/api/payments` | PayMongo online checkout sessions and payment history. |
| `utilityBillingRoutes` | `/api/utilities` | Meter reading inputs, 15th-cycle billing periods, pro-rata consumption calculations, and result revisions. |
| `financialRoutes` | `/api/financial` | Owner-only cross-branch executive financial performance dashboard. |

---

## 2. Dual-Module Billing Engine

Lilycrest DMS operates a dual-module billing engine:

### Module A: Room-Based Fixed Billing
- **Monthly Room Rent**: Base rate derived from room type and capacity.
- **Appliance Fees**: Monthly recurring charges for declared tenant appliances (electric fan, rice cooker, laptop).
- **Billing Prerequisite**: Tenants MUST have an active `checked-in` status during the target billing window.

### Module B: Utility & Electricity Pro-Rata Billing
- **15th-Cycle Operational Cadence**: Billing periods run from the 15th of month `N-1` to the 15th of month `N`.
- **Pro-Rata Active Occupancy Ratio**:
  When a room contains multiple tenants with overlapping move-in / move-out dates within a billing period, total room electricity consumption is calculated based on active bed days:
  $$\text{Tenant Consumption Share} = \text{Total Room Consumption} \times \left( \frac{\text{Tenant Active Days}}{\sum \text{All Occupant Active Days}} \right)$$

---

## 3. Utility Sync Runbook & Drift Repair

To fix utility billing drift (e.g., missing period anchors or orphan meter readings):

### Diagnostic Commands
```bash
# Run diagnostics without modifying data
cd server
npm run utility:diagnose

# Branch-scoped diagnostic
npm run utility:diagnose -- --branch=gil-puyat
```

### Repair Execution Commands
```bash
# Run repair in dry-run mode
npm run utility:repair

# Execute and persist repair to MongoDB
npm run utility:repair -- --write
```

### Ready-For-Close Checklist
A room is ready for the 15th electricity close when:
1. Exactly one open `BillingPeriod` exists for the room.
2. Zero orphan `MeterReading` rows exist.
3. Current cutoff meter reading has been recorded by Admin.

---

## 4. Tenant Checkout & Move-Out Billing Rollout

When a tenant checks out:
1. System calculates unbilled utility consumption up to the move-out date.
2. Final move-out billing statement is compiled (Room Rent + Utilities - Security Deposit).
3. Slot status is updated and bed occupancy counter is decremented atomically via `$inc`.

---

## 5. AI Billing Intelligence Plan

The system includes specifications for AI-driven utility anomaly detection:
- Flagging abnormal consumption spikes (e.g., >30% above historical room baseline).
- Automated meter reading OCR parsing from uploaded sub-meter photos.
