export const CONTRACT_FIELD_VISUAL_STYLES = Object.freeze({
  contractExecutionDay: { fontWeight: "regular", preferredSize: 8.5, minimumSize: 8.25 },
  contractExecutionMonthYear: { fontWeight: "regular", preferredSize: 8.5, minimumSize: 8.25 },
  tenantLegalName: { fontWeight: "bold", preferredSize: 9.5, minimumSize: 9 },
  tenantResidentialAddress: { fontWeight: "regular", preferredSize: 8.5, minimumSize: 8 },
  propertyName: { fontWeight: "bold", preferredSize: 8.5, minimumSize: 8 },
  propertyAddress: { fontWeight: "regular", preferredSize: 8.25, minimumSize: 7.5 },
  roomNumber: { fontWeight: "bold", preferredSize: 9, minimumSize: 8.5 },
  bedOrSlotNumber: { fontWeight: "bold", preferredSize: 9, minimumSize: 8.5 },
  leaseDurationNumber: { fontWeight: "bold", preferredSize: 8.5, minimumSize: 8.5 },
  // Unlike other fields, this holds a spelled-out number ("Twelve", "Twenty-four")
  // whose rendered width varies far more than the 25-27pt template box allows for
  // at 8.5pt. A real shrink range is required so common lease terms (e.g. 12
  // months) don't fail PDF generation with CONTRACT_FIELD_OVERFLOW.
  leaseDurationWords: { fontWeight: "bold", preferredSize: 8.5, minimumSize: 6 },
  leaseStartDate: { fontWeight: "bold", preferredSize: 8.5, minimumSize: 8.25 },
  leaseEndDate: { fontWeight: "bold", preferredSize: 8.5, minimumSize: 8.25 },
  advanceCoverageStart: { fontWeight: "bold", preferredSize: 8.5, minimumSize: 8.25 },
  advanceCoverageEnd: { fontWeight: "bold", preferredSize: 8.5, minimumSize: 8.25 },
  regularMonthlyRate: { fontWeight: "bold", preferredSize: 8.5, minimumSize: 8.25 },
  discountPercentage: { fontWeight: "bold", preferredSize: 8.5, minimumSize: 8.25 },
  approvedMonthlyRate: { fontWeight: "bold", preferredSize: 8.5, minimumSize: 8.25 },
  advanceRentAmount: { fontWeight: "bold", preferredSize: 8.5, minimumSize: 8.25 },
  securityDepositAmount: { fontWeight: "bold", preferredSize: 8.5, minimumSize: 8.25 },
});

const field = (fieldName, x, y, width, options = {}) => {
  const style = CONTRACT_FIELD_VISUAL_STYLES[fieldName];
  return Object.freeze({
  pageIndex: 0,
  x,
  y,
  width,
  height: options.height || 10,
  preferredFontSize: options.preferredFontSize || style.preferredSize,
  minimumFontSize: options.minimumFontSize || style.minimumSize,
  fontWeight: options.fontWeight || style.fontWeight,
  horizontalAlignment: options.horizontalAlignment || "center",
  verticalOffset: options.verticalOffset || 0,
  maximumLines: options.maximumLines || 1,
  lineHeight: options.lineHeight || 9,
  overflowCode: options.overflowCode || "CONTRACT_FIELD_CANNOT_FIT_SAFELY",
  erasePadding: options.erasePadding ?? 0,
});
};

const common = Object.freeze({
  contractExecutionDay: field("contractExecutionDay", 339, 844, 25),
  contractExecutionMonthYear: field("contractExecutionMonthYear", 389, 844, 80),
  tenantLegalName: field("tenantLegalName", 46, 793, 167, {
    height: 10,
    erasePadding: 0,
    overflowCode: "TENANT_NAME_TOO_LONG_FOR_TEMPLATE",
  }),
  tenantResidentialAddress: field("tenantResidentialAddress", 46, 778, 219, {
    height: 14,
    erasePadding: 0,
    horizontalAlignment: "center",
    maximumLines: 2,
    lineHeight: 7,
    overflowCode: "TENANT_ADDRESS_TOO_LONG_FOR_TEMPLATE",
  }),
});

const assignment = Object.freeze({
  private: {
    roomNumber: field("roomNumber", 472, 735, 42, { overflowCode: "ROOM_LABEL_TOO_LONG_FOR_TEMPLATE" }),
    bedOrSlotNumber: field("bedOrSlotNumber", 46, 726, 40, { overflowCode: "ROOM_LABEL_TOO_LONG_FOR_TEMPLATE" }),
  },
  "double-sharing": {
    roomNumber: field("roomNumber", 488, 735, 42, { overflowCode: "ROOM_LABEL_TOO_LONG_FOR_TEMPLATE" }),
    bedOrSlotNumber: field("bedOrSlotNumber", 62, 726, 40, { overflowCode: "ROOM_LABEL_TOO_LONG_FOR_TEMPLATE" }),
  },
  "quadruple-sharing": {
    roomNumber: field("roomNumber", 523, 735, 42, { overflowCode: "ROOM_LABEL_TOO_LONG_FOR_TEMPLATE" }),
    bedOrSlotNumber: field("bedOrSlotNumber", 98, 726, 40, { overflowCode: "ROOM_LABEL_TOO_LONG_FOR_TEMPLATE" }),
  },
});

const lease = Object.freeze({
  private: {
    leaseDurationNumber: field("leaseDurationNumber", 419, 643, 38, {
      horizontalAlignment: "right",
      verticalOffset: 2.2,
    }),
    leaseDurationWords: field("leaseDurationWords", 471, 643, 27, {
      horizontalAlignment: "left",
      verticalOffset: 2.2,
    }),
    leaseStartDate: field("leaseStartDate", 48, 634, 74),
    leaseEndDate: field("leaseEndDate", 136, 634, 76),
  },
  shared: {
    leaseDurationNumber: field("leaseDurationNumber", 357, 643, 38, {
      horizontalAlignment: "right",
      verticalOffset: 2.2,
    }),
    leaseDurationWords: field("leaseDurationWords", 403, 643, 27, {
      horizontalAlignment: "left",
      verticalOffset: 2.2,
    }),
    leaseStartDate: field("leaseStartDate", 491, 643, 72),
    leaseEndDate: field("leaseEndDate", 58, 634, 76),
  },
});

const pricingFields = (roomType, leaseType) => {
  const privateShort = roomType === "private" && leaseType === "short-term";
  const regularY = privateShort ? 616 : 625;
  const discountY = privateShort ? 607 : 616;
  const amountY = privateShort ? 477 : 486;
  return {
    regularMonthlyRate: field(
      "regularMonthlyRate",
      roomType === "quadruple-sharing" ? 377 : 374,
      regularY,
      roomType === "quadruple-sharing" ? 46 : 49,
      { height: 8 },
    ),
    discountPercentage: field(
      "discountPercentage",
      roomType === "private" ? 233 : 240,
      discountY,
      roomType === "private" ? 48 : 44,
      { height: 8, horizontalAlignment: "right" },
    ),
    approvedMonthlyRate: field(
      "approvedMonthlyRate",
      roomType === "private" ? 517 : 523,
      discountY,
      roomType === "private" ? 47 : 41,
      { height: 8 },
    ),
    advanceRentAmount: field(
      "advanceRentAmount",
      roomType === "private" ? 569 : 567,
      amountY + 11,
      roomType === "private" ? 39 : 41,
      {
      height: 8,
      horizontalAlignment: "left",
      },
    ),
    securityDepositAmount: field("securityDepositAmount", 565, amountY + 2, 39, {
      height: 8,
      horizontalAlignment: "left",
    }),
  };
};

const buildProtectedPrintedTextRegions = (roomType, leaseType) => {
  const shared = roomType !== "private";
  const privateShort = roomType === "private" && leaseType === "short-term";
  const advanceY = roomType === "private" && leaseType === "short-term" ? 477 : 486;
  const roomX = assignment[roomType].roomNumber.x;
  const bedX = assignment[roomType].bedOrSlotNumber.x;
  const duration = roomType === "private" ? lease.private : lease.shared;
  return Object.freeze({
    executionThis: { x: 310, y: 842, width: 27, height: 14 },
    executionDayOf: { x: 365, y: 842, width: 22, height: 14 },
    executionByAndBetween: { x: 471, y: 842, width: 100, height: 14 },
    legalAgeClause: { x: 214, y: 794, width: 351, height: 12 },
    hereinafterClause: { x: 265, y: 778, width: 300, height: 14 },
    witnesseth: { x: 46, y: 762, width: 120, height: 14 },
    roomKnownAs: { x: roomX - 58, y: 734, width: 56, height: 13 },
    roomBedSlotLabel: { x: roomX + 43, y: 734, width: 47, height: 13 },
    bedSlotNumberLabel: { x: 46, y: 725, width: Math.max(0, bedX - 48), height: 13 },
    leasedPremises: { x: bedX + 42, y: 725, width: 145, height: 13 },
    durationLeadIn: { x: duration.leaseDurationNumber.x - 78, y: 642, width: 76, height: 13 },
    durationOpenParenthesis: { x: duration.leaseDurationWords.x - 5, y: 642, width: 4, height: 13 },
    durationMonthsFrom: { x: duration.leaseDurationWords.x + 27, y: 642, width: shared ? 58 : 70, height: 13 },
    durationTo: { x: shared ? 46 : 124, y: 633, width: 10, height: 13 },
    advanceUponMoving: { x: 223, y: 504, width: 110, height: 13 },
    advanceLesseeShallPay: { x: 333, y: 504, width: 135, height: 13 },
    advanceCoverageLeadIn: { x: 94, y: advanceY - 1, width: (roomType === "private" ? 83 : 79), height: 13 },
    advanceCoverageTo: { x: roomType === "private" ? 257 : 253, y: advanceY - 1, width: 9, height: 13 },
    advanceSecurityDeposit: {
      x: roomType === "private" ? 341 : 338,
      y: advanceY - 1,
      width: roomType === "private" ? 223 : 226,
      height: 13,
    },
    rentalRegularLeadIn: { x: 179, y: privateShort ? 615 : 624, width: roomType === "quadruple-sharing" ? 197 : 194, height: 9 },
    rentalRegularSuffix: { x: 424, y: privateShort ? 615 : 624, width: 140, height: 9 },
    rentalDiscountLeadIn: { x: 47, y: privateShort ? 606 : 615, width: roomType === "private" ? 185 : 192, height: 9 },
    rentalPercentSuffix: { x: roomType === "private" ? 286 : 289, y: privateShort ? 606 : 615, width: 227, height: 9 },
    advanceAmountLeadIn: { x: 225, y: advanceY + 10, width: 339, height: 9 },
    advanceCoveringLeadIn: { x: roomType === "private" ? 94 : 89, y: advanceY - 1, width: roomType === "private" ? 84 : 86, height: 13 },
    securityAmountLeadIn: { x: 340, y: advanceY - 1, width: 224, height: 13 },
    reservationFeeSentence: { x: 47, y: advanceY - 10, width: 518, height: 10 },
  });
};

const buildCoordinates = (roomType, leaseType) => Object.freeze({
  version: "3.0.3",
  pageWidth: 612,
  pageHeight: 936,
  pageCount: 1,
  fields: Object.freeze({
    ...common,
    ...assignment[roomType],
    ...(roomType === "private" ? lease.private : lease.shared),
    ...pricingFields(roomType, leaseType),
    advanceCoverageStart: field(
      "advanceCoverageStart",
      roomType === "private" ? 179 : 175,
      roomType === "private" && leaseType === "short-term" ? 477 : 486,
      77,
      { horizontalAlignment: "right" },
    ),
    advanceCoverageEnd: field(
      "advanceCoverageEnd",
      roomType === "private" ? 266 : 264,
      roomType === "private" && leaseType === "short-term" ? 477 : 486,
      74,
      { horizontalAlignment: "right" },
    ),
  }),
  propertyBlock: Object.freeze({
    propertyName: field("propertyName", 351, 758, 104, {
      height: 9,
      horizontalAlignment: "left",
      erasePadding: 0,
      preferredFontSize: 7.75,
      minimumFontSize: 7.5,
    }),
    addressLine1: field("propertyAddress", 496, 758, 69, { height: 9, horizontalAlignment: "left", erasePadding: 0 }),
    addressLine2: field("propertyAddress", 46, 749, 205, { height: 9, horizontalAlignment: "left", erasePadding: 0 }),
  }),
  preparedLabel: Object.freeze({
    x: 175,
    y: 919,
    width: 262,
    fontSize: 8.25,
  }),
  identityLayout: Object.freeze({
    eraseRegion: { x: 46, y: 766, width: 520, height: 48 },
    x: 47,
    width: 518,
    nameBaselineY: 800,
    addressBaselineY: 790.75,
    continuationBaselineY: 781.5,
    clauseBaselineY: 772.25,
    fontSize: 8.5,
    nameFontSize: 9.5,
    lineHeight: 9.25,
  }),
  section4Layout: Object.freeze({
    eraseRegion: {
      x: 46,
      y: roomType === "private" && leaseType === "short-term" ? 469 : 478,
      width: 520,
      height: 29,
    },
    x: 47,
    width: 518,
    firstBaselineY: roomType === "private" && leaseType === "short-term" ? 488 : 497,
    secondBaselineY: roomType === "private" && leaseType === "short-term" ? 479 : 488,
    reservationBaselineY:
      roomType === "private" && leaseType === "short-term" ? 470 : 479,
    fontSize: 8.5,
  }),
  protectedRegions: Object.freeze({
    signature: { x: 35, y: 95, width: 542, height: 230 },
    acknowledgment: { x: 35, y: 15, width: 542, height: 80 },
  }),
  protectedPrintedTextRegions: buildProtectedPrintedTextRegions(roomType, leaseType),
});

export const CONTRACT_TEMPLATE_COORDINATES = Object.freeze({
  "private-short-term": buildCoordinates("private", "short-term"),
  "private-long-term": buildCoordinates("private", "long-term"),
  "double-sharing-short-term": buildCoordinates("double-sharing", "short-term"),
  "double-sharing-long-term": buildCoordinates("double-sharing", "long-term"),
  "quadruple-sharing-short-term": buildCoordinates("quadruple-sharing", "short-term"),
  "quadruple-sharing-long-term": buildCoordinates("quadruple-sharing", "long-term"),
});

export const getContractTemplateCoordinates = (templateId) => {
  const coordinates = CONTRACT_TEMPLATE_COORDINATES[templateId];
  if (!coordinates) {
    const error = new Error("Contract template coordinates are not configured.");
    error.code = "CONTRACT_TEMPLATE_COORDINATES_MISSING";
    error.statusCode = 500;
    throw error;
  }
  return coordinates;
};
