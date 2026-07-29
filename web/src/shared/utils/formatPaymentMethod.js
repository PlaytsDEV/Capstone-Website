/**
 * Format raw payment method values from PayMongo into display-friendly names.
 * Used across confirmation, dashboard, receipts, and PDFs.
 */
export const formatPaymentMethod = (method) => {
  if (!method) return "Online Payment";
  const key = String(method).toLowerCase().trim().replace(/[_\s-]/g, "");
  const methods = {
    gcash: "GCash",
    paymaya: "Maya",
    maya: "Maya",
    card: "Credit / Debit Card",
    creditcard: "Credit / Debit Card",
    debitcard: "Credit / Debit Card",
    visa: "Credit / Debit Card (Visa)",
    mastercard: "Credit / Debit Card (Mastercard)",
    grabpay: "GrabPay",
    dob: "Online Banking",
    dobubp: "UnionBank Online",
    dobbpi: "BPI Online",
    qrph: "QR Ph",
    billease: "BillEase",
    bank: "Bank Transfer",
    banktransfer: "Bank Transfer",
    check: "Check",
    cash: "Cash",
    online: "Online Payment (PayMongo)",
    paymongo: "Online Payment (PayMongo)",
  };
  return methods[key] || String(method).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};
