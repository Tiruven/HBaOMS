// lib/capacity.ts
// Shared service slot and excursion trip seat capacity validation.

import { SupabaseClient } from "@supabase/supabase-js";
import { parseToInstant } from "@/lib/time";

export interface SlotCapacityResult {
  available: boolean;
  bookedCount: number;
  capacity: number;
  remaining: number;
}

export async function checkServiceSlotCapacity(
  supabase: SupabaseClient,
  serviceId: number,
  serviceDate: string,
  timeIn: string,
  timeOut: string
): Promise<SlotCapacityResult> {
  const { data: srv } = await supabase
    .from("service")
    .select("capacity, service_type")
    .eq("service_id", serviceId)
    .single();

  const capacity = srv?.capacity || 5;

  if (srv?.service_type === "on_demand") {
    return { available: true, bookedCount: 0, capacity, remaining: capacity };
  }

  // Find non-cancelled overlapping service bookings
  const { data: bookings } = await supabase
    .from("service_booking")
    .select("sb_id, time_in, time_out, sb_status")
    .eq("service_service_id", serviceId)
    .eq("service_date", serviceDate)
    .neq("sb_status", "Cancelled");

  const targetInMs = parseToInstant(timeIn).getTime();
  const targetOutMs = parseToInstant(timeOut).getTime();

  const overlapping = (bookings || []).filter((b) => {
    const bInMs = parseToInstant(b.time_in).getTime();
    const bOutMs = parseToInstant(b.time_out).getTime();
    return bInMs < targetOutMs && bOutMs > targetInMs;
  });

  const bookedCount = overlapping.length;
  const remaining = Math.max(0, capacity - bookedCount);

  return {
    available: bookedCount < capacity,
    bookedCount,
    capacity,
    remaining,
  };
}

export interface TripCapacityResult {
  available: boolean;
  capacity: number;
  bookedSeats: number;
  remainingSeats: number;
}

export async function checkTripCapacity(
  supabase: SupabaseClient,
  tripId: number
): Promise<TripCapacityResult> {
  const { data: trip } = await supabase
    .from("trip")
    .select("trip_id, capacity")
    .eq("trip_id", tripId)
    .single();

  const capacity = trip?.capacity || 20;

  const { data: bookings } = await supabase
    .from("trip_booking")
    .select("num_adult, num_child, tb_status, booking!inner(booking_status)")
    .eq("trip_trip_id", tripId)
    .neq("booking.booking_status", "Cancelled");

  const bookedSeats = (bookings || [])
    .filter((b: any) => b.tb_status !== "Cancelled")
    .reduce((sum, b) => {
      return sum + (Number(b.num_adult) || 0) + (Number(b.num_child) || 0);
    }, 0);

  const remainingSeats = Math.max(0, capacity - bookedSeats);

  return {
    available: remainingSeats > 0,
    capacity,
    bookedSeats,
    remainingSeats,
  };
}

/**
 * High-performance batch calculator for trip seat availability.
 * Replaces N individual database queries with a single aggregation.
 */
export async function getTripsRemainingSeatsBatch(
  supabase: SupabaseClient,
  tripList: { trip_id: number; capacity?: number }[]
): Promise<Record<number, number>> {
  if (!tripList || tripList.length === 0) return {};

  const tripIds = tripList.map((t) => t.trip_id);

  const { data: bookings } = await supabase
    .from("trip_booking")
    .select("trip_trip_id, num_adult, num_child, tb_status, booking!inner(booking_status)")
    .in("trip_trip_id", tripIds)
    .neq("booking.booking_status", "Cancelled");

  const bookedSeatsMap: Record<number, number> = {};
  (bookings || []).forEach((b: any) => {
    if (b.tb_status !== "Cancelled") {
      const seats = (Number(b.num_adult) || 0) + (Number(b.num_child) || 0);
      bookedSeatsMap[b.trip_trip_id] = (bookedSeatsMap[b.trip_trip_id] || 0) + seats;
    }
  });

  const seatMap: Record<number, number> = {};
  tripList.forEach((t) => {
    const booked = bookedSeatsMap[t.trip_id] || 0;
    const cap = t.capacity || 20;
    seatMap[t.trip_id] = Math.max(0, cap - booked);
  });

  return seatMap;
}
