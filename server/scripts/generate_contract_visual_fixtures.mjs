import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { OFFICIAL_CONTRACT_TEMPLATES } from "../config/contractTemplateRegistry.js";
import { renderPreparedContractPdf } from "../services/contractPdfService.js";

const outputDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../private/contract-visual-fixtures/html-flow-3.0.1",
);

await fs.mkdir(outputDirectory, { recursive: true });

const variants = [
  {
    key: "normal",
    tenantLegalName: "JUAN MIGUEL SANTOS DELA CRUZ",
    tenantResidentialAddress: "123 Sample Street, Barangay Central, Makati City",
    bedOrSlotNumber: "upper",
  },
  {
    key: "maximum",
    tenantLegalName: "ALEXANDRA ISABEL SAMPLE TENANT",
    tenantResidentialAddress:
      "123 Sample Residences, Barangay Central, City of Makati, National Capital Region (NCR)",
    bedOrSlotNumber: "lower",
  },
];

for (const template of OFFICIAL_CONTRACT_TEMPLATES) {
 for (const variant of variants) {
  const guadalupe = template.roomType === "quadruple-sharing";
  const months = template.leaseType === "short-term" ? 3 : 6;
  const currentRegression = template.templateId === "quadruple-sharing-short-term";
  const data = {
    template,
    property: {
      branch: guadalupe ? "guadalupe" : "gil-puyat",
      propertyName: guadalupe ? "LILYCREST GUADALUPE" : "LILYCREST GIL PUYAT",
      propertyAddress: guadalupe
        ? "9431 Magallanes Street, 1212 Makati, Metro Manila"
        : "#7 Gil Puyat Ave. corner Marconi St., Makati City",
    },
    fields: {
      contractExecutionDay: currentRegression ? "27th" : "15th",
      contractExecutionMonth: currentRegression ? "July" : "January",
      contractExecutionYear: "2026",
      tenantLegalName: variant.tenantLegalName,
      tenantResidentialAddress: variant.tenantResidentialAddress,
      roomNumber: "101",
      bedOrSlotNumber: variant.bedOrSlotNumber,
      leaseDurationNumber: months,
      leaseDurationWords: months === 3 ? "Three" : "Six",
      leaseStartDate: currentRegression ? "May 26, 2026" : "January 15, 2026",
      leaseEndDate: currentRegression ? "August 26, 2026" : "July 15, 2026",
      advanceCoverageStart: currentRegression ? "May 26, 2026" : "January 15, 2026",
      advanceCoverageEnd: currentRegression ? "June 26, 2026" : "February 15, 2026",
      regularMonthlyRate: "7,000.00",
      discountPercentage: "10",
      approvedMonthlyRate: "6,300.00",
      advanceRentAmount: "6,300.00",
      securityDepositAmount: "6,300.00",
    },
    notarialFields: {
      shouldRemainBlank: true,
      notarizationPlace: "",
      notarizationDay: "",
      notarizationMonth: "",
      notarizationYear: "",
      documentNumber: "",
      pageNumber: "",
      bookNumber: "",
      seriesYear: "",
      notaryName: "",
      notarySeal: "",
      notarySignature: "",
    },
  };
  const output = await renderPreparedContractPdf(data);
  const outputPath = path.join(outputDirectory, `${template.templateId}-${variant.key}.pdf`);
  await fs.writeFile(outputPath, output.bytes, { mode: 0o600 });
  process.stdout.write(`${template.templateId}-${variant.key}: ${output.bytes.length} bytes, ${output.pageCount} page\n`);
 }
}
