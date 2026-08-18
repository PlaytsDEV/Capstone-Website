/**
 * Validation and date formatting helpers for Tenant Personal Details
 */

export const toTitleCase = (str) => {
  if (!str) return "";
  return String(str)
    .replace(/[-_]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

export const formatProperCase = (str) => {
  if (!str || typeof str !== "string") return "";
  return String(str).replace(/(?:^|[\s'-])([a-zA-Z])/g, (match) => match.toUpperCase());
};

export const formatBed = (bed) => {
  if (!bed) return "";
  const b = String(bed).toLowerCase().trim();
  if (b === "upper") return "Upper Bed";
  if (b === "lower") return "Lower Bed";
  return toTitleCase(bed);
};

export const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export const parseDateParts = (value) => {
  if (!value) return { year: "", month: "", day: "" };
  let str = "";
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return { year: "", month: "", day: "" };
    str = value.toISOString();
  } else {
    str = String(value).trim();
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (!match) return { year: "", month: "", day: "" };
  return { year: match[1], month: match[2], day: match[3] };
};

export const getDaysInMonth = (year, month) => {
  const numericMonth = Number(month);
  if (!numericMonth) return 31;
  const numericYear = Number(year) || 2000;
  return new Date(numericYear, numericMonth, 0).getDate();
};

export const composeDate = ({ year, month, day }) => {
  if (!year || !month || !day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export const buildYearOptions = (minAge = 18, maxAge = 100) => {
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear - minAge;
  const minYear = currentYear - maxAge;
  const years = [];
  for (let y = maxYear; y >= minYear; y--) {
    years.push(String(y));
  }
  return years;
};

export const validateField = (field, value) => {
  const strVal =
    typeof value === "string"
      ? value.trim()
      : value !== undefined && value !== null
      ? String(value).trim()
      : "";

  switch (field) {
    case "firstName":
      if (!strVal) return "First name is required";
      if (strVal.length < 2) return "At least 2 characters required";
      if (strVal.length > 50) return "50 characters maximum";
      if (!/^[a-zA-Z\s\-']+$/.test(strVal))
        return "Letters, hyphens, and apostrophes only";
      return null;

    case "lastName":
      if (!strVal) return "Last name is required";
      if (strVal.length < 2) return "At least 2 characters required";
      if (strVal.length > 50) return "50 characters maximum";
      if (!/^[a-zA-Z\s\-']+$/.test(strVal))
        return "Letters, hyphens, and apostrophes only";
      return null;

    case "nationality":
      if (!strVal) return null;
      if (strVal.length > 50) return "50 characters maximum";
      if (!/^[a-zA-Z\s\-']+$/.test(strVal))
        return "Letters, hyphens, and apostrophes only";
      return null;

    case "occupation":
      if (!strVal) return null;
      if (strVal.length > 60) return "60 characters maximum";
      if (!/^[a-zA-Z0-9\s/&,.\-']+$/.test(strVal))
        return "Invalid characters in occupation";
      return null;

    case "dateOfBirth": {
      if (!strVal) return null;
      const parts = parseDateParts(strVal);
      if (!parts.year || !parts.month || !parts.day) {
        return "Complete date required (Month, Day, Year)";
      }
      const dob = new Date(`${parts.year}-${parts.month}-${parts.day}`);
      if (isNaN(dob.getTime())) return "Invalid birth date";
      const today = new Date();
      if (dob > today) return "Birth date cannot be in the future";

      const currentYear = today.getFullYear();
      const birthYear = dob.getFullYear();
      let age = currentYear - birthYear;
      const monthDiff = today.getMonth() - dob.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < dob.getDate())
      ) {
        age--;
      }

      if (age < 18) return "Must be at least 18 years old";
      if (age > 100) return "Birth date must be within the last 100 years";
      return null;
    }

    case "gender": {
      if (!strVal) return null;
      const valid = ["male", "female", "other", "prefer-not-to-say"];
      if (!valid.includes(strVal)) return "Invalid gender option selected";
      return null;
    }

    case "civilStatus": {
      if (!strVal) return null;
      const valid = ["single", "married", "widowed", "separated", "divorced"];
      if (!valid.includes(strVal))
        return "Invalid civil status option selected";
      return null;
    }

    default:
      return null;
  }
};
