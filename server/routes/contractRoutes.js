import express from "express";
import multer from "multer";
import { verifyAdmin, verifyApplicant, verifyOwner, verifyToken } from "../middleware/auth.js";
import { filterByBranch } from "../middleware/branchAccess.js";
import { requirePermission } from "../middleware/permissions.js";
import {
  createContract, getContract, getGenerationPreview, getTenantCurrentContract,
  generatePreparedContract, listContracts, streamPreparedContract,
  validateContract,
  getMyCurrentContract, getMyContractHistory, getMyContractDetails,
  streamMyPreparedContract,
  cleanupSupersededTestVersions,
  resetPreparedTestContract,
  markPrinted, updateTenantSignature, updateLessorSignature, updateWitnessSignatures,
  uploadSignedDocument, streamSignedDocument, verifySignedDocument, rejectSignedDocument,
  deleteSignedDocument,
  approveGenerationPricing,
  uploadNotarizedDocument, uploadFinalNotarizedContract, streamNotarizedDocument, verifyNotarizedDocument,
  rejectNotarizedDocument,
  replaceFinalDocument, getFinalDocumentHistory,
  readyContractForPublication, publishContract, streamFinalContract,
  streamMyFinalContract, streamMySignedContract,
  confirmLegacyReservationApproval,
  archiveContract, restoreContract, getContractDeletionEligibility,
  permanentlyDeleteContract,
  downloadMyStayProof,
  getMyStayProofData,
  getPublicStayVerification,
  getStayProofDataForAdmin,
  downloadStayProofForAdmin,
  acknowledgeMyContract,
  getMyContractAcknowledgement,
  getContractAcknowledgementForAdmin,
} from "../controllers/contractController.js";

const router = express.Router();
const signedUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

// Public verification route for scanned QR codes
router.get("/verify/:referenceId", getPublicStayVerification);

// Tenant stay proof routes
router.get("/my/stay-proof", verifyToken, verifyApplicant, downloadMyStayProof);
router.get("/my/stay-proof-data", verifyToken, verifyApplicant, getMyStayProofData);
router.get("/my/current", verifyToken, verifyApplicant, getMyCurrentContract);
router.get("/my/history", verifyToken, verifyApplicant, getMyContractHistory);
router.get("/my/:contractId/documents/prepared/:version?", verifyToken, verifyApplicant, streamMyPreparedContract);
router.get("/my/:contractId/documents/signed/:version?", verifyToken, verifyApplicant, streamMySignedContract);
router.get("/my/:contractId/documents/final", verifyToken, verifyApplicant, streamMyFinalContract);
router.get("/my/:contractId", verifyToken, verifyApplicant, getMyContractDetails);
router.get("/my/:contractId/acknowledgement", verifyToken, verifyApplicant, getMyContractAcknowledgement);
router.post("/my/:contractId/acknowledge", verifyToken, verifyApplicant, acknowledgeMyContract);

router.use(verifyToken, verifyAdmin, filterByBranch, requirePermission("manageTenants"));

router.get("/:id/stay-proof", downloadStayProofForAdmin);
router.get("/:id/stay-proof-data", getStayProofDataForAdmin);
router.get("/:id/acknowledgement", getContractAcknowledgementForAdmin);

router.post("/", createContract);
router.get("/", listContracts);
router.post("/:id/archive", archiveContract);
router.post("/:id/restore", verifyOwner, restoreContract);
router.get("/:id/deletion-eligibility", verifyOwner, getContractDeletionEligibility);
router.delete("/:id/permanent", verifyOwner, permanentlyDeleteContract);
router.get("/tenant/:tenantId/current", getTenantCurrentContract);
router.get("/:id/generation-preview", getGenerationPreview);
router.post("/:id/generate", generatePreparedContract);
router.post("/:id/cleanup-test-versions", verifyOwner, cleanupSupersededTestVersions);
router.post("/:id/reset-test-documents", verifyOwner, resetPreparedTestContract);
router.post("/:id/mark-printed", markPrinted);
router.post("/:id/signatures/tenant", updateTenantSignature);
router.post("/:id/signatures/lessor", updateLessorSignature);
router.post("/:id/signatures/witnesses", updateWitnessSignatures);
router.post("/:id/documents/signed", signedUpload.single("file"), uploadSignedDocument);
router.delete("/:id/documents/signed/:version?", deleteSignedDocument);
router.get("/:id/documents/signed/:version?", streamSignedDocument);
router.post("/:id/documents/signed/verify", verifySignedDocument);
router.post("/:id/documents/signed/reject", rejectSignedDocument);
router.post("/:id/documents/notarized", signedUpload.single("file"), uploadNotarizedDocument);
router.post("/:id/documents/final-notarized", signedUpload.single("file"), uploadFinalNotarizedContract);
router.get("/:id/documents/notarized/:version?", streamNotarizedDocument);
router.post("/:id/documents/notarized/verify", verifyNotarizedDocument);
router.post("/:id/documents/notarized/reject", rejectNotarizedDocument);
router.post("/:id/ready-for-publication", readyContractForPublication);
router.post("/:id/publish", publishContract);
router.get("/:id/documents/final", streamFinalContract);
router.get("/:id/documents/final/history", getFinalDocumentHistory);
router.post("/:id/documents/final/replace", verifyOwner, signedUpload.single("file"), replaceFinalDocument);
router.get("/:id/documents/prepared/:version?", streamPreparedContract);
router.get("/:id", getContract);
router.post("/:id/validate", validateContract);
router.post("/:id/approve-generation-pricing", approveGenerationPricing);
router.post("/:id/confirm-legacy-reservation-approval", confirmLegacyReservationApproval);

export default router;
