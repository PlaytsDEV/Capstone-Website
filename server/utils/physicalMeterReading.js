export const PHYSICAL_METER_ERROR_CODE = "INVALID_PHYSICAL_METER_READING";

function meterError(fieldLabel, reason, details = {}) {
  return Object.assign(new Error(`${fieldLabel} ${reason}`), {
    statusCode: 400,
    code: PHYSICAL_METER_ERROR_CODE,
    details,
  });
}

/**
 * Parse a physical meter measurement without JavaScript's empty-string/boolean
 * coercions. Financial amounts deliberately do not use this helper because
 * credits and adjustments may be signed.
 */
export function parsePhysicalMeterReading(
  value,
  {
    required = true,
    fieldLabel = "Meter reading",
    maximum = null,
  } = {},
) {
  if (value === null || value === undefined) {
    if (!required) return null;
    throw meterError(fieldLabel, "is required.");
  }

  if (typeof value === "string" && value.trim() === "") {
    if (!required) return null;
    throw meterError(fieldLabel, "is required.");
  }

  if (typeof value === "boolean") {
    throw meterError(fieldLabel, "must be a finite, non-negative number.");
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw meterError(fieldLabel, "must be a finite, non-negative number.", {
      submittedValue: value,
    });
  }
  if (numeric < 0) {
    throw meterError(fieldLabel, "cannot be negative.", {
      submittedValue: numeric,
    });
  }
  if (maximum !== null && numeric > Number(maximum)) {
    throw meterError(fieldLabel, `cannot exceed ${Number(maximum).toLocaleString()}.`, {
      submittedValue: numeric,
      maximum: Number(maximum),
    });
  }

  return numeric;
}

export function assertPhysicalMeterContinuity({
  reading,
  previousReading,
  eventType = null,
  fieldLabel = "Meter reading",
} = {}) {
  const numeric = parsePhysicalMeterReading(reading, { fieldLabel });
  if (previousReading === null || previousReading === undefined) return numeric;

  const previous = parsePhysicalMeterReading(previousReading, {
    fieldLabel: "Previous meter reading",
  });
  const resetEvent = eventType === "meterReplacement" || eventType === "meterRollover";
  if (!resetEvent && numeric < previous) {
    throw Object.assign(
      new Error(`${fieldLabel} (${numeric}) cannot be lower than the previous reading (${previous}) without an explicit meter replacement or rollover event.`),
      {
        statusCode: 400,
        code: "METER_READING_CONTINUITY_ERROR",
        details: { submittedReading: numeric, previousReading: previous, eventType },
      },
    );
  }
  return numeric;
}

export function isValidPhysicalMeterReading(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isValidOptionalPhysicalMeterReading(value) {
  return value === null || value === undefined || isValidPhysicalMeterReading(value);
}
