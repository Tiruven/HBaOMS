// lib/pricing.ts
// Shared pricing, VAT, and graduated cancellation refund ladders for HBaOMS (v5.1).

import { getDaysUntil, getHoursUntil } from "@/lib/timeUtils";

export const VAT_RATE = 0.15;

export const GRADUATED_REFUND_LADDERS = {
  // Room refund ladder by calendar days before check-in:
  // 7 or more days = 100% refund
  // 3 to 6 days = 50% refund
  // 2 days or less = 0% refund
  room: [
    { minDays: 7, refundPercent: 100 },
    { minDays: 3, refundPercent: 50 },
    { minDays: 0, refundPercent: 0 },
  ],
  // Scheduled services ladder by hours before slot start:
  // 48 or more hours = 100% refund
  // 24 to 48 hours = 50% refund
  // Under 24 hours or no-show = 0% refund
  scheduledService: [
    { minHours: 48, refundPercent: 100 },
    { minHours: 24, refundPercent: 50 },
    { minHours: 0, refundPercent: 0 },
  ],
  // Tours and excursion trips ladder by hours before departure:
  // 48 or more hours = 100% refund
  // 24 to 48 hours = 50% refund
  // Under 24 hours or no-show = 0% refund
  trip: [
    { minHours: 48, refundPercent: 100 },
    { minHours: 24, refundPercent: 50 },
    { minHours: 0, refundPercent: 0 },
  ],
  // Standard check-out time in Mauritius (default 12:00)
  standardCheckOutCutoff: "12:00",
} as const;

export function calculateVat(subtotal: number): number {
  return Math.round(subtotal * VAT_RATE * 100) / 100;
}

export function calculateTotalWithVat(subtotal: number): number {
  return Math.round((subtotal + calculateVat(subtotal)) * 100) / 100;
}

export function extractVatPortion(totalWithVat: number): number {
  if (totalWithVat <= 0) return 0;
  // totalWithVat = base * (1 + 0.15) => vat = totalWithVat * (0.15 / 1.15)
  return Math.round((totalWithVat * (VAT_RATE / (1 + VAT_RATE))) * 100) / 100;
}

export function calculateTourPrice(
  adultPrice: number,
  childPrice: number,
  numAdults: number,
  numChildren: number
): number {
  const adultTotal = Math.max(0, numAdults) * Math.max(0, adultPrice);
  const childTotal = Math.max(0, numChildren) * Math.max(0, childPrice);
  return adultTotal + childTotal;
}

export interface ItemRefundCalculation {
  itemType: "room" | "service" | "trip";
  itemId: number;
  originalAmount: number;
  refundPercent: number;
  refundAmount: number;
  vatAmount: number;
  explanation: string;
}

export function computeRoomRefund(
  totalPaid: number,
  checkInDate: string,
  isHotelInitiated: boolean = false
): ItemRefundCalculation {
  if (isHotelInitiated) {
    const refundAmount = Math.round(totalPaid * 100) / 100;
    return {
      itemType: "room",
      itemId: 0,
      originalAmount: totalPaid,
      refundPercent: 100,
      refundAmount,
      vatAmount: extractVatPortion(refundAmount),
      explanation: "Hotel-initiated cancellation: 100% full refund.",
    };
  }

  const days = getDaysUntil(checkInDate);
  let refundPercent = 0;
  let explanation = "";

  if (days >= 7) {
    refundPercent = 100;
    explanation = "100% refund (cancelled 7 or more days prior to check-in).";
  } else if (days >= 3) {
    refundPercent = 50;
    explanation = "50% refund (cancelled between 3 and 6 days prior to check-in).";
  } else {
    refundPercent = 0;
    explanation = "0% refund (cancelled 2 days or less prior to check-in).";
  }

  const refundAmount = Math.round((totalPaid * (refundPercent / 100)) * 100) / 100;
  const vatAmount = extractVatPortion(refundAmount);

  return {
    itemType: "room",
    itemId: 0,
    originalAmount: totalPaid,
    refundPercent,
    refundAmount,
    vatAmount,
    explanation,
  };
}

export function computeScheduledServiceRefund(
  serviceBookingId: number,
  totalPaid: number,
  timeIn: string,
  currentStatus: string,
  isHotelInitiated: boolean = false
): ItemRefundCalculation {
  if (currentStatus === "In Progress" || currentStatus === "Completed") {
    return {
      itemType: "service",
      itemId: serviceBookingId,
      originalAmount: totalPaid,
      refundPercent: 0,
      refundAmount: 0,
      vatAmount: 0,
      explanation: `Item is ${currentStatus}: non-refundable.`,
    };
  }

  if (isHotelInitiated) {
    const refundAmount = Math.round(totalPaid * 100) / 100;
    return {
      itemType: "service",
      itemId: serviceBookingId,
      originalAmount: totalPaid,
      refundPercent: 100,
      refundAmount,
      vatAmount: extractVatPortion(refundAmount),
      explanation: "Hotel-initiated cancellation: 100% full refund.",
    };
  }

  const hours = getHoursUntil(timeIn);
  let refundPercent = 0;
  let explanation = "";

  if (hours >= 48) {
    refundPercent = 100;
    explanation = "100% refund (cancelled 48+ hours before slot start).";
  } else if (hours >= 24) {
    refundPercent = 50;
    explanation = "50% refund (cancelled between 24 and 48 hours before slot start).";
  } else {
    refundPercent = 0;
    explanation = "0% refund (cancelled under 24 hours before slot start).";
  }

  const refundAmount = Math.round((totalPaid * (refundPercent / 100)) * 100) / 100;
  return {
    itemType: "service",
    itemId: serviceBookingId,
    originalAmount: totalPaid,
    refundPercent,
    refundAmount,
    vatAmount: extractVatPortion(refundAmount),
    explanation,
  };
}

export function computeOnDemandServiceRefund(
  serviceBookingId: number,
  totalPaid: number,
  currentStatus: string,
  isHotelInitiated: boolean = false
): ItemRefundCalculation {
  if (currentStatus === "In Progress" || currentStatus === "Completed") {
    return {
      itemType: "service",
      itemId: serviceBookingId,
      originalAmount: totalPaid,
      refundPercent: 0,
      refundAmount: 0,
      vatAmount: 0,
      explanation: `On-demand service is ${currentStatus}: non-refundable.`,
    };
  }

  if (isHotelInitiated || currentStatus === "Pending") {
    const refundAmount = Math.round(totalPaid * 100) / 100;
    return {
      itemType: "service",
      itemId: serviceBookingId,
      originalAmount: totalPaid,
      refundPercent: 100,
      refundAmount,
      vatAmount: extractVatPortion(refundAmount),
      explanation: "100% refund (cancelled before service started).",
    };
  }

  return {
    itemType: "service",
    itemId: serviceBookingId,
    originalAmount: totalPaid,
    refundPercent: 0,
    refundAmount: 0,
    vatAmount: 0,
    explanation: "Non-refundable.",
  };
}

export function computeTripRefund(
  tripBookingId: number,
  totalPaid: number,
  departureTime: string,
  currentStatus: string,
  isHotelInitiated: boolean = false
): ItemRefundCalculation {
  if (currentStatus === "In Progress" || currentStatus === "Completed") {
    return {
      itemType: "trip",
      itemId: tripBookingId,
      originalAmount: totalPaid,
      refundPercent: 0,
      refundAmount: 0,
      vatAmount: 0,
      explanation: `Excursion trip is ${currentStatus}: non-refundable.`,
    };
  }

  if (isHotelInitiated) {
    const refundAmount = Math.round(totalPaid * 100) / 100;
    return {
      itemType: "trip",
      itemId: tripBookingId,
      originalAmount: totalPaid,
      refundPercent: 100,
      refundAmount,
      vatAmount: extractVatPortion(refundAmount),
      explanation: "Hotel-initiated excursion cancellation: 100% full refund.",
    };
  }

  const hours = getHoursUntil(departureTime);
  let refundPercent = 0;
  let explanation = "";

  if (hours >= 48) {
    refundPercent = 100;
    explanation = "100% refund (cancelled 48+ hours before departure).";
  } else if (hours >= 24) {
    refundPercent = 50;
    explanation = "50% refund (cancelled between 24 and 48 hours before departure).";
  } else {
    refundPercent = 0;
    explanation = "0% refund (cancelled under 24 hours before departure).";
  }

  const refundAmount = Math.round((totalPaid * (refundPercent / 100)) * 100) / 100;
  return {
    itemType: "trip",
    itemId: tripBookingId,
    originalAmount: totalPaid,
    refundPercent,
    refundAmount,
    vatAmount: extractVatPortion(refundAmount),
    explanation,
  };
}

export interface BookingCancellationPreview {
  totalPaid: number;
  totalRefundAmount: number;
  totalVatRefund: number;
  items: ItemRefundCalculation[];
}

export function computeBookingCancellationPreview({
  roomAmountPaid,
  checkInDate,
  serviceBookings = [],
  tripBookings = [],
  isHotelInitiated = false,
}: {
  roomAmountPaid: number;
  checkInDate: string;
  serviceBookings?: Array<{
    sb_id: number;
    total_amount: number;
    time_in?: string;
    service_type?: "scheduled" | "on_demand";
    sb_status: string;
  }>;
  tripBookings?: Array<{
    trip_trip_id: number;
    total_amount: number;
    start_time?: string;
    tb_status?: string;
  }>;
  isHotelInitiated?: boolean;
}): BookingCancellationPreview {
  const items: ItemRefundCalculation[] = [];

  // 1. Room calculation
  items.push(computeRoomRefund(roomAmountPaid, checkInDate, isHotelInitiated));

  // 2. Service bookings calculation
  for (const sb of serviceBookings) {
    if (sb.sb_status === "Cancelled") continue;
    if (sb.service_type === "on_demand" || !sb.time_in) {
      items.push(computeOnDemandServiceRefund(sb.sb_id, sb.total_amount, sb.sb_status, isHotelInitiated));
    } else {
      items.push(computeScheduledServiceRefund(sb.sb_id, sb.total_amount, sb.time_in, sb.sb_status, isHotelInitiated));
    }
  }

  // 3. Trip bookings calculation
  for (const tb of tripBookings) {
    if (tb.tb_status === "Cancelled") continue;
    items.push(computeTripRefund(tb.trip_trip_id, tb.total_amount, tb.start_time || "", tb.tb_status || "Pending", isHotelInitiated));
  }

  const totalPaid = items.reduce((acc, it) => acc + it.originalAmount, 0);
  const totalRefundAmount = items.reduce((acc, it) => acc + it.refundAmount, 0);
  const totalVatRefund = items.reduce((acc, it) => acc + it.vatAmount, 0);

  return {
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalRefundAmount: Math.round(totalRefundAmount * 100) / 100,
    totalVatRefund: Math.round(totalVatRefund * 100) / 100,
    items,
  };
}
