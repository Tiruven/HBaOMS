// lib/timeUtils.ts
// Re-exports Mauritius time standard from lib/time.ts and maintains backwards compatibility.

export * from "@/lib/time";
import {
  mauritiusToday,
  mauritiusToInstant,
  instantToMauritiusParts,
  isWithinStay,
  DEFAULT_CHECKOUT_CUTOFF,
  parseToInstant,
} from "@/lib/time";

export function parseDateOnly(dateStr: string): Date {
  const clean = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.trim();
  const [y, m, d] = clean.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

export function isWithinStayWindow(
  targetDateStr: string,
  checkInStr: string,
  checkOutStr: string,
  cutoffTime: string = DEFAULT_CHECKOUT_CUTOFF
): boolean {
  return isWithinStay(targetDateStr, checkInStr, checkOutStr, cutoffTime);
}

export function computeSlotEndTime(startTime: string, durationMinutes: number): string {
  // If full ISO date or timestamp string
  if (startTime.includes("T") || (startTime.includes("-") && startTime.length > 8)) {
    const d = parseToInstant(startTime);
    const end = new Date(d.getTime() + durationMinutes * 60000);
    return end.toISOString();
  }
  // If HH:mm string
  const [h, m] = startTime.split(":").map(Number);
  const totalMin = h * 60 + m + durationMinutes;
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

export function isWithinOperatingHours(
  startTime: string,
  endTime: string,
  openTime: string = "09:00:00",
  closeTime: string = "18:00:00"
): boolean {
  const toMinutes = (timeStr: string) => {
    // If full timestamp, extract time in Mauritius
    if (timeStr.includes("T") || (timeStr.includes("-") && timeStr.length > 8)) {
      const parts = instantToMauritiusParts(timeStr);
      return parts.hour * 60 + parts.minute;
    }
    const clean = timeStr.trim();
    const parts = clean.split(":");
    return Number(parts[0] || 0) * 60 + Number(parts[1] || 0);
  };

  const startMin = toMinutes(startTime);
  const endMin = toMinutes(endTime);
  const openMin = toMinutes(openTime);
  const closeMin = toMinutes(closeTime);
  return startMin >= openMin && endMin <= closeMin;
}

export function getDaysUntil(targetDateStr: string, fromDate?: Date): number {
  const cleanTarget = targetDateStr.includes("T") ? targetDateStr.split("T")[0] : targetDateStr.trim();
  const [ty, tm, td] = cleanTarget.split("-").map(Number);
  const targetUtc = Date.UTC(ty, tm - 1, td);

  const todayStr = fromDate ? mauritiusToday(fromDate) : mauritiusToday();
  const [cy, cm, cd] = todayStr.split("-").map(Number);
  const todayUtc = Date.UTC(cy, cm - 1, cd);

  return Math.floor((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

export function getHoursUntil(targetDateTimeStr: string, fromDate?: Date): number {
  const target = parseToInstant(targetDateTimeStr).getTime();
  const now = fromDate ? fromDate.getTime() : Date.now();
  return (target - now) / (1000 * 60 * 60);
}
