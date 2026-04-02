import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { waterApi } from "../../api/waterApi.js";
import { electricityApi } from "../../api/electricityApi.js";
import { queryKeys } from "../../lib/queryKeys.js";

export function useWaterRooms(branch) {
  return useQuery({
    queryKey: queryKeys.water.rooms(branch),
    queryFn: () => waterApi.getRooms(branch),
  });
}

export function useWaterPeriods(roomId) {
  return useQuery({
    queryKey: queryKeys.water.periods(roomId),
    queryFn: () => waterApi.getPeriods(roomId),
    enabled: !!roomId,
  });
}

export function useWaterRecords(roomId) {
  return useQuery({
    queryKey: queryKeys.water.records(roomId),
    queryFn: () => waterApi.getRecords(roomId),
    enabled: !!roomId,
  });
}

export function useWaterResult(periodId) {
  return useQuery({
    queryKey: queryKeys.water.result(periodId),
    queryFn: () => waterApi.getResult(periodId),
    enabled: !!periodId,
  });
}

export function useLatestWaterRecord(roomId) {
  return useQuery({
    queryKey: queryKeys.water.latestRecord(roomId),
    queryFn: () => waterApi.getLatestRecord(roomId),
    enabled: !!roomId,
    retry: false,
  });
}

export function useMyWaterRecords() {
  return useQuery({
    queryKey: queryKeys.water.myRecords,
    queryFn: () => waterApi.getMyRecords(),
  });
}

export function useMyWaterBills() {
  return useQuery({
    queryKey: queryKeys.water.myBills,
    queryFn: () => waterApi.getMyBills(),
  });
}

export function useMyWaterBreakdown(periodId) {
  return useQuery({
    queryKey: queryKeys.water.myBreakdown(periodId),
    queryFn: () => waterApi.getMyBreakdown(periodId),
    enabled: !!periodId,
  });
}

export function useMyWaterBreakdownByBillId(billId) {
  return useQuery({
    queryKey: queryKeys.water.breakdownByBill(billId),
    queryFn: () => waterApi.getMyBreakdownByBillId(billId),
    enabled: !!billId,
  });
}

export function useCreateWaterRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => waterApi.createRecord(data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["water"] });
      if (variables?.roomId) {
        qc.invalidateQueries({ queryKey: queryKeys.water.records(variables.roomId) });
        qc.invalidateQueries({ queryKey: queryKeys.water.latestRecord(variables.roomId) });
      }
    },
  });
}

export function useOpenWaterPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => waterApi.openPeriod(data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["water"] });
      if (variables?.roomId) {
        qc.invalidateQueries({ queryKey: queryKeys.water.periods(variables.roomId) });
      }
    },
  });
}

export function useUpdateWaterRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, ...data }) => waterApi.updateRecord(recordId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water"] });
    },
  });
}

export function useUpdateWaterPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ periodId, ...data }) => waterApi.updatePeriod(periodId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water"] });
    },
  });
}

export function useDeleteWaterRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recordId) => waterApi.deleteRecord(recordId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water"] });
    },
  });
}

export function useFinalizeWaterRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recordId) => waterApi.finalizeRecord(recordId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water"] });
      qc.invalidateQueries({ queryKey: ["electricity"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function useCloseWaterPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ periodId, ...data }) => waterApi.closePeriod(periodId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function useReviseWaterResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ periodId, revisionNote }) =>
      waterApi.reviseResult(periodId, { revisionNote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function useWaterDraftBills(periodId) {
  return useQuery({
    queryKey: queryKeys.water.draftBills(periodId),
    queryFn: () => waterApi.getDraftBills(periodId),
    enabled: !!periodId,
  });
}

export function useSendWaterBills(periodId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data = {}) => waterApi.sendBills(periodId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["water"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
    },
  });
}

export function useAdjustWaterDraftBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ billId, ...data }) => electricityApi.adjustBill(billId, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["water"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
      if (variables?.periodId) {
        qc.invalidateQueries({ queryKey: queryKeys.water.draftBills(variables.periodId) });
      }
    },
  });
}
