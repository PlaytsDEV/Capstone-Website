const amount = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
};

export const resolveContractPaymentSummary = (contract) => {
  if (contract?.initialPaymentSummary != null) {
    return contract.initialPaymentSummary;
  }

  const advanceRent = amount(contract?.advanceRentAmount);
  const securityDeposit = amount(contract?.securityDepositAmount);
  const approvedCredit = amount(contract?.reservationFeeCreditAmount);
  if (advanceRent === null || securityDeposit === null) return null;

  const totalInitialCharges = Math.round((advanceRent + securityDeposit) * 100) / 100;
  const reservationFeeCreditApplied = approvedCredit === null
    ? null
    : Math.min(approvedCredit, totalInitialCharges);
  const remainingInitialAmountDue = reservationFeeCreditApplied === null
    ? null
    : Math.round((totalInitialCharges - reservationFeeCreditApplied) * 100) / 100;

  return {
    valid: reservationFeeCreditApplied !== null,
    totalInitialCharges,
    reservationFeeCreditApplied,
    remainingInitialAmountDue,
    source: "contract_snapshot_fallback",
  };
};
