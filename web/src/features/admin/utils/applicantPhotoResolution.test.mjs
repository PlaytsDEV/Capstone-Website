import test from "node:test";
import assert from "node:assert/strict";
import { resolveApplicantPhotoUrl } from "./applicantPhotoResolution.js";

test("prefers the applicant's current live profile photo over the submitted selfie", () => {
  const reservation = {
    selfiePhotoUrl: "https://storage.example/selfie-at-application.jpg",
    userId: { profileImage: "https://storage.example/current-profile.jpg" },
  };
  assert.equal(resolveApplicantPhotoUrl(reservation), "https://storage.example/current-profile.jpg");
});

test("falls back to the application-time selfie when no live profile photo exists", () => {
  const reservation = {
    selfiePhotoUrl: "https://storage.example/selfie-at-application.jpg",
    userId: { profileImage: null },
  };
  assert.equal(resolveApplicantPhotoUrl(reservation), "https://storage.example/selfie-at-application.jpg");
});

test("returns null (safe fallback avatar) when no photo exists anywhere", () => {
  assert.equal(resolveApplicantPhotoUrl({ userId: {} }), null);
  assert.equal(resolveApplicantPhotoUrl({}), null);
  assert.equal(resolveApplicantPhotoUrl(null), null);
  assert.equal(resolveApplicantPhotoUrl(undefined), null);
});

test("treats an empty/whitespace-only photo URL as absent, not a broken image to render", () => {
  assert.equal(resolveApplicantPhotoUrl({ userId: { profileImage: "   " } }), null);
  assert.equal(resolveApplicantPhotoUrl({ selfiePhotoUrl: "" }), null);
});

test("treats a non-string photo value (e.g. an accidental object) as absent", () => {
  assert.equal(resolveApplicantPhotoUrl({ userId: { profileImage: { url: "x" } } }), null);
});
