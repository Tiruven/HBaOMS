// app/api/operations/activities/route.ts
// Activities Supervisor & Admin endpoint:
// - Organizes tour bookings by scheduled trip as passenger manifests
// - Allows updating trip_status and trip_booking tb_status with server audit fields

import { NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/staffAuth";
import { nowInstant } from "@/lib/time";

export const dynamic = "force-dynamic";

const ALLOWED_ACTIVITY_STATUSES = ["Pending", "In Progress", "Completed", "Cancelled"] as const;

export async function GET() {
  try {
    const authCheck = await requireStaffRole(["Admin", "Activities Supervisor"]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase } = authCheck;
    const [tripsRes, tbRes] = await Promise.all([
      supabase
        .from("trip")
        .select("*, tour(*)")
        .order("trip_date", { ascending: false }),
      supabase
        .from("trip_booking")
        .select("*, booking(booking_id, booking_status, customer(cust_fname, cust_lname))"),
    ]);

    if (tripsRes.error) {
      return NextResponse.json({ error: tripsRes.error.message }, { status: 500 });
    }

    const allTripBookings = tbRes.data || [];

    const manifests = (tripsRes.data || []).map((trip: any) => {
      const bookingsForTrip = allTripBookings.filter(
        (tb: any) => tb.trip_trip_id === trip.trip_id
      );
      const activeBookings = bookingsForTrip.filter(
        (tb: any) => tb.tb_status !== "Cancelled"
      );
      const totalAdults = activeBookings.reduce((sum: number, tb: any) => sum + (tb.num_adult || 0), 0);
      const totalChildren = activeBookings.reduce((sum: number, tb: any) => sum + (tb.num_child || 0), 0);

      return {
        ...trip,
        bookings: bookingsForTrip,
        totalAdults,
        totalChildren,
        totalPassengers: totalAdults + totalChildren,
      };
    });

    return NextResponse.json({
      manifests,
      tripBookings: allTripBookings,
    });
  } catch (err: any) {
    console.error("GET /api/operations/activities error:", err);
    return NextResponse.json({ error: err.message || "Failed to load activity manifests" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authCheck = await requireStaffRole(["Admin", "Activities Supervisor"]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase, staff } = authCheck;
    const body = await req.json();
    const targetType = body.targetType as "trip" | "booking";
    const status = body.status as string;

    if (!ALLOWED_ACTIVITY_STATUSES.includes(status as any)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed values: ${ALLOWED_ACTIVITY_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const now = nowInstant();

    if (targetType === "trip") {
      const tripId = Number(body.tripId);
      if (!tripId || Number.isNaN(tripId)) {
        return NextResponse.json({ error: "Missing valid tripId." }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("trip")
        .update({
          trip_status: status,
          updated_by_: staff.email,
          date_updated: now,
        })
        .eq("trip_id", tripId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, trip: data });
    }

    if (targetType === "booking") {
      const tbId = body.tbId ? Number(body.tbId) : null;
      const tripId = body.tripId ? Number(body.tripId) : null;
      const bookingId = body.bookingId ? Number(body.bookingId) : null;

      const updatePayload: Record<string, any> = {
        tb_status: status,
        date_updated: now,
      };

      if (status === "Cancelled") {
        updatePayload.cancelled_at = now;
        updatePayload.cancellation_reason = body.reason || "Cancelled by Activities Supervisor";
      }

      let query = supabase.from("trip_booking").update(updatePayload);
      if (tbId && !Number.isNaN(tbId)) {
        query = query.eq("tb_id", tbId);
      } else if (tripId && bookingId) {
        query = query.eq("trip_trip_id", tripId).eq("booking_booking_id", bookingId);
      } else {
        return NextResponse.json({ error: "Missing tbId or (tripId + bookingId)." }, { status: 400 });
      }

      const { data, error } = await query.select().single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, tripBooking: data });
    }

    return NextResponse.json({ error: "Invalid targetType. Use 'trip' or 'booking'." }, { status: 400 });
  } catch (err: any) {
    console.error("PATCH /api/operations/activities error:", err);
    return NextResponse.json({ error: err.message || "Failed to update activity status" }, { status: 500 });
  }
}

