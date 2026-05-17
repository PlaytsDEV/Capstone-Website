import test from "node:test";
import assert from "node:assert/strict";

import {
  canAutoSaveApplicationDraft,
  getApplicationDraftStorageKey,
  getApplicationSaveStatusText,
  getSerializableUploadUrl,
  hasRecoverableApplicationDraft,
} from "./applicationDraftAutosave.js";

test("application draft storage key is scoped by user and reservation", () => {
  assert.equal(
    getApplicationDraftStorageKey("user-1", "reservation-1"),
    "applicantApplicationDraft:user-1:reservation-1",
  );
  assert.equal(getApplicationDraftStorageKey("user-1", ""), "");
});

test("recoverable draft detects backend application fields before submission", () => {
  assert.equal(hasRecoverableApplicationDraft({ firstName: "Ana" }), true);
  assert.equal(
    hasRecoverableApplicationDraft({
      validIDFrontUrl: "https://storage.example/id-front.jpg",
    }),
    true,
  );
  assert.equal(
    hasRecoverableApplicationDraft({
      firstName: "Ana",
      applicationSubmittedAt: "2026-05-17T08:00:00.000Z",
    }),
    false,
  );
});

test("autosave is allowed only for accessible editable application drafts", () => {
  assert.equal(
    canAutoSaveApplicationDraft({
      currentStage: 3,
      reservationId: "reservation-1",
      applicationAccessAllowed: true,
      stageLocked: false,
      applicationSubmitted: false,
      reservationStatus: "visit_approved",
    }),
    true,
  );
  assert.equal(
    canAutoSaveApplicationDraft({
      currentStage: 3,
      reservationId: "reservation-1",
      applicationAccessAllowed: true,
      stageLocked: false,
      applicationSubmitted: true,
      reservationStatus: "pending_application_review",
    }),
    false,
  );
  assert.equal(
    canAutoSaveApplicationDraft({
      currentStage: 3,
      reservationId: "reservation-1",
      applicationAccessAllowed: true,
      stageLocked: false,
      applicationSubmitted: true,
      editingApplication: true,
      reservationStatus: "needs_revision",
    }),
    true,
  );
});

test("save status uses applicant-friendly messages", () => {
  assert.equal(getApplicationSaveStatusText("saving"), "Saving your progress...");
  assert.equal(getApplicationSaveStatusText("saved"), "Progress saved.");
  assert.equal(
    getApplicationSaveStatusText("error"),
    "We could not save your latest changes. Please check your connection.",
  );
  assert.equal(
    getApplicationSaveStatusText("", new Date().toISOString()),
    "Last saved: just now",
  );
});

test("only uploaded URLs are serialized into draft payloads", () => {
  assert.equal(getSerializableUploadUrl("https://storage.example/file.jpg"), "https://storage.example/file.jpg");
  assert.equal(getSerializableUploadUrl({ name: "local-file.jpg" }), "");
  assert.equal(getSerializableUploadUrl("blob:http://local"), "");
});
