import crypto from "crypto";
import fs from "fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Contract } from "../models/index.js";
import { getContractTemplateCoordinates } from "../config/contractTemplateCoordinates.js";
import {
  buildContractGenerationData,
  resolveContractExecutionDate,
} from "./contractGenerationDataService.js";
import { validateContractForGeneration, transitionContract } from "./contractService.js";
import {
  drawFittedField,
  fitSingleLineText,
  PREPARED_COPY_LABEL,
} from "./contractPdfTextService.js";
import {
  buildPreparedContractStorage,
} from "./contractPrivateStorageService.js";
import {
  inspectPreparedContractDocument,
  removePreparedContractDocument,
  storePreparedContractDocument,
} from "./contractDocumentStorageService.js";
import { renderContractHtmlPdf } from "./contractHtmlPdfService.js";

const pdfError = (message, code, statusCode = 400, details = undefined) =>
  Object.assign(new Error(message), { code, statusCode, details });

const capitalize = (value) => {
  const text = String(value || "");
  return text ? text[0].toUpperCase() + text.slice(1) : text;
};

const drawInlineSegments = ({ page, fonts, x, y, segments, fontSize }) => {
  let cursor = x;
  for (const segment of segments) {
    const font = segment.bold ? fonts.bold : fonts.regular;
    page.drawText(segment.text, {
      x: cursor,
      y,
      size: segment.fontSize || fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    cursor += font.widthOfTextAtSize(segment.text, segment.fontSize || fontSize)
      + (segment.gapAfter || 0);
  }
  return cursor;
};

const eraseLayoutRegion = (page, region, debug) => {
  page.drawRectangle({ ...region, color: rgb(1, 1, 1) });
  if (debug) {
    page.drawRectangle({
      ...region,
      borderColor: rgb(0.9, 0.1, 0.1),
      borderWidth: 0.5,
      color: rgb(1, 0.85, 0.85),
      opacity: 0.22,
    });
  }
};

const drawFlowParagraph = ({
  page,
  fonts,
  x,
  firstBaselineY,
  width,
  lineHeight,
  fontSize,
  maximumLines,
  segments,
  overflowCode,
  fieldName,
}) => {
  const words = segments.flatMap((segment) =>
    String(segment.text || "").trim().split(/\s+/).filter(Boolean).map((text) => ({
      text,
      bold: segment.bold === true,
    })));
  const spaceWidth = fonts.regular.widthOfTextAtSize(" ", fontSize);
  const lines = [];
  let line = [];
  let lineWidth = 0;
  for (const word of words) {
    const font = word.bold ? fonts.bold : fonts.regular;
    const wordWidth = font.widthOfTextAtSize(word.text, fontSize);
    const candidateWidth = lineWidth + (line.length ? spaceWidth : 0) + wordWidth;
    if (line.length && candidateWidth > width) {
      lines.push({ words: line, width: lineWidth });
      line = [word];
      lineWidth = wordWidth;
    } else {
      line.push(word);
      lineWidth = candidateWidth;
    }
  }
  if (line.length) lines.push({ words: line, width: lineWidth });
  if (lines.length > maximumLines || lines.some((entry) => entry.width > width)) {
    throw pdfError(
      "A legal paragraph cannot fit safely without shrinking its typography.",
      overflowCode,
      422,
      { field: fieldName, lineCount: lines.length, maximumLines, width },
    );
  }
  const positions = [];
  lines.forEach((entry, lineIndex) => {
    const justify = lineIndex < lines.length - 1 && entry.words.length > 1;
    const extraSpace = justify
      ? Math.min(1.5, Math.max(0, (width - entry.width) / (entry.words.length - 1)))
      : 0;
    let cursor = x;
    const y = firstBaselineY - lineIndex * lineHeight;
    entry.words.forEach((word, wordIndex) => {
      const font = word.bold ? fonts.bold : fonts.regular;
      const wordWidth = font.widthOfTextAtSize(word.text, fontSize);
      page.drawText(word.text, {
        x: cursor, y, size: fontSize, font, color: rgb(0, 0, 0),
      });
      positions.push({ ...word, x: cursor, y, width: wordWidth, lineIndex });
      cursor += wordWidth;
      if (wordIndex < entry.words.length - 1) cursor += spaceWidth + extraSpace;
    });
  });
  return { lines, positions, fontSize };
};

const drawTenantIdentityBlock = ({ page, fonts, fields, coordinates, debug }) => {
  const layout = coordinates.identityLayout;
  eraseLayoutRegion(page, layout.eraseRegion, debug);
  const name = String(fields.tenantLegalName || "").replace(/[,\s]+$/, "") + ",";
  const address = String(fields.tenantResidentialAddress || "")
    .trim().replace(/[,\s]+$/, "");
  fitSingleLineText(fonts.bold, name, {
    ...coordinates.fields.tenantLegalName,
    preferredFontSize: layout.fontSize,
    minimumFontSize: layout.fontSize,
  }, "tenantLegalName");
  fitSingleLineText(fonts.regular, address, {
    width: layout.width,
    preferredFontSize: layout.fontSize,
    minimumFontSize: layout.fontSize,
    overflowCode: "TENANT_ADDRESS_TOO_LONG_FOR_TEMPLATE",
  }, "tenantResidentialAddress");
  const flow = drawFlowParagraph({
    page,
    fonts,
    x: layout.x,
    firstBaselineY: layout.nameBaselineY,
    width: layout.width,
    lineHeight: layout.lineHeight,
    fontSize: layout.fontSize,
    maximumLines: 3,
    overflowCode: "TENANT_IDENTITY_PARAGRAPH_TOO_LONG_FOR_TEMPLATE",
    fieldName: "tenantIdentity",
    segments: [
      { text: name, bold: true },
      { text: `of legal age, Filipino, with postal and residential address at ${address}, hereinafter referred to as the` },
      { text: "LESSEE;", bold: true },
    ],
  });
  drawInlineSegments({
    page,
    fonts,
    x: layout.x,
    y: 770,
    fontSize: layout.fontSize,
    segments: [
      { text: "WITNESSETH:", bold: true, gapAfter: 3 },
      { text: "That" },
    ],
  });
  const namePosition = flow.positions.find((position) => position.text === name);
  const addressPositions = flow.positions.filter((position) =>
    !position.bold && position.text !== "of" && position.lineIndex > 0);
  return {
    tenantLegalName: {
      font: StandardFonts.TimesRomanBold,
      fontSize: layout.fontSize,
      fieldBox: {
        x: layout.x, y: layout.eraseRegion.y,
        width: layout.width, height: layout.eraseRegion.height,
      },
      x: namePosition?.x ?? layout.x,
      baselineY: namePosition?.y ?? layout.nameBaselineY,
      textWidth: namePosition?.width ?? 0,
      text: name,
      lines: [name],
    },
    tenantResidentialAddress: {
      font: StandardFonts.TimesRoman,
      fontSize: layout.fontSize,
      fieldBox: {
        x: layout.x, y: layout.eraseRegion.y,
        width: layout.width, height: layout.eraseRegion.height,
      },
      x: layout.x,
      baselineY: addressPositions[0]?.y ?? layout.nameBaselineY,
      textWidth: Math.max(...flow.lines.map((line) => line.width)),
      text: String(fields.tenantResidentialAddress || "").trim(),
      lines: flow.lines.map((line) => line.words.map((word) => word.text).join(" ")),
    },
  };
};

const drawSection4Block = ({ page, fonts, fields, coordinates, debug }) => {
  const layout = coordinates.section4Layout;
  eraseLayoutRegion(page, layout.eraseRegion, debug);
  const advanceValue =
    `Php ${String(fields.advanceRentAmount || "").replace(/[,\s]+$/, "")},`;
  const depositValue =
    `Php ${String(fields.securityDepositAmount || "").replace(/[.\s]+$/, "")}.`;
  const flow = drawFlowParagraph({
    page,
    fonts,
    x: layout.x,
    firstBaselineY: layout.firstBaselineY,
    width: layout.width,
    lineHeight: layout.firstBaselineY - layout.secondBaselineY,
    fontSize: layout.fontSize,
    maximumLines: 2,
    overflowCode: "SECTION_4_CANNOT_FIT_SAFELY",
    fieldName: "section4",
    segments: [
      { text: "SECTION 4 – DEPOSITS AND ADVANCES.", bold: true },
      { text: "Upon moving in, the LESSEE shall pay one (1) month advance rent in the amount of" },
      { text: advanceValue, bold: true },
      { text: `covering the period of ${fields.advanceCoverageStart} to ${fields.advanceCoverageEnd}, and one (1) month security deposit in the amount of` },
      { text: depositValue, bold: true },
    ],
  });
  drawInlineSegments({
    page,
    fonts,
    x: layout.x,
    y: layout.reservationBaselineY,
    fontSize: layout.fontSize,
    segments: [
      { text: "The reservation fee of " },
      { text: "Php 2,000.00", bold: true },
      {
        text: " paid by the LESSEE shall be credited as partial payment for the said amounts. The",
      },
    ],
  });
  const inlineMetric = (fieldName, text) => {
    const position = flow.positions.find((entry) => entry.text === text);
    return {
    font: StandardFonts.TimesRomanBold,
    fontSize: layout.fontSize,
    fieldBox: {
      x: coordinates.fields[fieldName].x,
      y: coordinates.fields[fieldName].y,
      width: coordinates.fields[fieldName].width,
      height: coordinates.fields[fieldName].height,
    },
    x: position?.x ?? layout.x,
    baselineY: position?.y ?? layout.secondBaselineY,
    textWidth: position?.width ?? fonts.bold.widthOfTextAtSize(text, layout.fontSize),
    text,
    lines: [text],
  };
  };
  return {
    advanceRentAmount: inlineMetric("advanceRentAmount",
      String(fields.advanceRentAmount || "").replace(/[,\s]+$/, "") + ","),
    advanceCoverageStart: inlineMetric("advanceCoverageStart",
      String(fields.advanceCoverageStart || "").split(/\s+/)[0]),
    advanceCoverageEnd: inlineMetric("advanceCoverageEnd",
      String(fields.advanceCoverageEnd || "").split(/\s+/)[0]),
    securityDepositAmount: inlineMetric("securityDepositAmount",
      String(fields.securityDepositAmount || "").replace(/[.\s]+$/, "") + "."),
  };
};

const intersects = (a, b) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

export const assertContractFieldsAvoidLegalText = (coordinates) => {
  const configuredBoxes = [
    ...Object.entries(coordinates.fields),
    ...Object.entries(coordinates.propertyBlock || {}).map(([name, box]) => [
      `propertyBlock.${name}`,
      box,
    ]),
  ];
  const protectedRegions = {
    ...(coordinates.protectedPrintedTextRegions || {}),
    ...Object.fromEntries(
      Object.entries(coordinates.protectedRegions || {}).map(([name, region]) => [
        `document.${name}`,
        region,
      ]),
    ),
  };
  const overlayBoxes = configuredBoxes.map(([fieldName, box]) => {
    const padding = box.erasePadding ?? 0;
    return [fieldName, {
      x: box.x - padding,
      y: box.y - padding,
      width: box.width + padding * 2,
      height: box.height + padding * 2,
    }];
  });
  for (const [fieldName, box] of overlayBoxes) {
    for (const [regionName, region] of Object.entries(protectedRegions)) {
      if (intersects(box, region)) {
        const reservationFeeCollision =
          fieldName === "securityDepositAmount" &&
          regionName === "reservationFeeSentence";
        throw pdfError(
          "A Contract overlay intersects protected legal text.",
          reservationFeeCollision
            ? "CONTRACT_FIELD_INTERSECTS_LEGAL_TEXT"
            : "CONTRACT_OVERLAY_INTERSECTS_LEGAL_TEXT",
          500,
          { fieldName, regionName },
        );
      }
    }
  }
  return true;
};

export const normalizeContractBedDisplay = (value) =>
  String(value || "")
    .replace(/^upper$/i, "Upper")
    .replace(/^lower$/i, "Lower");

export const inspectMasterPdf = async (template, coordinates) => {
  let bytes;
  try {
    bytes = await fs.readFile(template.sourceFilePath);
  } catch {
    throw pdfError("Official master template was not found.", "CONTRACT_TEMPLATE_NOT_FOUND", 503);
  }
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw pdfError("Official master template is not a valid PDF.", "CONTRACT_TEMPLATE_INVALID_PDF", 503);
  }
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  if (template.checksum && hash !== template.checksum) {
    throw pdfError("Official master template checksum does not match.", "CONTRACT_TEMPLATE_CHECKSUM_MISMATCH", 503);
  }
  let document;
  try {
    document = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch {
    throw pdfError("Official master template is not a valid PDF.", "CONTRACT_TEMPLATE_INVALID_PDF", 503);
  }
  if (document.getPageCount() !== coordinates.pageCount) {
    throw pdfError(
      "Official master template page count does not match configuration.",
      "CONTRACT_TEMPLATE_PAGE_COUNT_MISMATCH",
      503,
    );
  }
  const page = document.getPage(0);
  const { width, height } = page.getSize();
  if (
    Math.abs(width - coordinates.pageWidth) > 0.1 ||
    Math.abs(height - coordinates.pageHeight) > 0.1
  ) {
    throw pdfError(
      "Official master template page size does not match 8.5 × 13 inches.",
      "CONTRACT_TEMPLATE_PAGE_SIZE_MISMATCH",
      503,
      { width, height },
    );
  }
  return { bytes, hash, document, pageCount: document.getPageCount() };
};

const drawPropertyBlock = ({ page, fonts, property, coordinates, debug }) => {
  // Gil Puyat is the legal text already printed in every official master.
  // Leaving it intact produces the cleanest continuous clause and avoids
  // replacing wording that is not dynamic.
  if (property.branch !== "guadalupe") return;
  const { propertyName, addressLine1, addressLine2 } = coordinates.propertyBlock;
  for (const region of [propertyName, addressLine1, addressLine2]) {
    page.drawRectangle({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      color: rgb(1, 1, 1),
    });
    if (debug) {
      page.drawRectangle({
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        borderColor: rgb(0.9, 0.1, 0.1),
        borderWidth: 0.5,
        color: rgb(1, 0.85, 0.85),
        opacity: 0.22,
      });
    }
  }
  const branchAddress = ["9431 Magallanes", "Street, 1212 Makati, Metro Manila;"];
  drawFittedField({
    page,
    fonts,
    fieldName: "propertyName",
    value: `${property.propertyName},`,
    config: propertyName,
    erase: false,
    debug,
  });
  drawFittedField({
    page,
    fonts,
    fieldName: "propertyAddressLine1",
    value: branchAddress[0],
    config: addressLine1,
    erase: false,
    debug,
  });
  drawFittedField({
    page,
    fonts,
    fieldName: "propertyAddressLine2",
    value: branchAddress[1],
    config: addressLine2,
    erase: false,
    debug,
  });
};

export const renderPreparedContractPdf = async (generationData) => {
  const coordinates = getContractTemplateCoordinates(generationData.template.templateId);
  assertContractFieldsAvoidLegalText(coordinates);
  const master = await inspectMasterPdf(generationData.template, coordinates);
  if (
    generationData.template.templateId === "quadruple-sharing-short-term"
    && process.env.NODE_ENV !== "test"
  ) {
    const htmlBytes = await renderContractHtmlPdf(generationData);
    const htmlDocument = await PDFDocument.load(htmlBytes, { updateMetadata: false });
    return {
      bytes: htmlBytes,
      pageCount: htmlDocument.getPageCount(),
      coordinateVersion: coordinates.version,
      masterHash: master.hash,
      fieldMetrics: {},
    };
  }
  const document = master.document;
  const page = document.getPage(0);
  const fonts = {
    regular: await document.embedFont(StandardFonts.TimesRoman),
    bold: await document.embedFont(StandardFonts.TimesRomanBold),
  };
  const debug = process.env.NODE_ENV !== "production"
    && process.env.CONTRACT_PDF_DEBUG_OVERLAY === "true";
  const fields = {
    ...generationData.fields,
    contractExecutionMonthYear: [
      generationData.fields.contractExecutionMonth,
      generationData.fields.contractExecutionYear,
    ].filter(Boolean).join(" "),
    leaseDurationWords: capitalize(generationData.fields.leaseDurationWords),
    bedOrSlotNumber: normalizeContractBedDisplay(generationData.fields.bedOrSlotNumber),
    tenantLegalName: String(generationData.fields.tenantLegalName || "")
      .replace(/[,\s]+$/, "") + ",",
    advanceRentAmount: String(generationData.fields.advanceRentAmount || "")
      .replace(/[,\s]+$/, "") + ",",
    securityDepositAmount: String(generationData.fields.securityDepositAmount || "")
      .replace(/[.\s]+$/, "") + ".",
  };
  const approvedFields = [
    "contractExecutionDay",
    "contractExecutionMonthYear",
    "roomNumber",
    "bedOrSlotNumber",
    "leaseDurationNumber",
    "leaseDurationWords",
    "leaseStartDate",
    "leaseEndDate",
    "regularMonthlyRate",
    "discountPercentage",
    "approvedMonthlyRate",
  ];
  const fieldMetrics = {};
  for (const fieldName of approvedFields) {
    const metric = drawFittedField({
      page,
      fonts,
      fieldName,
      value: fields[fieldName],
      config: coordinates.fields[fieldName],
      debug,
    });
    fieldMetrics[fieldName] = {
      font: coordinates.fields[fieldName].fontWeight === "bold"
        ? StandardFonts.TimesRomanBold
        : StandardFonts.TimesRoman,
      fontSize: metric.fontSize,
      fieldBox: {
        x: coordinates.fields[fieldName].x,
        y: coordinates.fields[fieldName].y,
        width: coordinates.fields[fieldName].width,
        height: coordinates.fields[fieldName].height,
      },
      x: metric.x,
      baselineY: metric.baselineY,
      textWidth: metric.width,
      text: metric.text,
      lines: metric.lines,
    };
  }
  Object.assign(fieldMetrics,
    drawTenantIdentityBlock({ page, fonts, fields, coordinates, debug }));
  Object.assign(fieldMetrics,
    drawSection4Block({ page, fonts, fields, coordinates, debug }));
  drawPropertyBlock({ page, fonts, property: generationData.property, coordinates, debug });
  if (debug) {
    for (const region of Object.values(coordinates.protectedPrintedTextRegions || {})) {
      page.drawRectangle({
        ...region,
        borderColor: rgb(0.1, 0.55, 0.15),
        borderWidth: 0.65,
        color: rgb(0.75, 1, 0.75),
        opacity: 0.14,
      });
    }
  }
  const label = coordinates.preparedLabel;
  const fittedLabel = fitSingleLineText(fonts.regular, PREPARED_COPY_LABEL, {
    ...label,
    minFontSize: label.fontSize,
  }, "preparedCopyLabel");
  page.drawText(PREPARED_COPY_LABEL, {
    x: label.x + (label.width - fittedLabel.width) / 2,
    y: label.y,
    size: label.fontSize,
    font: fonts.regular,
    color: rgb(0.48, 0, 0),
  });
  const outputBytes = await document.save({
    addDefaultPage: false,
    updateFieldAppearances: false,
    useObjectStreams: false,
  });
  const renderedDocument = await PDFDocument.load(outputBytes, { updateMetadata: false });
  return {
    bytes: Buffer.from(outputBytes),
    pageCount: renderedDocument.getPageCount(),
    coordinateVersion: coordinates.version,
    masterHash: master.hash,
    fieldMetrics,
  };
};

const allowedStatuses = new Set(["ready_for_generation", "generated"]);

export const assertPreparedGenerationAllowed = (
  contract,
  regenerationReason = "",
) => {
  if (contract.finalDocument || contract.finalStorageKey || contract.publishedAt ||
      ["published", "active", "expiring_soon", "expired"].includes(contract.status)) {
    throw pdfError("A published Contract is immutable.", "PUBLISHED_CONTRACT_IMMUTABLE", 409);
  }
  if (!allowedStatuses.has(contract.status)) {
    throw pdfError(
      "Contract status does not allow prepared PDF generation.",
      "CONTRACT_STATUS_NOT_GENERATABLE",
      409,
      { status: contract.status },
    );
  }
  const isRegeneration = (contract.preparedDocuments?.length || 0) > 0;
  if (isRegeneration && !String(regenerationReason || "").trim()) {
    throw pdfError("A regeneration reason is required.", "CONTRACT_REGENERATION_REASON_REQUIRED", 400);
  }
  if (isRegeneration && (contract.signedStorageKey || contract.notarizedStorageKey || contract.finalStorageKey)) {
    throw pdfError("Prepared Contract cannot be regenerated after signing.", "CONTRACT_REGENERATION_NOT_ALLOWED", 409);
  }
  return { isRegeneration };
};

export const generatePreparedContractPdf = async ({
  contractId,
  actorId,
  regenerationReason = "",
}) => {
  const contract = await Contract.findById(contractId);
  if (!contract) throw pdfError("Contract not found.", "CONTRACT_NOT_FOUND", 404);
  const { isRegeneration } = assertPreparedGenerationAllowed(
    contract,
    regenerationReason,
  );
  const executionDateResolution = resolveContractExecutionDate(contract);
  const existingSnapshotDate = (contract.preparedDocuments || [])
    .map((document) => document.generationSnapshot?.executionDate)
    .find(Boolean);
  if (
    existingSnapshotDate &&
    new Date(existingSnapshotDate).getTime() !== executionDateResolution.value.getTime()
  ) {
    throw pdfError(
      "The Contract execution date conflicts with an immutable generated snapshot.",
      "CONTRACT_EXECUTION_DATE_CONFLICT",
      409,
    );
  }
  if (!contract.executionDate) {
    contract.executionDate = executionDateResolution.value;
    contract.updatedBy = actorId;
    await contract.save();
  }
  const validation = await validateContractForGeneration(contract);
  if (!validation.valid) {
    throw pdfError(
      "Contract validation failed before PDF generation.",
      "CONTRACT_GENERATION_VALIDATION_FAILED",
      422,
      validation,
    );
  }
  const generationData = await buildContractGenerationData(contract);
  const rendered = await renderPreparedContractPdf(generationData);
  const generatedVersion = Math.max(
    0,
    ...(contract.preparedDocuments || []).map((document) => Number(document.version) || 0),
  ) + 1;
  const target = buildPreparedContractStorage({
    contractId: String(contract._id),
    branch: contract.branch,
    year: contract.contractYear,
    contractNumber: contract.contractNumber,
    tenantLegalName: contract.tenantLegalName,
    roomType: contract.roomType,
    leaseType: contract.leaseType,
    contractDate: generationData.lease.executionDate.toISOString().slice(0, 10),
    version: generatedVersion,
  });
  const generatedAt = new Date();
  const fileHash = crypto.createHash("sha256").update(rendered.bytes).digest("hex");
  let storedDocument = null;
  try {
    storedDocument = await storePreparedContractDocument({
      target,
      bytes: rendered.bytes,
      metadata: {
        contractId: contract._id,
        contractNumber: contract.contractNumber,
        documentType: "prepared",
        version: generatedVersion,
        fileHash,
      },
    });
    await inspectPreparedContractDocument({
      storageProvider: storedDocument.provider,
      storageKey: storedDocument.storageKey,
    });
    const previousStatus = contract.status;
    for (const document of contract.preparedDocuments || []) document.superseded = true;
    contract.preparedDocuments.push({
      documentType: "prepared",
      version: generatedVersion,
      storageProvider: storedDocument.provider,
      storageKey: storedDocument.storageKey,
      fileName: target.fileName,
      fileHash,
      fileSize: rendered.bytes.length,
      pageCount: rendered.pageCount,
      generatedAt,
      generatedBy: actorId,
      templateId: generationData.template.templateId,
      templateVersion: generationData.template.templateVersion,
      coordinateVersion: rendered.coordinateVersion,
      reason: String(regenerationReason || "").trim(),
      superseded: false,
      generationSnapshot: {
        executionDate: generationData.lease.executionDate,
        executionDateSource: generationData.lease.executionDateSource,
        fields: generationData.fields,
      },
      renderMetadata: {
        coordinateVersion: rendered.coordinateVersion,
        fields: rendered.fieldMetrics,
      },
    });
    contract.generatedStorageKey = target.storageKey;
    contract.generatedFileName = target.fileName;
    contract.generatedFileHash = fileHash;
    contract.generatedFileSize = rendered.bytes.length;
    contract.generatedPageCount = rendered.pageCount;
    contract.generatedAt = generatedAt;
    contract.generatedBy = actorId;
    contract.generatedVersion = generatedVersion;
    contract.updatedBy = actorId;
    if (previousStatus === "ready_for_generation") {
      await transitionContract(contract, "generated", actorId, "Prepared Contract PDF generated");
    } else {
      await contract.save();
    }
    return {
      contract,
      document: contract.preparedDocuments.at(-1),
      previousStatus,
      isRegeneration,
    };
  } catch (error) {
    if (storedDocument) {
      await removePreparedContractDocument({
        storageProvider: storedDocument.provider,
        storageKey: storedDocument.storageKey,
      }).catch(() => {});
    }
    throw error;
  }
};
