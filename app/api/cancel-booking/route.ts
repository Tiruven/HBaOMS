// app/api/cancel-booking/route.ts
// Cancellation and graduated refunds per item for HBaOMS (v5.1).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  computeRoomRefund,
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
      reason,
      userEmail,
      isHotelInitiated = false,
      previewOnly = false,
    } = body;

    if (!bookingId) {
      return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
    }

    const idNum = Number(bookingId);

    // 1. Fetch booking
    const { data: booking, error: bErr } = await supabase
      .from("booking")
      .select("*, customer(*)")
      .eq("booking_id", idNum)
      .single();

    if (bErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.booking_status === "Cancelled") {
      return NextResponse.json({ error: "Booking is already cancelled" }, { status: 400 });
    }

    // 2. Fetch stay and check-in date
    const { data: stay } = await supabase
      .from("check_in_out")
      .select("*")
      .eq("booking_booking_id", idNum)
      .maybeSingle();

    const checkInDate = stay?.check_in_date || booking.booking_date;

    // 3. Fetch all payments linked to this booking
    const { data: payments } = await supabase
      .from("payment")
      .select("*")
      .eq("booking_booking_id", idNum);

    // 4. Fetch non-cancelled services
    const { data: serviceBookings } = await supabase
      .from("service_booking")
      .select("*, service(*)")
      .eq("booking_booking_id", idNum)
      .neq("sb_status", "Cancelled");

    // 5. Fetch non-cancelled trip bookings
    const { data: tripBookings } = await supabase
      .from("trip_booking")
      .select("*, trip(*, tour(*))")
      .eq("booking_booking_id", idNum);

    const activeTripBookings = (tripBookings || []).filter(
      (tb) => tb.tb_status !== "Cancelled"
    );

    // Primary room payment is typically the initial booking payment
    const allPayments = payments || [];
    const mainPayment = allPayments[0];
    const roomPaid = mainPayment?.payment_amount || 0;

    // Build item-by-item graduated refund ladder preview
    const items: (ItemRefundCalculation & { name: string; paymentId?: number; stripeSessionId?: string | null })[] = [];

    // Room calculation
    const roomCalc = computeRoomRefund(roomPaid, checkInDate, isHotelInitiated);
    items.push({
      ...roomCalc,
      name: `Room Reservation (Booking #${idNum})`,
      paymentId: mainPayment?.payment_id || mainPayment?.pay_id,
      stripeSessionId: mainPayment?.stripe_session_id || booking.stripe_session_id,
    });

    // Services calculation (each measured from its own start time)
    for (const sb of serviceBookings || []) {
      const isScheduled = sb.service?.service_type === "scheduled";
      const sbCalc = isScheduled
        ? computeScheduledServiceRefund(sb.sb_id, Number(sb.total_amount) || 0, sb.time_in, sb.sb_status, isHotelInitiated)
        : computeOnDemandServiceRefund(sb.sb_id, Number(sb.total_amount) || 0, sb.sb_status, isHotelInitiated);

      const linkedPayment = allPayments.find((p) => (p.payment_id || p.pay_id) === sb.payment_id) || mainPayment;
      items.push({
        ...sbCalc,
        name: `Service: ${sb.service?.service_name || "Hotel Service"}`,
        paymentId: linkedPayment?.payment_id || linkedPayment?.pay_id,
        stripeSessionId: linkedPayment?.stripe_session_id || booking.stripe_session_id,
      });
    }

    // Trips calculation (each measured from departure time)
    for (const tb of activeTripBookings) {
      const departureTime = tb.trip?.start_time || checkInDate;
      const tbCalc = computeTripRefund(
        tb.trip_trip_id,
        Number(tb.total_amount) || 0,
        departureTime,
        tb.tb_status || "Pending",
        isHotelInitiated
      );

      const linkedPayment = allPayments.find((p) => (p.payment_id || p.pay_id) === tb.payment_id) || mainPayment;
      items.push({
        ...tbCalc,
        name: `Excursion: ${tb.trip?.tour?.tour_name || "Island Excursion"}`,
        paymentId: linkedPayment?.payment_id || linkedPayment?.pay_id,
        stripeSessionId: linkedPayment?.stripe_session_id || booking.stripe_session_id,
      });
    }

    const totalPaid = Math.round(items.reduce((acc, it) => acc + it.originalAmount, 0) * 100) / 100;
    const totalRefundAmount = Math.round(items.reduce((acc, it) => acc + it.refundAmount, 0) * 100) / 100;
    const totalVatRefund = Math.round(items.reduce((acc, it) => acc + it.vatAmount, 0) * 100) / 100;

    // If preview only: return preview immediately without writing to database or calling Stripe
    if (previewOnly) {
      return NextResponse.json({
        preview: true,
        bookingId: idNum,
        totalPaid,
        totalRefundAmount,
        totalVatRefund,
        items,
      });
    }

    // Execution: Process partial refunds item by item with Stripe and DB
    const now = nowInstant();
    const emailToUse = userEmail || booking.customer?.email || "customer@hbaoms.com";

    for (const item of items) {
      if (item.refundAmount > 0 && item.paymentId) {
        await executeStripeAndDbRefund({
          supabase,
          paymentId: item.paymentId,
          bookingId: idNum,
          stripeSessionId: item.stripeSessionId,
          refundAmountMur: item.refundAmount,
          reason: `${item.name}: ${item.explanation}`,
          userEmail: emailToUse,
          itemType: item.itemType,
          serviceBookingId: item.itemType === "service" ? item.itemId : null,
          tripTripId: item.itemType === "trip" ? item.itemId : null,
          refundPercentage: item.refundPercent,
          vatAmount: item.vatAmount,
        });
      }
    }

    // Update booking status to Cancelled
    const { error: updateErr } = await supabase
      .from("booking")
      .update({
        booking_status: "Cancelled",
        cancellation_reason: reason || (isHotelInitiated ? "Hotel-initiated cancellation" : "Cancelled by guest via client portal"),
        cancelled_at: now,
        updated_by_: emailToUse,
        date_updated: now,
      })
      .eq("booking_id", idNum);

    if (updateErr) {
      console.error("Booking cancellation status update error:", updateErr);
      return NextResponse.json({ error: "Failed to update booking status" }, { status: 500 });
    }

    // Cascade cancel linked service bookings
    if (serviceBookings && serviceBookings.length > 0) {
      await supabase
        .from("service_booking")
        .update({
          sb_status: "Cancelled",
          cancelled_at: now,
          cancellation_reason: reason || "Booking cancellation cascade",
          updated_by_: emailToUse,
          date_updated: now,
        })
        .eq("booking_booking_id", idNum)
        .neq("sb_status", "Cancelled");
    }

    // Cascade cancel linked trip bookings
    if (activeTripBookings.length > 0) {
      await supabase
        .from("trip_booking")
        .update({
          tb_status: "Cancelled",
          cancelled_at: now,
          cancellation_reason: reason || "Booking cancellation cascade",
          updated_by_: emailToUse,
          date_updated: now,
        })
        .eq("booking_booking_id", idNum)
        .neq("tb_status", "Cancelled");
    }

    // Log cancellation notification record
    if (booking.customer_cust_id) {
      await supabase.from("notification").insert([
        {
          customer_cust_id: booking.customer_cust_id,
          booking_booking_id: idNum,
          notif_type: "Cancellation",
          notif_status: "Pending",
          sent_date: now,
          created_by: emailToUse,
          date_created: now,
        },
      ]);
    }

    return NextResponse.json({
      success: true,
      bookingId: idNum,
      totalPaid,
      totalRefundAmount,
      totalVatRefund,
      items,
    });
  } catch (error: any) {
    console.error("Cancellation route error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process cancellation" },
      { status: 500 }
    );
  }
}
