// app/api/admin/cancel-trip/route.ts
// Hotel-initiated excursion trip cancellation with 100% refund to all passengers (Decision B.6).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeTripRefund } from "@/lib/pricing";
import { executeStripeAndDbRefund } from "@/lib/refundHelper";
import { nowInstant } from "@/lib/time";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder_key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tripId, reason, adminEmail = "admin@hbaoms.com" } = body;

    if (!tripId) {
      return NextResponse.json({ error: "Missing tripId" }, { status: 400 });
    }

    const tId = Number(tripId);
    const now = nowInstant();

    // 1. Fetch trip and tour info
    const { data: trip, error: tripErr } = await supabase
      .from("trip")
      .select("*, tour(*)")
      .eq("trip_id", tId)
      .single();

    if (tripErr || !trip) {
      return NextResponse.json({ error: "Trip departure not found" }, { status: 404 });
    }

    // 2. Fetch all non-cancelled seat bookings for this departure
    const { data: bookings, error: bErr } = await supabase
      .from("trip_booking")
      .select("*, booking(*, customer(*)), payment(*)")
      .eq("trip_trip_id", tId);

    if (bErr) {
      return NextResponse.json({ error: "Failed to fetch trip passenger bookings" }, { status: 500 });
    }

    const activeBookings = (bookings || []).filter((b) => b.tb_status !== "Cancelled");
    let totalRefunded = 0;
    let refundedCount = 0;

    for (const tb of activeBookings) {
      const amountPaid = Number(tb.total_amount) || 0;
      const calc = computeTripRefund(
        tb.trip_trip_id,
        amountPaid,
        trip.start_time,
        tb.tb_status || "Pending",
        true // isHotelInitiated = true -> 100% refund
      );

      const paymentId = tb.payment_id || tb.payment?.payment_id;
      const stripeSessionId = tb.payment?.stripe_session_id || tb.booking?.stripe_session_id;

      if (paymentId && calc.refundAmount > 0) {
        await executeStripeAndDbRefund({
          supabase,
          paymentId,
          bookingId: tb.booking_booking_id,
          stripeSessionId,
          refundAmountMur: calc.refundAmount,
          reason: reason || "Hotel-initiated trip cancellation (100% full refund)",
          userEmail: adminEmail,
          itemType: "trip",
          tripTripId: tId,
          refundPercentage: 100,
          vatAmount: calc.vatAmount,
        });

        totalRefunded += calc.refundAmount;
        refundedCount++;
      }

      // Mark trip_booking cancelled
      await supabase
        .from("trip_booking")
        .update({
          tb_status: "Cancelled",
          cancelled_at: now,
          cancellation_reason: reason || "Hotel-initiated cancellation",
          updated_by_: adminEmail,
          date_updated: now,
        })
        .eq("trip_trip_id", tId)
        .eq("booking_booking_id", tb.booking_booking_id);
    }

    // 3. Mark the trip departure itself Cancelled
    await supabase
      .from("trip")
      .update({
        trip_status: "Cancelled",
        updated_by_: adminEmail,
        date_updated: now,
      })
      .eq("trip_id", tId);

    return NextResponse.json({
      success: true,
      tripId: tId,
      refundedCount,
      totalRefunded: Math.round(totalRefunded * 100) / 100,
      message: `Trip cancelled. ${refundedCount} booking(s) refunded 100% (total MUR ${totalRefunded}).`,
    });
  } catch (error: any) {
    console.error("Hotel trip cancellation error:", error);
    return NextResponse.json({ error: error.message || "Failed to cancel trip" }, { status: 500 });
  }
}
