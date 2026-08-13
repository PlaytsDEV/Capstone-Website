import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanNotificationMessage,
  formatNotificationTitle,
  summarizeAnnouncementMessage,
} from "./notification.js";

test("summarizeAnnouncementMessage returns clean message", () => {
  assert.equal(
    summarizeAnnouncementMessage(""),
    "A new announcement is available.",
  );

  assert.equal(
    summarizeAnnouncementMessage(null),
    "A new announcement is available.",
  );

  assert.equal(
    summarizeAnnouncementMessage("Scheduled water outage at 2 PM"),
    "Scheduled water outage at 2 PM",
  );
});

test("formatNotificationTitle transforms past verbs into clean nouns", () => {
  assert.equal(formatNotificationTitle("Reservation Cancelled"), "Reservation Cancellation");
  assert.equal(formatNotificationTitle("Payment Confirmed"), "Payment Confirmation");
});

test("cleanNotificationMessage cleans unwanted placeholders and legacy announcement suffixes", () => {
  assert.equal(
    cleanNotificationMessage("Your reservation N/A has been cancelled."),
    "Your reservation has been cancelled.",
  );
  assert.equal(
    cleanNotificationMessage("Scheduled water outage at 2 PM • View in Announcements"),
    "Scheduled water outage at 2 PM",
  );
});

