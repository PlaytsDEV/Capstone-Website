import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileCheck2, Printer, RefreshCw, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { contractApi } from "../../../../shared/api/contractApi";
import { showNotification } from "../../../../shared/utils/notification";
import DetailDrawer from "../shared/DetailDrawer";
import PricingApprovalModal from "./PricingApprovalModal";
import ContractWorkflowModal from "./ContractWorkflowModal";
import {
  getContractBlockers,
  getReadinessCopy,
  formatContractHistoryReason,
} from "../../utils/contractReadiness.mjs";
import {
  formatContractStatus,
  formatContractValue,
  getContractErrorMessage,
  getContractStage,
} from "../../utils/contractUi.mjs";

const date = (value) => value ? new Date(value).toLocaleDateString("en-PH", {
  year: "numeric", month: "short", day: "numeric",
}) : "—";
const money = (value) => value == null ? "—" : `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const size = (value) => value ? `${(Number(value) / 1024).toFixed(1)} KB` : "—";
const actorName = (value) => {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return [value.firstName, value.lastName].filter(Boolean).join(" ") || value.email || "Administrator";
};
const notarizationChecks = [
  ["contractNumberMatches", "Contract number matches"],
  ["tenantLegalNameMatches", "Tenant legal name matches"],
  ["assignmentMatches", "Branch, room, and bed match"],
  ["leaseDatesMatch", "Lease dates match"],
  ["currentPreparedContractUsed", "Current prepared Contract was used"],
  ["tenantWetSignatureVisible", "Tenant wet signature is visible"],
  ["lessorWetSignatureVisible", "Lessor wet signature is visible"],
  ["witnessSignaturesVisible", "Required witness signatures are visible"],
  ["acknowledgmentCompleted", "Acknowledgment is completed"],
  ["notarySignatureVisible", "Notary signature is visible"],
  ["notarialSealVisible", "Notarial seal is visible"],
  ["notarizationDateVisible", "Notarization date is visible"],
  ["notarizationPlaceVisible", "Notarization place is visible"],
  ["documentNumberCompleted", "Doc. No. is completed where applicable"],
  ["pageNumberCompleted", "Page No. is completed where applicable"],
  ["bookNumberCompleted", "Book No. is completed where applicable"],
  ["seriesCompleted", "Series is completed where applicable"],
  ["allPagesPresent", "All pages are present"],
  ["scanReadable", "Scan is readable"],
  ["noPageCropped", "No page is cropped"],
  ["noPageMissing", "No page is missing"],
  ["legalWordingUnchanged", "Legal wording is unchanged"],
  ["noUnauthorizedAlteration", "No unauthorized alteration is present"],
];
const publicationChecks = [
  ["contractNumberMatches", "Contract number matches"],
  ["tenantLegalNameMatches", "Tenant legal name matches"],
  ["branchMatches", "Branch matches"],
  ["assignmentMatches", "Room and bed/slot match"],
  ["leaseDatesMatch", "Lease dates match"],
  ["currentPreparedVersionMatches", "Current prepared version matches"],
  ["verifiedNotarizedVersionSelected", "Correct verified notarized version is selected"],
  ["wetSignaturesVisible", "Wet signatures are visible"],
  ["acknowledgmentCompleted", "Notarial acknowledgment is complete"],
  ["notarySignatureVisible", "Notary signature is visible"],
  ["notarialSealVisible", "Notarial seal is visible"],
  ["allPagesPresent", "All pages are present"],
  ["scanReadable", "Scan is readable"],
  ["noPageCropped", "No page is cropped"],
  ["legalWordingUnchanged", "Legal wording appears unchanged"],
  ["noRejectedOrSupersededVersion", "No rejected or superseded version is used"],
  ["tenantSecureAccessConfirmed", "Tenant will receive secure access"],
  ["finalDocumentImmutabilityConfirmed", "Final document becomes immutable"],
  ["formalReplacementRequiredConfirmed", "Future corrections require a formal replacement process"],
];

export default function ContractDetailDrawer({ contractId, open, onClose, onChanged }) {
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [confirmGeneration, setConfirmGeneration] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [regenerationReason, setRegenerationReason] = useState("");
  const [pricingOpen, setPricingOpen] = useState(false);
  const [pricingError, setPricingError] = useState("");
  const [workflowDialog, setWorkflowDialog] = useState(null);
  const signedInput = useRef(null);
  const notarizedInput = useRef(null);
  const showWorkflow = (config) => setWorkflowDialog(config);
  const submitWorkflow = async (values) => {
    const action = workflowDialog?.onSubmit;
    setWorkflowDialog(null);
    if (action) await action(values);
  };

  const load = useCallback(async () => {
    if (!contractId) return;
    setLoading(true);
    setError("");
    try {
      const payload = await contractApi.getContract(contractId);
      setContract(payload.contract);
      if (["draft", "incomplete", "ready_for_generation"].includes(payload.contract?.status)) {
        const checked = await contractApi.validateContract(contractId);
        setValidation(checked.validation);
        if (checked.contract) setContract(checked.contract);
      }
    } catch (requestError) {
      setError(getContractErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    if (!open) return undefined;
    const refreshAfterSourceEdit = () => load();
    window.addEventListener("focus", refreshAfterSourceEdit);
    return () => window.removeEventListener("focus", refreshAfterSourceEdit);
  }, [open, load]);

  useEffect(() => {
    if (open) {
      setValidation(null);
      setConfirmGeneration(false);
      setReviewConfirmed(false);
      setRegenerationReason("");
      load();
    }
  }, [open, load]);

  const runAction = async (name, action, success) => {
    setBusy(name);
    setError("");
    try {
      const result = await action();
      showNotification(success, "success");
      await load();
      onChanged?.();
      return result;
    } catch (requestError) {
      const message = getContractErrorMessage(requestError);
      setError(message);
      showNotification(message, "error");
      return null;
    } finally {
      setBusy("");
    }
  };

  const validate = async () => {
    const result = await runAction("validate", () => contractApi.validateContract(contractId), "Contract validation completed.");
    if (result) setValidation(result.validation);
  };

  const approvePricing = async ({ decision, notes }) => {
    setBusy("approve-pricing");
    setPricingError("");
    try {
      await contractApi.approveGenerationPricing(contractId, decision, notes);
      setPricingOpen(false);
      showNotification("Contract pricing approved.", "success");
      await load();
      onChanged?.();
    } catch (requestError) {
      setPricingError(getContractErrorMessage(requestError));
    } finally {
      setBusy("");
    }
  };

  const generate = async () => {
    const isRegeneration = (contract?.preparedDocuments?.length || 0) > 0;
    if (isRegeneration && !regenerationReason.trim()) {
      setError("A regeneration reason is required.");
      return;
    }
    const result = await runAction(
      "generate",
      () => contractApi.generatePreparedContract(contractId, isRegeneration ? regenerationReason.trim() : ""),
      isRegeneration ? "A new prepared Contract version was generated." : "Prepared Contract generated.",
    );
    if (result) {
      setConfirmGeneration(false);
      setReviewConfirmed(false);
      setRegenerationReason("");
    }
  };

  const openFile = async (version, mode) => {
    setBusy(`file-${version}-${mode}`);
    try {
      const blob = await contractApi.getPreparedContractFile(contractId, version);
      const url = URL.createObjectURL(blob);
      if (mode === "download") {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = contract?.preparedDocuments?.find((item) => item.version === version)?.fileName || `prepared-contract-v${version}.pdf`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const child = window.open(url, "_blank", "noopener,noreferrer");
        if (mode === "print" && child) child.addEventListener("load", () => child.print(), { once: true });
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (requestError) {
      setError(getContractErrorMessage(requestError));
    } finally {
      setBusy("");
    }
  };

  const versions = useMemo(
    () => [...(contract?.preparedDocuments || [])].sort((a, b) => b.version - a.version),
    [contract],
  );
  const currentPrepared = versions.find((document) => document.superseded !== true) || null;
  const currentVersion = Number(currentPrepared?.version) || 0;
  const canGenerate = contract?.status === "ready_for_generation" && validation?.valid === true;
  const canRegenerate = contract?.status === "generated" &&
    !contract?.signedStorageKey && !contract?.notarizedStorageKey && !contract?.finalStorageKey;
  const signing = [
    "awaiting_signatures", "partially_signed", "signed",
    "awaiting_notarization", "notarized", "ready_for_publication",
  ].includes(contract?.status);
  const currentSigned = [...(contract?.signedDocuments || [])]
    .filter((item) => !item.superseded).sort((a, b) => b.version - a.version)[0];
  const currentNotarized = [...(contract?.notarizedDocuments || [])]
    .filter((item) => !item.superseded).sort((a, b) => b.version - a.version)[0];
  const blockers = getContractBlockers(validation);
  const paymentSummary = contract?.initialPaymentSummary;
  const pricingComplete = paymentSummary?.valid === true &&
    ["totalInitialCharges", "reservationFeeCreditApplied", "remainingInitialAmountDue"]
      .every((field) => Number.isFinite(Number(paymentSummary?.[field])));
  const pricingValid = pricingComplete &&
    contract?.validatedGenerationData?.pricingValidation?.valid !== false;
  const readiness = getReadinessCopy(
    contract, validation, Boolean(currentNotarized && !contract?.notarizationVerifiedAt),
  );
  const openSource = (kind) => {
    const target = kind === "profile"
      ? `/admin/tenants?tenantId=${contract.tenantId}`
      : kind === "assignment"
        ? `/admin/tenants?tenantId=${contract.tenantId}&section=assignment`
        : `/admin/reservations?reservationId=${contract.reservationId}`;
    navigate(target);
  };
  const blockerAction = (blocker) => {
    if (blocker.kind === "pricing") return setPricingOpen(true);
    if (blocker.kind === "refresh") return validate();
    return openSource(blocker.kind);
  };
  const signaturesComplete = contract?.tenantSignatureStatus === "completed" &&
    contract?.lessorSignatureStatus === "completed" &&
    ["completed", "not_required"].includes(contract?.witnessSignatureStatus);
  const signingNextAction = contract?.status === "generated"
    ? "Print, complete wet signing and in-person notarization, then upload the scanned notarized copy"
    : contract?.status === "notarized" ? "Ready for final publication"
      : currentNotarized ? "Verify signed and notarized copy"
        : ["awaiting_signatures", "partially_signed"].includes(contract?.status)
          ? "Complete wet signing and in-person notarization"
          : "Upload the signed-and-notarized scanned copy";

  const changeSignature = (signer, status) => runAction(
    `${signer}-${status}`,
    () => contractApi.updateSignature(contractId, signer, status),
    "Signature progress updated.",
  );
  const openSigned = async (download = false) => {
    setBusy("signed-file");
    try {
      const blob = await contractApi.getSignedContractFile(contractId, currentSigned?.version, download);
      const url = URL.createObjectURL(blob);
      if (download) {
        const anchor = document.createElement("a");
        anchor.href = url; anchor.download = currentSigned?.fileName || "signed-contract"; anchor.click();
      } else window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), download ? 1000 : 60_000);
    } catch (requestError) { setError(getContractErrorMessage(requestError)); }
    finally { setBusy(""); }
  };
  const uploadSigned = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const replacing = (contract?.signedDocuments?.length || 0) > 0;
    showWorkflow({
      title: replacing ? "Replace Signed-Only Copy" : "Upload Signed-Only Copy",
      message: "This legacy action stores a signed-only scan separately from the official signed-and-notarized workflow.",
      fields: replacing ? [{ key: "reason", label: "Replacement reason", type: "textarea", required: true }] : [],
      checks: [{ key: "confirmed", label: "I selected the correct Contract scan." }],
      submitLabel: replacing ? "Replace Copy" : "Upload Copy",
      onSubmit: (values) => runAction("signed-upload",
        () => contractApi.uploadSignedContract(contractId, file, values.reason?.trim()),
        "Signed Contract copy uploaded."),
    });
  };
  const uploadNotarized = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const replacing = (contract?.notarizedDocuments?.length || 0) > 0;
    showWorkflow({
      title: replacing ? "Replace Signed and Notarized Copy" : "Upload Signed and Notarized Copy",
      message: "Optional notarial details must be copied only from the physical paper.",
      fields: [
        ...(replacing ? [{ key: "replacementReason", label: "Replacement reason", type: "textarea", required: true }] : []),
        { key: "notarizedAt", label: "Notarization date", type: "date" },
        { key: "notarizationPlace", label: "Notarization place" },
        { key: "notaryName", label: "Notary name" }, { key: "notaryOffice", label: "Notary office" },
        { key: "documentNumber", label: "Doc. No." }, { key: "pageNumber", label: "Page No." },
        { key: "bookNumber", label: "Book No." }, { key: "seriesYear", label: "Series year", type: "number" },
      ],
      checks: [{ key: "confirmed", label: "I selected the scan that corresponds to the current prepared Contract." }],
      submitLabel: replacing ? "Replace Copy" : "Upload Copy",
      onSubmit: (values) => {
        const { replacementReason, confirmed: _confirmed, ...notarialDetails } = values;
        return runAction("notarized-upload", () => contractApi.uploadNotarizedContract(
          contractId, file, currentVersion, replacementReason?.trim(), notarialDetails,
        ), "Signed-and-notarized Contract copy uploaded for verification.");
      },
    });
  };
  const verifyNotarized = async () => {
    showWorkflow({
      title: "Verify Signed and Notarized Copy",
      message: "Confirm every item against the uploaded scan and physical Contract.",
      fields: [{ key: "notes", label: "Verification notes", type: "textarea" }],
      checks: notarizationChecks.map(([key, label]) => ({ key, label })),
      submitLabel: "Verify Copy",
      onSubmit: (values) => {
        const checklist = Object.fromEntries(notarizationChecks.map(([key]) => [key, values[key] === true]));
        return runAction("verify-notarized", () => contractApi.verifyNotarizedContract(
          contractId, currentNotarized.version, checklist, values.notes?.trim() || "",
        ), "Signed-and-notarized Contract verified.");
      },
    });
  };
  const rejectNotarized = async () => {
    showWorkflow({
      title: "Reject Signed and Notarized Copy",
      fields: [{ key: "reason", label: "Rejection reason", type: "textarea", required: true }],
      checks: [{ key: "confirmed", label: "I confirm this upload must be replaced." }],
      submitLabel: "Reject Copy",
      onSubmit: (values) => runAction("reject-notarized", () =>
        contractApi.rejectNotarizedContract(
          contractId, currentNotarized.version, values.reason.trim(),
        ), "Signed-and-notarized copy rejected; replacement is required."),
    });
  };
  const openNotarized = async (download = false) => {
    setBusy("notarized-file");
    try {
      const blob = await contractApi.getNotarizedContractFile(contractId, currentNotarized?.version, download);
      const url = URL.createObjectURL(blob);
      if (download) {
        const anchor = document.createElement("a");
        anchor.href = url; anchor.download = currentNotarized?.fileName || "notarized-contract"; anchor.click();
      } else window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), download ? 1000 : 60_000);
    } catch (requestError) { setError(getContractErrorMessage(requestError)); }
    finally { setBusy(""); }
  };
  const openFinal = async (download = false) => {
    setBusy("final-file");
    try {
      const blob = await contractApi.getFinalContractFile(contractId, download);
      const url = URL.createObjectURL(blob);
      if (download) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = contract?.finalDocument?.fileName || "final-contract";
        anchor.click();
      } else window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), download ? 1000 : 60_000);
    } catch (requestError) { setError(getContractErrorMessage(requestError)); }
    finally { setBusy(""); }
  };
  const reviewForPublication = () => showWorkflow({
    title: "Review for Publication",
    message: "Confirm that the verified signed-and-notarized scan is ready for final publication review.",
    checks: [{ key: "confirmed", label: "The current verified notarized document is ready for publication review." }],
    submitLabel: "Mark Ready for Publication",
    onSubmit: () => runAction("ready-publication",
      () => contractApi.markReadyForPublication(contractId),
      "Contract marked ready for publication."),
  });
  const openPublicationReview = () => showWorkflow({
    title: "Publish Final Contract",
    message: `${contract.contractNumber} · ${contract.tenantLegalName} · ${formatContractValue(contract.branch)} · ` +
      `${contract.roomNumber}/${contract.bedLabel || contract.bedId || "—"} · ` +
      `${date(contract.leaseStartDate)} to ${date(contract.leaseEndDate)} · ` +
      `Notarized version ${currentNotarized?.version || "—"} · Verified ${date(contract.notarizationVerifiedAt)} · ` +
      `${currentNotarized?.fileName || "—"} · ${size(currentNotarized?.fileSize)}`,
    fields: [{ key: "notes", label: "Publication notes (optional)", type: "textarea" }],
    checks: [
      ...publicationChecks.map(([key, label]) => ({ key, label })),
      {
        key: "confirmed",
        label: "I confirm that the correct wet-signed and notarized Contract will be published as the tenant’s final digital copy.",
      },
    ],
    secondaryAction: { label: "View Notarized Copy", onClick: () => openNotarized(false) },
    submitLabel: "Publish Final Contract",
    onSubmit: (values) => {
      const checklist = Object.fromEntries(publicationChecks.map(([key]) => [key, values[key] === true]));
      return runAction("publish-final",
        () => contractApi.publishFinalContract(contractId, checklist, values.notes || ""),
        "Final Contract published.");
    },
  });

  return (
    <DetailDrawer open={open} onClose={onClose} width={1320} className="contract-detail-drawer"
      title={contract?.contractNumber || "Contract Details"}
      subtitle={contract ? getContractStage(contract.status) : "Loading Contract"}>
      {loading && <div className="contract-loading">Loading Contract…</div>}
      {error && <div className="contract-alert contract-alert--error">{error}</div>}
      {contract && <>
        <details className="contract-full-details">
          <summary>View full details</summary>
        <div className="contract-detail-grid">
          <section><h3>Contract Overview</h3>
            <dl><dt>Status</dt><dd>{formatContractStatus(contract.status)}</dd><dt>Contract Version</dt><dd>{contract.version}</dd><dt>Template</dt><dd>{formatContractValue(contract.templateType)}</dd><dt>Created</dt><dd>{date(contract.createdAt)}</dd><dt>Updated</dt><dd>{date(contract.updatedAt)}</dd></dl>
          </section>
          <section><h3>Tenant</h3>
            <dl><dt>Legal Name</dt><dd>{contract.tenantLegalName || "—"}</dd><dt>Email</dt><dd>{contract.tenantEmail || "—"}</dd><dt>Phone</dt><dd>{contract.tenantPhone || "—"}</dd><dt>Address</dt><dd>{contract.tenantAddress || "—"}</dd><dt>Nationality</dt><dd>{contract.tenantNationality || "—"}</dd></dl>
          </section>
          <section><h3>Assignment</h3>
            <dl><dt>Branch</dt><dd>{formatContractValue(contract.branch)}</dd><dt>Property</dt><dd>{contract.propertyName}</dd><dt>Room Type</dt><dd>{formatContractValue(contract.roomType)}</dd><dt>Room</dt><dd>{contract.roomNumber}</dd><dt>Bed / Slot</dt><dd>{contract.bedLabel || contract.bedId || "—"}</dd></dl>
          </section>
          <section><h3>Lease Details</h3>
            <dl><dt>Lease Type</dt><dd>{formatContractValue(contract.leaseType)}</dd><dt>Start</dt><dd>{date(contract.leaseStartDate)}</dd><dt>End</dt><dd>{date(contract.leaseEndDate)}</dd><dt>Duration</dt><dd>{contract.leaseDurationMonths ? `${contract.leaseDurationMonths} months` : "—"}</dd></dl>
          </section>
          <section className="contract-pricing-card"><h3>Pricing Review</h3>
            <span className={`contract-pricing-status ${pricingValid ? "contract-pricing-status--valid" : "contract-pricing-status--warning"}`}>{pricingValid ? "Pricing Valid" : "Pricing Needs Review"}</span>
            <h4>Monthly Rate</h4><dl><dt>Regular Rate</dt><dd>{money(contract.regularMonthlyRate)}</dd><dt>Discount</dt><dd>{contract.discountPercentage == null ? "—" : `${contract.discountPercentage}%`}</dd><dt>Approved Monthly Rate</dt><dd><strong>{money(contract.approvedMonthlyRate)}</strong></dd></dl>
            <h4>Initial Payment</h4><dl><dt>Advance Rent</dt><dd>{money(contract.advanceRentAmount)}</dd><dt>Security Deposit</dt><dd>{money(contract.securityDepositAmount)}</dd><dt>Total Initial Charges</dt><dd><strong>{money(contract.initialPaymentSummary?.totalInitialCharges)}</strong></dd><dt title="The verified reservation fee is applied as partial payment toward the advance rent and security deposit.">Reservation Fee Credit ⓘ</dt><dd>-{money(contract.initialPaymentSummary?.reservationFeeCreditApplied)}</dd><dt>Remaining Initial Amount Due</dt><dd><strong>{money(contract.initialPaymentSummary?.remainingInitialAmountDue)}</strong></dd></dl>
            <details className="contract-pricing-sources"><summary>View Pricing Sources</summary>
              <div className="contract-source-list"><span>Regular rate and discount: Official template configuration</span><span>Approved monthly rate: Approved Reservation pricing</span><span>Advance and deposit: Approved Reservation pricing</span><span>Reservation fee payment: Verified payment record</span><span>Credit rule: Approved Contract pricing rule</span></div>
            </details>
          </section>
          <section><h3>Prepared Document</h3>
            {versions.length > 0
              ? <div className="contract-prepared-label">Prepared Copy — Not Yet Signed or Notarized</div>
              : <div className="contract-document-empty"><strong>Prepared document</strong><span>Not yet generated</span></div>}
            <dl><dt>Version</dt><dd>{currentVersion || "Not generated"}</dd><dt>Generated date</dt><dd>{date(contract.generatedAt)}</dd><dt>Filename</dt><dd className="contract-filename" title={contract.generatedFileName || ""}>{contract.generatedFileName || "—"}</dd><dt>File size</dt><dd>{size(contract.generatedFileSize)}</dd><dt>Page count</dt><dd>{contract.generatedPageCount || "—"}</dd><dt>Template version</dt><dd>{contract.templateVersion || "—"}</dd><dt>Hash</dt><dd className="contract-hash">{contract.generatedFileHash ? `${contract.generatedFileHash.slice(0, 16)}…` : "—"}</dd></dl>
          </section>
          {(contract.status === "generated" || signing) && <section><h3>Physical Signing</h3>
            <p className="contract-next-action"><strong>Next Action:</strong> {signingNextAction}</p>
            <dl>
              <dt>Printed</dt><dd>{contract.printedAt ? "Printed" : "Not yet printed"}</dd>
              <dt>Printed date</dt><dd>{date(contract.printedAt)}</dd>
              <dt>Printed by</dt><dd>{actorName(contract.printedBy)}</dd>
              <dt>Prepared version</dt><dd>{currentVersion || "—"}</dd>
              <dt>Tenant signature</dt><dd>{formatContractValue(contract.tenantSignatureStatus || "pending")}</dd>
              <dt>Lessor signature</dt><dd>{formatContractValue(contract.lessorSignatureStatus || "pending")}</dd>
              <dt>Witness signatures</dt><dd>{formatContractValue(contract.witnessSignatureStatus || "pending")}</dd>
              <dt>Signed copy</dt><dd>{currentSigned ? `Version ${currentSigned.version}` : "Not uploaded"}</dd>
              <dt>Uploaded</dt><dd>{date(currentSigned?.uploadedAt)}</dd>
              <dt>Uploaded by</dt><dd>{actorName(currentSigned?.uploadedBy)}</dd>
              <dt>Verification</dt><dd>{contract.signingVerifiedAt ? "Verified" : contract.signingRejectionReason ? "Rejected" : currentSigned ? "Pending review" : "Not available"}</dd>
              <dt>Notarized copy</dt><dd>{currentNotarized ? `Version ${currentNotarized.version}` : "Not uploaded"}</dd>
              <dt>Notarization verification</dt><dd>{contract.notarizationVerifiedAt ? "Verified official record" : currentNotarized ? "Pending review" : "Not available"}</dd>
              <dt>Notarized filename</dt><dd>{currentNotarized?.fileName || "—"}</dd>
              <dt>Notarized file size</dt><dd>{size(currentNotarized?.fileSize)}</dd>
              <dt>Notarization date</dt><dd>{date(contract.notarizedAt)}</dd>
              <dt>Notarization place</dt><dd>{contract.notarizationPlace || "—"}</dd>
              <dt>Notary</dt><dd>{contract.notaryName || "—"}</dd>
              <dt>Notary office</dt><dd>{contract.notaryOffice || "—"}</dd>
              <dt>Doc. / Page / Book / Series</dt><dd>{[
                contract.documentNumber, contract.pageNumber, contract.bookNumber,
                contract.seriesYear,
              ].filter(Boolean).join(" / ") || "—"}</dd>
              {contract.notarizationRejectionReason && <><dt>Notarized-copy rejection</dt><dd>{contract.notarizationRejectionReason}</dd></>}
              {contract.signingRejectionReason && <><dt>Rejection reason</dt><dd>{contract.signingRejectionReason}</dd></>}
            </dl>
          </section>}
        </div>
        </details>

        {(contract.status === "generated" || signing) && <section className="contract-panel"><h3>Prepared Contract Actions</h3>
          {contract.status === "generated" && <div className="contract-action-group">
            <h4>Prepared Contract</h4>
            <div className="contract-action-row">
              {currentPrepared && <button className="contract-button" disabled={busy} onClick={() => openFile(currentPrepared.version, "preview")}><Eye size={16}/>View Prepared Copy</button>}
              <button className="contract-button contract-button--secondary" disabled={busy} onClick={() => {
                showWorkflow({
                  title: "Mark Prepared Contract as Printed",
                  message: "Confirm that the prepared Contract has been physically printed for wet signing and in-person notarization.",
                  checks: [{ key: "confirmed", label: "The current prepared Contract has been physically printed." }],
                  submitLabel: "Mark as Printed",
                  onSubmit: () => runAction("mark-printed", () => contractApi.markPrinted(contractId), "Contract marked as printed."),
                });
              }}><Printer size={16}/>Mark as Printed</button>
            </div>
            <p className="contract-action-helper">Print or download the document using the controls in the PDF viewer.</p>
            <h4>After Wet Signing and Notarization</h4>
            <p className="contract-action-helper">Print the prepared Contract from the PDF viewer. After all parties wet-sign it and the document is notarized in person, upload the scanned notarized copy.</p>
          </div>}
          <div className="contract-action-row">
            {["awaiting_signatures", "partially_signed"].includes(contract.status) && <>
              {["tenant", "lessor"].map((signer) => {
                const value = contract[`${signer}SignatureStatus`] || "pending";
                return <button key={signer} className="contract-button contract-button--secondary" disabled={busy}
                  onClick={() => changeSignature(signer, value === "completed" ? "pending" : "completed")}>
                  {value === "completed" ? `Revert ${formatContractValue(signer)} to Pending` : `Mark ${formatContractValue(signer)} Signature Complete`}
                </button>;
              })}
              {contract.witnessSignatureStatus === "pending" ? <>
                <button className="contract-button contract-button--secondary" disabled={busy} onClick={() => changeSignature("witnesses", "completed")}>Mark Witness Signatures Complete</button>
                <button className="contract-button contract-button--secondary" disabled={busy} onClick={() => changeSignature("witnesses", "not_required")}>Mark Witnesses Not Required</button>
              </> : <button className="contract-button contract-button--secondary" disabled={busy} onClick={() => changeSignature("witnesses", "pending")}>Revert Witnesses to Pending</button>}
              <details><summary>Legacy signed-only tracking</summary>
              <input ref={signedInput} hidden type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={uploadSigned}/>
              <button className="contract-button contract-button--secondary" disabled={busy} onClick={() => signedInput.current?.click()}><Upload size={16}/>{currentSigned ? "Replace Signed-Only Copy" : "Upload Signed-Only Copy"}</button>
              {currentSigned && <>
                <button className="contract-button contract-button--secondary" disabled={busy} onClick={() => openSigned(false)}><Eye size={16}/>Preview Signed Copy</button>
                <button className="contract-button contract-button--secondary" disabled={busy} onClick={() => openSigned(true)}><Download size={16}/>Download Signed Copy</button>
                <button className="contract-button" disabled={busy || !signaturesComplete} onClick={() => {
                  showWorkflow({
                    title: "Verify Signed-Only Copy",
                    fields: [{ key: "notes", label: "Verification notes", type: "textarea" }],
                    checks: [{ key: "confirmed", label: "Signatures, identity, pages, prepared version, and legal wording have been checked." }],
                    submitLabel: "Verify Signed Copy",
                    onSubmit: (values) => runAction("verify-signed",
                      () => contractApi.verifySignedContract(contractId, values.notes?.trim() || ""),
                      "Signed Contract verified."),
                  });
                }}><FileCheck2 size={16}/>Verify Signed Copy</button>
                <button className="contract-button contract-button--secondary" disabled={busy} onClick={() => {
                  showWorkflow({
                    title: "Reject Signed-Only Copy",
                    fields: [{ key: "reason", label: "Rejection reason", type: "textarea", required: true }],
                    checks: [{ key: "confirmed", label: "I confirm this upload must be replaced." }],
                    submitLabel: "Reject Signed Copy",
                    onSubmit: (values) => runAction("reject-signed",
                      () => contractApi.rejectSignedContract(contractId, values.reason.trim()),
                      "Signed copy rejected; replacement required."),
                  });
                }}>Reject Signed Copy</button>
              </>}
              </details>
            </>}
            {["generated", "awaiting_signatures", "partially_signed", "signed", "awaiting_notarization"]
              .includes(contract.status) && <>
              <input ref={notarizedInput} hidden type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={uploadNotarized}/>
              <button className="contract-button contract-button--secondary" disabled={busy} onClick={() => notarizedInput.current?.click()}>
                <Upload size={16}/>{currentNotarized ? "Replace Signed and Notarized Copy" : "Upload Signed and Notarized Copy"}
              </button>
              {currentNotarized && <>
                <button className="contract-button contract-button--secondary" disabled={busy} onClick={() => openNotarized(false)}><Eye size={16}/>Preview</button>
                <button className="contract-button contract-button--secondary" disabled={busy} onClick={() => openNotarized(true)}><Download size={16}/>Download</button>
                <button className="contract-button" disabled={busy} onClick={verifyNotarized}><FileCheck2 size={16}/>Verify Signed and Notarized Copy</button>
                <button className="contract-button contract-button--secondary" disabled={busy} onClick={rejectNotarized}>Reject Copy</button>
              </>}
            </>}
            {contract.status === "notarized" && <button className="contract-button contract-button--secondary" disabled={busy} onClick={() => openNotarized(false)}><Eye size={16}/>View Official Notarized Copy</button>}
            {contract.status === "notarized" && <button className="contract-button" disabled={busy} onClick={reviewForPublication}>Review for Publication</button>}
            {contract.status === "ready_for_publication" && <button className="contract-button" disabled={busy} onClick={openPublicationReview}>Publish Final Contract</button>}
          </div>
          {contract.status === "generated" && !currentPrepared && <div className="contract-alert contract-alert--error" data-error-code="CURRENT_PREPARED_DOCUMENT_UNAVAILABLE">
            <strong>Current prepared document unavailable.</strong>
            <p>The Contract is marked as generated, but no current prepared file is available.</p>
            <button className="contract-link-button" type="button" disabled={busy} onClick={validate}>Refresh Checks</button>
          </div>}
        </section>}

        {["published", "active", "expiring_soon", "expired"].includes(contract.status) &&
          contract.finalDocument && <section className="contract-panel"><h3>Final Contract Published</h3>
            <dl>
              <dt>Published date</dt><dd>{date(contract.finalDocument.publishedAt || contract.publishedAt)}</dd>
              <dt>Published by</dt><dd>{actorName(contract.publishedBy)}</dd>
              <dt>File name</dt><dd>{contract.finalDocument.fileName}</dd>
              <dt>File size</dt><dd>{size(contract.finalDocument.fileSize)}</dd>
              <dt>Page count</dt><dd>{contract.finalDocument.pageCount}</dd>
              <dt>Source notarized version</dt><dd>{contract.finalDocument.sourceVersion}</dd>
            </dl>
            <div className="contract-action-row">
              <button className="contract-button" disabled={busy} onClick={() => openFinal(false)}><Eye size={16}/>View Final Contract</button>
              <button className="contract-button contract-button--secondary" disabled={busy} onClick={() => openFinal(true)}><Download size={16}/>Download Final Contract</button>
            </div>
          </section>}

        <section className="contract-panel" id="contract-summary"><h3>Contract Summary</h3>
          <div className="contract-readonly-grid">
            <span><small>Tenant legal name</small>{contract.tenantLegalName || "—"}</span>
            <span><small>Branch</small>{formatContractValue(contract.branch)}</span>
            <span><small>Room and bed/slot</small>{[contract.roomNumber, contract.bedLabel || contract.bedId].filter(Boolean).join(" · ") || "—"}</span>
            <span><small>Lease term</small>{formatContractValue(contract.roomType)} · {formatContractValue(contract.leaseType)}</span>
            <span><small>Lease dates</small>{date(contract.leaseStartDate)} — {date(contract.leaseEndDate)}</span>
            <span><small>Approved monthly rate</small>{money(contract.approvedMonthlyRate)}</span>
            <span><small>Current stage</small>{getContractStage(contract.status)}</span>
          </div>
        </section>

        <section className="contract-panel contract-readiness" id="contract-readiness"><h3>{readiness.title}</h3><p>{readiness.message}</p>
          {blockers.length > 0 && <div className="contract-blocker-list">{blockers.map((blocker) =>
            <article key={`${blocker.kind}-${blocker.title}`}><div><strong>{blocker.title}</strong><p>{blocker.description}</p></div>
              <button className="contract-button contract-button--secondary" type="button" onClick={() => blockerAction(blocker)}>{blocker.action}</button>
            </article>)}</div>}
          <div className="contract-action-row">
            {canGenerate && <button className="contract-button" type="button" onClick={() => setConfirmGeneration(true)}>Generate Prepared Contract</button>}
            <button className="contract-link-button" type="button" disabled={busy} onClick={validate}>{busy === "validate" ? "Refreshing…" : "Refresh Checks"}</button>
          </div>
          <details><summary>View System Checks</summary><p>Official template, pricing consistency, source relationships, and required generation fields are checked automatically.</p>{validation?.valid && <p>All current Contract checks passed.</p>}</details>
        </section>

        <section className="contract-panel contract-documents">
          {!currentPrepared ? <div className="contract-document-empty"><strong>Prepared document</strong><span>Not yet generated</span></div> :
            <><h3>Current Document Status</h3>
              <div className="contract-current-document">
                <dl><dt>Prepared Version</dt><dd>{currentPrepared.version}</dd>
                  <dt>Generated date</dt><dd>{date(currentPrepared.generatedAt || contract.generatedAt)}</dd>
                  <dt>File name</dt><dd>{currentPrepared.fileName}</dd>
                  <dt>File size</dt><dd>{size(currentPrepared.fileSize)}</dd>
                  <dt>Page count</dt><dd>{currentPrepared.pageCount || "—"}</dd></dl>
              </div>
            <details><summary>Prepared document history</summary><div className="contract-version-list">{versions.map((document) => <article key={document.version}>
              <div><strong>Version {document.version}</strong><span className={document.version === currentVersion ? "contract-current" : "contract-superseded"}>{document.version === currentVersion ? "Current Version" : "Superseded"}</span></div>
              <p>{date(document.generatedAt)} · {size(document.fileSize)} · {document.pageCount} page(s) · Template {document.templateVersion}</p>
              {document.reason && <p>Reason: {document.reason}</p>}
              {document.superseded === true && <div className="contract-version-actions">
                <button onClick={() => openFile(document.version, "preview")}><Eye size={14} />Preview</button>
                <button onClick={() => openFile(document.version, "download")}><Download size={14} />Download</button>
              </div>}
            </article>)}</div></details></>}
        </section>

        <section className="contract-panel"><h3>Status History</h3>
          <div className="contract-history">{(contract.statusHistory || []).slice().reverse().slice(0, 3).map((entry, index) => <div key={`${entry.changedAt}-${index}`}><strong>{formatContractStatus(entry.status)}</strong><span>{date(entry.changedAt)}</span><p>{formatContractHistoryReason(entry.reason)}</p></div>)}</div>
          {(contract.statusHistory || []).length > 3 && <details><summary>View full history</summary>
            <div className="contract-history">{(contract.statusHistory || []).slice().reverse().slice(3).map((entry, index) => <div key={`${entry.changedAt}-${index}`}><strong>{formatContractStatus(entry.status)}</strong><span>{date(entry.changedAt)}</span><p>{formatContractHistoryReason(entry.reason)}</p></div>)}</div>
          </details>}
        </section>

        <PricingApprovalModal open={pricingOpen} contract={contract}
          busy={busy === "approve-pricing"} error={pricingError}
          onCancel={() => { setPricingOpen(false); setPricingError(""); }}
          onCorrectSource={() => {
            setPricingOpen(false);
            navigate(`/admin/reservations?reservationId=${contract.reservationId}&section=pricing`);
          }}
          onApprove={approvePricing}/>
        <ContractWorkflowModal dialog={workflowDialog} busy={Boolean(busy)}
          onCancel={() => setWorkflowDialog(null)} onSubmit={submitWorkflow}/>

        {confirmGeneration && <div className="contract-confirm">
          <h3>{canRegenerate ? "Regenerate Prepared Contract?" : "Generate Prepared Contract?"}</h3>
          <p>{canRegenerate ? "A new prepared version will be generated. The previous version will remain available in Contract history." : "The system will generate a tenant-specific PDF using the approved official template and verified tenant, room, lease, and pricing information."}</p>
          {canRegenerate && <label className="contract-field"><span>Regeneration reason</span><textarea value={regenerationReason} onChange={(event) => setRegenerationReason(event.target.value)} /></label>}
          <label className="contract-check"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} />I confirm that I reviewed the contract information.</label>
          <div><button className="contract-button contract-button--secondary" onClick={() => setConfirmGeneration(false)}>Cancel</button><button className="contract-button" disabled={!reviewConfirmed || busy === "generate" || (canRegenerate && !regenerationReason.trim())} onClick={generate}>{busy === "generate" ? "Generating…" : "Confirm Generation"}</button></div>
        </div>}
      </>}
    </DetailDrawer>
  );
}
