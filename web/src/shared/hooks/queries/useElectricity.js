/**
 * Electricity Billing — React Query Hooks
 *
 * All hooks for the segment-based electricity billing module.
 * Uses electricityApi + centralized queryKeys.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { electricityApi } from "../../api/electricityApi.js";
import { queryKeys } from "../../lib/queryKeys.js";

// ============================================================================
// ADMIN QUERIES
// ============================================================================

/** Get rooms with billing status for the electricity dashboard */
export function useElectricityRooms(branch) {
  return useQuery({
    queryKey: queryKeys.electricity.rooms(branch),
    queryFn: () => electricityApi.getRooms(branch),
  });
}

/** Get all meter readings for a room */
export function useMeterReadings(roomId) {
  return useQuery({
    queryKey: queryKeys.electricity.readings(roomId),
    queryFn: () => electricityApi.getReadings(roomId),
    enabled: !!roomId,
  });
}

/** Get the latest reading for a room */
export function useLatestReading(roomId) {
  return useQuery({
    queryKey: queryKeys.electricity.latestReading(roomId),
    queryFn: () => electricityApi.getLatestReading(roomId),
    enabled: !!roomId,
  });
}

/** Get all billing periods for a room */
export function useBillingPeriods(roomId) {
  return useQuery({
    queryKey: queryKeys.electricity.periods(roomId),
    queryFn: () => electricityApi.getPeriods(roomId),
    enabled: !!roomId,
  });
}

/** Get full billing result for a period */
export function useBillingResult(periodId) {
  return useQuery({
    queryKey: queryKeys.electricity.result(periodId),
    queryFn: () => electricityApi.getResult(periodId),
    enabled: !!periodId,
  });
}

// ============================================================================
// ADMIN MUTATIONS
// ============================================================================

/** Record a new submeter reading */
export function useRecordReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => electricityApi.recordReading(data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["electricity", "readings"] });
      qc.invalidateQueries({ queryKey: ["electricity", "latestReading"] });
      qc.invalidateQueries({ queryKey: ["electricity", "rooms"] });
    },
  });
}

/** Open a new billing period */
export function useOpenPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => electricityApi.openPeriod(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["electricity", "periods"] });
      qc.invalidateQueries({ queryKey: ["electricity", "rooms"] });
    },
  });
}

/** Close a billing period and trigger computation */
export function useClosePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ periodId, ...data }) =>
      electricityApi.closePeriod(periodId, data),
    onSuccess: (_data, { periodId }) => {
      qc.invalidateQueries({ queryKey: ["electricity"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
      // Invalidate draftBills so the panel refreshes after close
      if (periodId) {
        qc.invalidateQueries({ queryKey: queryKeys.electricity.draftBills(periodId) });
      }
    },
  });
}

/** Revise a billing result */
export function useReviseResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ periodId, revisionNote }) =>
      electricityApi.reviseResult(periodId, revisionNote),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["electricity"] });
    },
  });
}

/** Delete (archive) a meter reading */
export function useDeleteReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (readingId) => electricityApi.deleteReading(readingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["electricity", "readings"] });
      qc.invalidateQueries({ queryKey: ["electricity", "latestReading"] });
      qc.invalidateQueries({ queryKey: ["electricity", "rooms"] });
    },
  });
}

/** Delete (archive) a billing period */
export function useDeletePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId) => electricityApi.deletePeriod(periodId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["electricity", "periods"] });
      qc.invalidateQueries({ queryKey: ["electricity", "rooms"] });
      qc.invalidateQueries({ queryKey: ["electricity", "readings"] });
      qc.invalidateQueries({ queryKey: ["electricity", "draftBills"] });
    },
  });
}

// ============================================================================
// DRAFT BILLING HOOKS
// ============================================================================

/** Get all draft bills for a closed billing period */
export function useDraftBills(periodId) {
  return useQuery({
    queryKey: queryKeys.electricity.draftBills(periodId),
    queryFn: () => electricityApi.getDraftBills(periodId),
    enabled: !!periodId,
  });
}

/** Send all draft bills for a period (flip to pending + email tenants) */
export function useSendBills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ periodId, defaultDueDate }) =>
      electricityApi.sendBills(periodId, { defaultDueDate }),
    onSuccess: (_data, { periodId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.electricity.draftBills(periodId) });
      qc.invalidateQueries({ queryKey: ["electricity", "periods"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

/** Admin adjusts charges on a draft bill */
export function useAdjustBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ billId, ...data }) => electricityApi.adjustBill(billId, data),
    onSuccess: (_data, { periodId }) => {
      if (periodId) {
        qc.invalidateQueries({ queryKey: queryKeys.electricity.draftBills(periodId) });
      }
    },
  });
}

// ============================================================================
// TENANT QUERIES
// ============================================================================

/** Tenant views their electricity billing summaries */
export function useMyElectricityBills() {
  return useQuery({
    queryKey: queryKeys.electricity.myBills,
    queryFn: () => electricityApi.getMyBills(),
  });
}

/** Tenant views one period's segment breakdown */
export function useMyBillBreakdown(periodId) {
  return useQuery({
    queryKey: queryKeys.electricity.myBreakdown(periodId),
    queryFn: () => electricityApi.getMyBreakdown(periodId),
    enabled: !!periodId,
  });
}

/** Tenant: get electricity segment breakdown by Bill ID (used in BillingPage) */
export function useMyBillBreakdownByBillId(billId) {
  return useQuery({
    queryKey: queryKeys.electricity.breakdownByBill(billId),
    queryFn: () => electricityApi.getBreakdownByBillId(billId),
    enabled: !!billId,
  });
}
