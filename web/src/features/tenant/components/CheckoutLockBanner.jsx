import React, { useState, useEffect } from "react";
import { reservationApi } from "../../../shared/api/reservationApi.js";

/**
 * CheckoutLockBanner - Displays a live 30-minute lock countdown banner during bed reservation checkout.
 * Enforces solid flat colors (NO gradients) with 1px border.
 */
export default function CheckoutLockBanner({ lockId, roomId, bedId, initialTimeRemainingSeconds = 1800, onLockExpired }) {
  const [secondsLeft, setSecondsLeft] = useState(initialTimeRemainingSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (onLockExpired) onLockExpired();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, onLockExpired]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isWarning = secondsLeft < 300;

  return (
    <div
      role="region"
      aria-label="Bed Reservation Lock Timer"
      className={`w-full p-4 mb-4 rounded-lg border text-sm font-medium transition-colors ${
        isWarning
          ? "bg-amber-50 border-amber-300 text-amber-900"
          : "bg-emerald-50 border-emerald-300 text-emerald-900"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isWarning ? "bg-amber-500" : "bg-emerald-500"}`} />
          <span>
            Bed checkout locked for Room <strong>{roomId}</strong> (Bed <strong>{bedId}</strong>)
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-base font-bold">
          <span>Time Remaining:</span>
          <span className="px-2 py-1 bg-white border rounded text-slate-800 shadow-xs">
            {secondsLeft > 0 ? formattedTime : "EXPIRED"}
          </span>
        </div>
      </div>
    </div>
  );
}
