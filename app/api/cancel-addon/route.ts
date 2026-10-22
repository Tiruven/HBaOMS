// app/api/cancel-addon/route.ts
// Cancellation and graduated refunds for individual add-on items (v5.1).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  computeScheduledServiceRefund,
  computeOnDemandServiceRefund,
  computeTripRefund,
  ItemRefundCalculation,
} from "@/lib/pricing";
import { executeStripeAndDbRefund } from "@/lib/refundHelper";
import { nowInstant } from "@/lib/time";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder_key";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      bookingId,
      itemType, // "service" | "trip"
      itemId,   // sb_id or trip_trip_id
      reason,
      userEmail,
      isHotelInitiated = false,
      previewOnly = false,
    } = body;

    if (!bookingId || !itemType || itemId === undefined) {
      return NextResponse.json({ error: "Missing required parameters (bookingId, itemType, itemId)" }, { status: 400 });
    }

    const bId = Number(bookingId);
    const now = nowInstant();

    if (itemType === "service") {
      const { data: sb, error: sbErr } = await supabase
        .from("service_booking")
        .select("*, service(*), booking(*, customer(*)), payment(*)")
        .eq("sb_id", Number(itemId))
        .eq("booking_booking_id", bId)
        .single();

      if (sbErr || !sb) {
        return NextResponse.json({ error: "Service booking not found" }, { status: 404 });
      }

      if (sb.sb_status === "Cancelled") {
        return NextResponse.json({ error: "Service booking is already cancelled" }, { status: 400 });
      }

      const isScheduled = sb.service?.service_type === "scheduled";
      const totalPaid = Number(sb.total_amount) || 0;
      const refundCalc: ItemRefundCalculation = isScheduled
        ? computeScheduledServiceRefund(sb.sb_id, totalPaid, sb.time_in, sb.sb_status, isHotelInitiated)
        : computeOnDemandServiceRefund(sb.sb_id, totalPaid, sb.sb_status, isHotelInitiated);

      if (previewOnly) {
        return NextResponse.json({
          preview: true,
          name: sb.service?.service_name || "Hotel Service",
          ...refundCalc,
        });
      }

      // Execute refund
      const paymentId = sb.payment_id || sb.payment?.payment_id;
      const stripeSessionId = sb.payment?.stripe_session_id || sb.booking?.stripe_session_id;
      const emailToUse = userEmail || sb.booking?.customer?.email || "customer@hbaoms.com";

      if (refundCalc.refundAmount > 0 && paymentId) {
        await executeStripeAndDbRefund({
          supabase,
          paymentId,
          bookingId: bId,
          stripeSessionId,
          refundAmountMur: refundCalc.refundAmount,
          reason: `Service cancellation: ${refundCalc.explanation}`,
          userEmail: emailToUse,
          itemType: "service",
          serviceBookingId: sb.sb_id,
          refundPercentage: refundCalc.refundPercent,
          vatAmount: refundCalc.vatAmount,
        });
      }

      // Update service booking status to Cancelled
      await supabase
        .from("service_booking")
        .update({
          sb_status: "Cancelled",
          cancelled_at: now,
          cancellation_reason: reason || (isHotelInitiated ? "Hotel-initiated cancellation" : "Cancelled by guest"),
          updated_by_: emailToUse,
          date_updated: now,
        })
        .eq("sb_id", sb.sb_id);

      return NextResponse.json({
        success: true,
        ...refundCalc,
      });
    }

    if (itemType === "trip") {
      const { data: tb, error: tbErr } = await supabase
        .from("trip_booking")
        .select("*, trip(*, tour(*)), booking(*, customer(*)), payment(*)")
        .eq("trip_trip_id", Number(itemId))
        .eq("booking_booking_id", bId)
        .single();

      if (tbErr || !tb) {
        return NextResponse.json({ error: "Trip reservation not found" }, { status: 404 });
      }

      if (tb.tb_status === "Cancelled") {
        return NextResponse.json({ error: "Trip reservation is already cancelled" }, { status: 400 });
      }

      const totalPaid = Number(tb.total_amount) || 0;
      const departureTime = tb.trip?.start_time || tb.trip?.trip_date;
      const refundCalc: ItemRefundCalculation = computeTripRefund(
        tb.trip_trip_id,
        totalPaid,
        departureTime,
        tb.tb_status || "Pending",
        isHotelInitiated
      );

      if (previewOnly) {
        return NextResponse.json({
          preview: true,
          name: tb.trip?.tour?.tour_name || "Island Excursion",
          ...refundCalc,
        });
      }

      // Execute refund
      const paymentId = tb.payment_id || tb.payment?.payment_id;
      const stripeSessionId = tb.payment?.stripe_session_id || tb.booking?.stripe_session_id;
      const emailToUse = userEmail || tb.booking?.customer?.email || "customer@hbaoms.com";

      if (refundCalc.refundAmount > 0 && paymentId) {
        await executeStripeAndDbRefund({
          supabase,
          paymentId,
          bookingId: bId,
          stripeSessionId,
          refundAmountMur: refundCalc.refundAmount,
          reason: `Excursion cancellation: ${refundCalc.explanation}`,
          userEmail: emailToUse,
          itemType: "trip",
          tripTripId: tb.trip_trip_id,
          refundPercentage: refundCalc.refundPercent,
          vatAmount: refundCalc.vatAmount,
        });
      }

      // Update trip booking status to Cancelled (frees seats in checkTripCapacity immediately)
      await supabase
        .from("trip_booking")
        .update({
          tb_status: "Cancelled",
          cancelled_at: now,
          cancellation_reason: reason || (isHotelInitiated ? "Hotel-initiated cancellation" : "Cancelled by guest"),
          updated_by_: emailToUse,
          date_updated: now,
        })
        .eq("trip_trip_id", tb.trip_trip_id)
        .eq("booking_booking_id", bId);

      return NextResponse.json({
        success: true,
        ...refundCalc,
      });
    }

    return NextResponse.json({ error: "Invalid itemType. Must be 'service' or 'trip'." }, { status: 400 });
  } catch (error: any) {
    console.error("Single add-on cancellation error:", error);
    return NextResponse.json({ error: error.message || "Failed to process add-on cancellation" }, { status: 500 });
  }
}
