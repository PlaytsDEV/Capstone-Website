/** Canonical payment Receipt download. Rendering and authorization live on the server. */
import { billingApi } from "../api/billingApi.js";

export const generateBillingReceipt = async (bill) => {
  const billId = bill?.id || bill?._id || bill?.billing_id;
  if (!billId) throw new Error("Bill ID is required to download a Receipt.");
  return billingApi.downloadBillReceipt(billId);
};
