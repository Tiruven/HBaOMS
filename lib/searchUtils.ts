// lib/searchUtils.ts
import { Room, PricingRule } from "@/lib/types";

export interface OccupiedStay {
  room_id: number;
  check_in_date: string;
  check_out_date: string;
}

/**
 * Checks if a room has an active confirmed booking overlapping the target stay dates.
 * Standard interval overlap: (newCheckIn < existingCheckOut) && (newCheckOut > existingCheckIn)
 */
export function isRoomAvailableForDates(
  roomId: number,
  checkIn: string,
  checkOut: string,
  occupiedStays: OccupiedStay[]
): boolean {
  if (!checkIn || !checkOut) return true;

  return !occupiedStays.some((stay) => {
    if (stay.room_id !== roomId) return false;
    const stayIn = stay.check_in_date.split("T")[0];
    const stayOut = stay.check_out_date.split("T")[0];
    return checkIn < stayOut && checkOut > stayIn;
  });
}

/**
 * Calculates effective price for a room over given stay dates based on active pricing rules.
 */
export function getEffectiveRoomPrice(
  room: Room,
  checkInDate: string,
  checkOutDate: string,
  pricingRules: PricingRule[]
): { basePrice: number; effectivePrice: number; activeRule?: PricingRule } {
  const basePrice = room.room_type?.price || 5000;
  if (!room.room_type_room_type_id || !checkInDate || !checkOutDate) {
    return { basePrice, effectivePrice: basePrice };
  }

  const activeRule = pricingRules.find((rule) => {
    if (rule.room_type_room_type_id !== room.room_type_room_type_id) return false;
    const ruleStart = rule.start_date.split("T")[0];
    const ruleEnd = rule.end_date.split("T")[0];
    return checkInDate <= ruleEnd && checkOutDate >= ruleStart;
  });

  if (!activeRule) {
    return { basePrice, effectivePrice: basePrice };
  }

  const effectivePrice = Math.round(basePrice * (1 + activeRule.rate_override / 100));
  return { basePrice, effectivePrice, activeRule };
}

