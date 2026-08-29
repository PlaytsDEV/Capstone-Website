import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const hookSource = readFileSync(join(__dirname, "useReservationFlow.js"), "utf8");
const pageSource = readFileSync(join(__dirname, "../pages/ReservationFlowPage.jsx"), "utf8");

test("useReservationFlow computes isReservationConfirmed and exports it", () => {
  assert.match(
    hookSource,
    /const isReservationConfirmed = useMemo\(\(\) => \{[\s\S]*?Number\(currentStage\) === 5[\s\S]*?hasReservationStatus\(status, "reserved", "moveIn", "moveOut"\)[\s\S]*?Boolean\(paymentApproved\)/,
    "isReservationConfirmed must check currentStage 5, confirmed statuses, and paymentApproved",
  );

  assert.match(
    hookSource,
    /return \{[\s\S]*?\bisReservationConfirmed\b[\s\S]*?\};/m,
    "isReservationConfirmed must be exported in useReservationFlow return object",
  );
});

test("handleExitToDashboard suppresses 'reservation progress has been saved' toast when isReservationConfirmed is true", () => {
  const exitHandlerMatch = hookSource.match(
    /const handleExitToDashboard = async \(\) => \{[\s\S]*?appNavigate\("\/applicant\/profile",\s*\{[\s\S]*?tab: "dashboard"[\s\S]*?\}\);/m,
  );
  assert.ok(exitHandlerMatch, "handleExitToDashboard must exist");
  const exitCode = exitHandlerMatch[0];

  assert.match(
    exitCode,
    /if \(!isReservationConfirmed\) \{\s*showNotification\(\s*["']Your reservation progress has been saved\./,
    "handleExitToDashboard must guard showNotification with !isReservationConfirmed",
  );
});

test("ReservationFlowPage header renders 'Back to Dashboard' and 'Reservation confirmed' status when confirmed", () => {
  assert.match(
    pageSource,
    /flow\.isReservationConfirmed \? "Back to Dashboard" : "Exit to Dashboard"/,
    "Header button must display 'Back to Dashboard' when confirmed",
  );

  assert.match(
    pageSource,
    /flow\.isReservationConfirmed \? \(\s*<span className="rf-autosave-status rf-autosave-saved">\s*<span className="rf-autosave-dot success" aria-hidden="true" \/>\s*Reservation confirmed\s*<\/span>/,
    "Header must display 'Reservation confirmed' badge when confirmed",
  );
});
