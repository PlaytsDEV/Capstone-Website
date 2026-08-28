import { OFFICIAL_CONTRACT_TEMPLATES } from "../config/contractTemplateRegistry.js";
import { renderContractHtmlPdf } from "../services/contractHtmlPdfService.js";
import { PDFDocument } from "pdf-lib";

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

async function testAll() {
  for (const template of OFFICIAL_CONTRACT_TEMPLATES) {
    for (const variant of variants) {
      const guadalupe = template.roomType === "quadruple-sharing";
      const months = template.leaseType === "short-term" ? 3 : 6;
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
          contractExecutionDay: "28th",
          contractExecutionMonth: "August",
          contractExecutionYear: "2026",
          tenantLegalName: variant.tenantLegalName,
          tenantResidentialAddress: variant.tenantResidentialAddress,
          roomNumber: "GD-102",
          bedOrSlotNumber: variant.bedOrSlotNumber,
          leaseDurationNumber: months,
          leaseDurationWords: months === 3 ? "three" : "six",
          leaseStartDate: "August 31, 2026",
          leaseEndDate: "September 30, 2026",
          advanceCoverageStart: "August 31, 2026",
          advanceCoverageEnd: "September 29, 2026",
          regularMonthlyRate: "7,000.00",
          discountPercentage: "10",
          approvedMonthlyRate: "6,300.00",
          advanceRentAmount: "6,300.00",
          securityDepositAmount: "6,300.00",
        },
      };
      const bytes = await renderContractHtmlPdf(data);
      const doc = await PDFDocument.load(bytes);
      const pageCount = doc.getPageCount();
      console.log(`${template.templateId}-${variant.key}: ${bytes.length} bytes, ${pageCount} page(s)`);
      if (pageCount > 1) {
        console.error(`FAILED: ${template.templateId}-${variant.key} produced ${pageCount} pages!`);
      }
    }
  }
}

testAll().catch(console.error);
