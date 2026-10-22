// lib/time.ts
// Standardized Mauritius (UTC+4) time module for HBaOMS.
// All business logic, display, cut-offs, and stay-windows operate in Indian/Mauritius.
// Storage across the database is UTC instants (timestamptz ISO strings).

export const MAURITIUS_TIMEZONE = "Indian/Mauritius";
export const MAURITIUS_UTC_OFFSET = "+04:00";
export const MAURITIUS_UTC_OFFSET_HOURS = 4;
export const DEFAULT_CHECKOUT_CUTOFF = "12:00";

/**
 * Returns current instant as UTC ISO-8601 string: e.g. "2026-10-15T12:00:00.000Z".
 */
export function nowInstant(): string {
  return new Date().toISOString();
}

/**
 * Normalizes any date/timestamp string into a valid Date object.
 * Tolerates legacy database rows stored without timezone offsets (e.g. "2026-10-15 09:00:00"
 * or "2026-10-15T09:00:00") by treating bare timestamps as Mauritius wall time (+04:00).
 * NOTE FOR FUTURE REMOVAL: Once Supabase columns are converted to TIMESTAMPTZ,
 * this bare-string tolerance branch can be removed so all values are strict ISO instants.
 */
export function parseToInstant(value: string | Date | null | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;

  const trimmed = value.trim();
  if (!trimmed) return new Date();

  // If string already contains an explicit timezone designator (Z or +HH:mm or -HH:mm)
  const hasTimezone = /Z|[+-]\d{2}(:\d{2})?$/i.test(trimmed);
  if (hasTimezone) {
    return new Date(trimmed);
  }

  // Bare date-only string: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00${MAURITIUS_UTC_OFFSET}`);
  }

  // Bare datetime string without timezone (e.g. "2026-10-15 09:00:00" or "2026-10-15T09:00:00")
  const isoFormatted = trimmed.replace(" ", "T");
  return new Date(`${isoFormatted}${MAURITIUS_UTC_OFFSET}`);
}

/**
 * Returns current calendar date in Mauritius as "YYYY-MM-DD".
 */
export function mauritiusToday(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: MAURITIUS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/**
 * Converts a user wall-clock date and time in Mauritius to a true UTC ISO instant string.
 * Example: mauritiusToInstant("2026-10-15", "09:00") -> "2026-10-15T05:00:00.000Z".
 */
export function mauritiusToInstant(dateStr: string, timeStr: string = "00:00"): string {
  const cleanDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.trim();
  const rawTime = (timeStr.includes("T") ? timeStr.split("T")[1] : timeStr).trim();
  const timeParts = rawTime.split(":");
  const h = (timeParts[0] || "00").padStart(2, "0");
  const m = (timeParts[1] || "00").padStart(2, "0");
  const s = (timeParts[2] || "00").slice(0, 2).padStart(2, "0");
  const cleanTime = `${h}:${m}:${s}`;

  const instant = new Date(`${cleanDate}T${cleanTime}${MAURITIUS_UTC_OFFSET}`);
  return instant.toISOString();
}

export interface MauritiusTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm (24-hour)
  time12Str: string; // hh:mm AM/PM
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
}

/**
 * Extracts wall-clock date and time components in Indian/Mauritius timezone from an instant.
 */
export function instantToMauritiusParts(instant: string | Date | null | undefined): MauritiusTimeParts {
  const d = parseToInstant(instant);
  if (isNaN(d.getTime())) {
    const today = mauritiusToday();
    const [y, m, dayNum] = today.split("-").map(Number);
    return {
      year: y,
      month: m,
      day: dayNum,
      hour: 0,
      minute: 0,
      second: 0,
      dateStr: today,
      timeStr: "00:00",
      time12Str: "12:00 AM",
      dayOfWeek: 0,
    };
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MAURITIUS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const part of parts) {
    if (part.type === "year") year = parseInt(part.value, 10);
    else if (part.type === "month") month = parseInt(part.value, 10);
    else if (part.type === "day") day = parseInt(part.value, 10);
    else if (part.type === "hour") hour = parseInt(part.value, 10);
    else if (part.type === "minute") minute = parseInt(part.value, 10);
    else if (part.type === "second") second = parseInt(part.value, 10);
  }

  if (hour === 24) hour = 0;

  const yStr = String(year);
  const mStr = String(month).padStart(2, "0");
  const dStr = String(day).padStart(2, "0");
  const dateStr = `${yStr}-${mStr}-${dStr}`;

  const hStr = String(hour).padStart(2, "0");
  const minStr = String(minute).padStart(2, "0");
  const timeStr = `${hStr}:${minStr}`;

  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const time12Str = `${String(h12).padStart(2, "0")}:${minStr} ${ampm}`;

  // Calculate day of week in Mauritius time
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return { year, month, day, hour, minute, second, dateStr, timeStr, time12Str, dayOfWeek };
}

/**
 * Returns instant for 00:00:00 Mauritius time on the specified date string.
 */
export function startOfMauritiusDay(dateStr: string): string {
  return mauritiusToInstant(dateStr, "00:00:00");
}

/**
 * Returns instant for 23:59:59.999 Mauritius time on the specified date string.
 */
export function endOfMauritiusDay(dateStr: string): string {
  const cleanDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.trim();
  return new Date(`${cleanDate}T23:59:59.999${MAURITIUS_UTC_OFFSET}`).toISOString();
}

/**
 * Adds n hours to an instant, returning the new instant ISO string.
 */
export function addHours(instant: string | Date, n: number): string {
  const d = parseToInstant(instant);
  return new Date(d.getTime() + n * 3600000).toISOString();
}

/**
 * Adds n calendar days to a YYYY-MM-DD date string.
 */
export function addDaysToMauritiusDate(dateStr: string, n: number): string {
  const clean = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.trim();
  const [y, m, d] = clean.split("-").map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d + n));
  const resY = utcDate.getUTCFullYear();
  const resM = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const resD = String(utcDate.getUTCDate()).padStart(2, "0");
  return `${resY}-${resM}-${resD}`;
}

/**
 * Returns the difference in fractional hours until target instant from given instant.
 * Positive if target is in future; negative if in past.
 */
export function hoursUntil(targetInstant: string | Date, fromInstant: string | Date = nowInstant()): number {
  const target = parseToInstant(targetInstant).getTime();
  const from = parseToInstant(fromInstant).getTime();
  return (target - from) / 3600000;
}

/**
 * Checks if target instant has passed.
 */
export function isPast(instant: string | Date, fromInstant: string | Date = nowInstant()): boolean {
  return parseToInstant(instant).getTime() < parseToInstant(fromInstant).getTime();
}

/**
 * Checks if target instant or calendar day is within Mauritius stay window.
 * Check-in begins at 00:00:00 Mauritius time on checkInDate.
 * Check-out ends at cutoffTime (default 12:00) on checkOutDate.
 */
export function isWithinStay(
  target: string | Date,
  checkInDate: string,
  checkOutDate: string,
  cutoffTime: string = DEFAULT_CHECKOUT_CUTOFF
): boolean {
  const checkInClean = checkInDate.includes("T") ? checkInDate.split("T")[0] : checkInDate.trim();
  const checkOutClean = checkOutDate.includes("T") ? checkOutDate.split("T")[0] : checkOutDate.trim();

  // If target is pure date YYYY-MM-DD
  if (typeof target === "string" && /^\d{4}-\d{2}-\d{2}$/.test(target.trim())) {
    const clean = target.trim();
    return clean >= checkInClean && clean <= checkOutClean;
  }

  const startInstant = new Date(`${checkInClean}T00:00:00${MAURITIUS_UTC_OFFSET}`).getTime();
  const endInstant = new Date(`${checkOutClean}T${cutoffTime}:00${MAURITIUS_UTC_OFFSET}`).getTime();
  const targetTime = parseToInstant(target).getTime();

  return targetTime >= startInstant && targetTime <= endInstant;
}

/**
 * Formats an instant in Mauritius time zone with custom styles.
 */
export function formatMauritius(
  instant: string | Date | null | undefined,
  style: "date" | "time" | "datetime" | "human" = "date"
): string {
  if (!instant) return "N/A";

  // For pure YYYY-MM-DD string, format directly to avoid any date boundary shift
  if (typeof instant === "string" && /^\d{4}-\d{2}-\d{2}$/.test(instant.trim())) {
    const [y, m, d] = instant.trim().split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthName = months[parseInt(m, 10) - 1] || m;
    const dayPadded = d.padStart(2, "0");
    if (style === "date") return `${dayPadded}-${monthName}-${y}`;
    if (style === "human") return `${dayPadded} ${monthName} ${y}`;
  }

  const d = parseToInstant(instant);
  if (isNaN(d.getTime())) return "N/A";

  const parts = instantToMauritiusParts(d);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = months[parts.month - 1];
  const dayPadded = String(parts.day).padStart(2, "0");

  if (style === "date") {
    return `${dayPadded}-${monthName}-${parts.year}`;
  }
  if (style === "time") {
    return parts.time12Str;
  }
  if (style === "datetime") {
    return `${dayPadded}-${monthName}-${parts.year} ${parts.time12Str}`;
  }
  if (style === "human") {
    return `${dayPadded} ${monthName} ${parts.year}, ${parts.time12Str}`;
  }
  return `${dayPadded}-${monthName}-${parts.year}`;
}
