import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getReservationFlowStageState } from "../../utils/reservationFlowStageState.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stepperSource = readFileSync(join(__dirname, "ReservationStepper.jsx"), "utf8");
const cssSource = readFileSync(join(__dirname, "../../styles/reservation-flow.css"), "utf8");

test("stage 1 is complete when user is on stage 2 with confirmed room", () => {
  const state = getReservationFlowStageState({
    stageId: 1,
    currentStage: 2,
    reservation: { roomConfirmed: true, status: "pending" },
  });
  assert.equal(state.isComplete, true);
  assert.equal(state.isActive, false);
  assert.equal(state.helperLabel, "Complete");
});

test("stage 2 is active and not complete when user is currently selecting viewing preference", () => {
  const state = getReservationFlowStageState({
    stageId: 2,
    currentStage: 2,
    reservation: { roomConfirmed: true, status: "pending" },
  });
  assert.equal(state.isActive, true);
  assert.equal(state.isComplete, false);
});

test("stage 3 is ready (unlocked) without being active when application is accessible on stage 2", () => {
  const state = getReservationFlowStageState({
    stageId: 3,
    currentStage: 2,
    reservation: {
      roomConfirmed: true,
      viewingPreference: "remote_2d_viewing",
      status: "pending",
    },
  });
  assert.equal(state.isReady, true);
  assert.equal(state.isActive, false);
  assert.equal(state.helperLabel, "Ready");
});

test("stages 4 and 5 remain locked during stage 2 viewing preference", () => {
  const stage4 = getReservationFlowStageState({
    stageId: 4,
    currentStage: 2,
    reservation: { status: "pending" },
  });
  const stage5 = getReservationFlowStageState({
    stageId: 5,
    currentStage: 2,
    reservation: { status: "pending" },
  });
  assert.equal(stage4.isLocked, true);
  assert.equal(stage5.isLocked, true);
});

test("ReservationStepper component assigns distinct ready and locked classes without container opacity", () => {
  assert.match(stepperSource, /stageState\.isReady.*ready/);
  assert.match(stepperSource, /stageState\.isLocked.*locked/);
  assert.match(stepperSource, /aria-current=\{stageState\.isActive \? "step" : undefined\}/);
  assert.match(stepperSource, /rf-stepper-helper/);
  assert.match(stepperSource, /rf-stepper-progress-rail/);
  assert.match(stepperSource, /rf-stepper-track-progress/);
  // Ensure container does not apply opacity < 1 so background progress line is not visible through dots
  assert.doesNotMatch(stepperSource, /opacity:\s*stageState/);
});

test("reservation-flow.css styles active step as solid highlight and ready/locked step as solid opaque dot", () => {
  assert.match(cssSource, /\.rf-stepper-step\.active \.rf-stepper-dot/);
  assert.match(cssSource, /\.rf-stepper-step\.ready \.rf-stepper-dot/);
  assert.match(cssSource, /\.rf-stepper-step\.ready \.rf-stepper-dot[\s\S]*?background:\s*var\(--card/);
  assert.match(cssSource, /\.rf-stepper-step\.locked \.rf-stepper-dot/);
  assert.match(cssSource, /\.rf-stepper-progress-rail/);
  assert.match(cssSource, /\.rf-stepper-track-progress/);
});

