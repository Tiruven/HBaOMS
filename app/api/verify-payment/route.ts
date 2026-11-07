// app/api/verify-payment/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { checkServiceSlotCapacity, checkTripCapacity } from "@/lib/capacity";
import { executeStripeAndDbRefund } from "@/lib/refundHelper";
import { nowInstant, mauritiusToday, mauritiusToInstant, startOfMauritiusDay } from "@/lib/time";
import { sendEmail, buildBookingConfirmationHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_for_build";
const stripe = new Stripe(stripeSecretKey);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder_key";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    // 1. Retrieve and verify the Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed", status: session.payment_status },
        { status: 402 }
      );
    }

    const meta = session.metadata || {};
    const amountPaid = (session.amount_total || 0) / 100;
    const today = mauritiusToday();

    // =========================================================================
    // FLOW 2: PORTAL ADD-ON CHECKOUT
    // =========================================================================
    if (meta.type === "addon") {
      const bookingId = Number(meta.bookingId);
      const guestEmail = meta.guestEmail || "guest@hbaoms.com";

      // 2a. Idempotency check on payment table
      const { data: existingPayment } = await supabase
        .from("payment")
        .select("payment_id")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (existingPayment) {
        return NextResponse.json({
          success: true,
          bookingId,
          alreadyProcessed: true,
        });
      }

      const serviceBookings = meta.serviceBookings ? JSON.parse(meta.serviceBookings) : [];
      const tripBookings = meta.tripBookings ? JSON.parse(meta.tripBookings) : [];

      // 2b. Re-check capacity for all items
      let capacityFailed = false;
      let failureReason = "";

      for (const s of serviceBookings) {
        const slotCap = await checkServiceSlotCapacity(
          supabase,
          Number(s.serviceId),
          s.serviceDate,
          s.timeIn,
          s.timeOut
        );
        if (!slotCap.available) {
          capacityFailed = true;
          failureReason = "Service slot is no longer available.";
          break;
        }
      }

      if (!capacityFailed) {
        for (const t of tripBookings) {
          // Check duplicate trip booking on same booking
          const { data: dupTb } = await supabase
            .from("trip_booking")
            .select("trip_trip_id")
            .eq("trip_trip_id", Number(t.tripId))
            .eq("booking_booking_id", bookingId)
            .maybeSingle();

          if (dupTb) {
            capacityFailed = true;
            failureReason = "Excursion already booked on this reservation.";
            break;
          }

          const tripCap = await checkTripCapacity(supabase, Number(t.tripId));
          const reqPassengers = (Number(t.numAdult) || 0) + (Number(t.numChild) || 0);
          if (tripCap.remainingSeats < reqPassengers) {
            capacityFailed = true;
            failureReason = "Excursion seats are no longer available.";
            break;
          }
        }
      }

      // 2c. If capacity failed: automatically refund in full
      if (capacityFailed) {
        // Record temporary payment to anchor refund
        const { data: tempPay } = await supabase
          .from("payment")
          .insert([
            {
              booking_booking_id: bookingId,
              payment_date: today,
              payment_type: "Addon",
              payment_method: "ON",
              payment_amount: amountPaid,
              stripe_session_id: sessionId,
              created_by: guestEmail,
              date_created: new Date().toISOString(),
            },
          ])
          .select("payment_id")
          .single();

        if (tempPay) {
          await executeStripeAndDbRefund({
            supabase,
            paymentId: tempPay.payment_id,
            bookingId,
            stripeSessionId: sessionId,
            refundAmountMur: amountPaid,
            reason: `Automatic full refund: ${failureReason}`,
            userEmail: guestEmail,
          });
        }

        return NextResponse.json({
          success: false,
          capacityExceeded: true,
          message: `${failureReason} Your payment has been automatically refunded in full.`,
        });
      }

      // 2d. Insert payment row
      const { data: newPay, error: pErr } = await supabase
        .from("payment")
        .insert([
          {
            booking_booking_id: bookingId,
            payment_date: today,
            payment_type: "Addon",
            payment_method: "ON",
            payment_amount: amountPaid,
            stripe_session_id: sessionId,
            created_by: guestEmail,
            date_created: new Date().toISOString(),
          },
        ])
        .select("payment_id")
        .single();

      if (pErr || !newPay) {
        if (pErr?.code === "23505") {
          return NextResponse.json({
            success: true,
            bookingId,
            alreadyProcessed: true,
          });
        }
        console.error("Add-on payment insertion error:", pErr);
        return NextResponse.json({ error: "Failed to create payment receipt" }, { status: 500 });
      }

      const paymentId = newPay.payment_id;

      // 2e. Insert service bookings linked to payment_id
      for (const s of serviceBookings) {
        await supabase.from("service_booking").insert([
          {
            booking_booking_id: bookingId,
            service_service_id: Number(s.serviceId),
            service_date: s.serviceDate,
            time_in: s.timeIn,
            time_out: s.timeOut,
            num_person: Number(s.numPerson) || 1,
            total_amount: Number(s.amount) || 0,
            sb_status: "Pending",
            payment_id: paymentId,
            created_by: guestEmail,
            date_created: new Date().toISOString(),
          },
        ]);
      }

      // 2f. Insert trip bookings linked to payment_id
      for (const t of tripBookings) {
        await supabase.from("trip_booking").insert([
          {
            trip_trip_id: Number(t.tripId),
            booking_booking_id: bookingId,
            num_adult: Number(t.numAdult) || 0,
            num_child: Number(t.numChild) || 0,
            total_amount: Number(t.amount) || 0,
            payment_id: paymentId,
          },
        ]);
      }

      return NextResponse.json({
        success: true,
        bookingId,
        paymentId,
      });
    }

    // =========================================================================
    // FLOW 1: NEW ROOM BOOKING (WIZARD)
    // =========================================================================

    // Idempotency check — skip if already processed
    const { data: existingBooking } = await supabase
      .from("booking")
      .select("booking_id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (existingBooking) {
      return NextResponse.json({
        success: true,
        bookingId: existingBooking.booking_id,
        alreadyProcessed: true,
      });
    }

    const guestEmail = meta.guestEmail || "";
    const guestFname = (meta.guestFname || "Guest").substring(0, 100);
    const guestLname = (meta.guestLname || "Customer").substring(0, 100);
    const roomId = meta.roomId ? Number(meta.roomId) : null;
    const checkInDate = meta.checkInDate || null;
    const checkOutDate = meta.checkOutDate || null;
    const boardType = meta.boardType || "RO";
    const numAdults = Number(meta.numAdults) || 1;
    const numChildren = Number(meta.numChildren) || 0;

    // Get or create customer record
    let custId: number;
    const { data: existingCust } = await supabase
      .from("customer")
      .select("cust_id")
      .ilike("email", guestEmail.trim())
      .maybeSingle();

    if (existingCust) {
      custId = existingCust.cust_id;
    } else {
      const { data: newCust, error: cErr } = await supabase
        .from("customer")
        .insert([
          {
            cust_fname: guestFname,
            cust_lname: guestLname,
            email: guestEmail,
            password_hash: "STRIPE_PAYMENT",
            town: "N/A",
            city: "N/A",
            gender: "M",
            contact_info: "N/A",
            nationality: "Mauritian",
            country: "Mauritius",
            created_by: "Stripe",
            date_created: new Date().toISOString(),
          },
        ])
        .select("cust_id")
        .single();

      if (cErr || !newCust) {
        console.error("Customer insert error:", cErr);
        return NextResponse.json({ error: "Failed to create customer record" }, { status: 500 });
      }
      custId = newCust.cust_id;
    }

    // Insert confirmed booking with guest counts
    let bookingId: number;
    const { data: newBooking, error: bErr } = await supabase
      .from("booking")
      .insert([
        {
          customer_cust_id: custId,
          booking_date: today,
          booking_type: boardType,
          booking_status: "Confirmed",
          stripe_session_id: sessionId,
          num_adults: numAdults,
          num_children: numChildren,
          created_by: guestEmail.substring(0, 255),
          date_created: new Date().toISOString(),
        },
      ])
      .select("booking_id")
      .single();

    if (bErr) {
      if (bErr.code === "23505") {
        const { data: duplicateBooking } = await supabase
          .from("booking")
          .select("booking_id")
          .eq("stripe_session_id", sessionId)
          .single();

        if (duplicateBooking) {
          return NextResponse.json({
            success: true,
            bookingId: duplicateBooking.booking_id,
            alreadyProcessed: true,
          });
        }
      }
      console.error("Booking insert error:", bErr);
      return NextResponse.json({ error: "Failed to create booking record" }, { status: 500 });
    }
    bookingId = newBooking.booking_id;

    // Insert payment record
    let paymentId: number | undefined;
    const { data: payRow, error: payErr } = await supabase
      .from("payment")
      .insert([
        {
          booking_booking_id: bookingId,
          payment_date: today,
          payment_type: "Booking",
          payment_method: "ON",
          payment_amount: amountPaid,
          stripe_session_id: sessionId,
          created_by: guestEmail.substring(0, 255),
          date_created: new Date().toISOString(),
        },
      ])
      .select("payment_id")
      .single();

    if (payErr) {
      console.error("payment insert error:", payErr.message);
    } else if (payRow) {
      paymentId = payRow.payment_id;
    }

    // Insert check_in_out stay record
    if (roomId && checkInDate && checkOutDate) {
      const formattedIn = checkInDate.includes("T") ? checkInDate : mauritiusToInstant(checkInDate, "14:00:00");
      const formattedOut = checkOutDate.includes("T") ? checkOutDate : mauritiusToInstant(checkOutDate, "11:00:00");

      await supabase.from("check_in_out").insert([
        {
          booking_booking_id: bookingId,
          room_room_id: roomId,
          check_in_date: formattedIn,
          check_out_date: formattedOut,
        },
      ]);
    }

    // Note: Per v5.1, Flow 1 wizard handles room, board plan, and packages only.
    // All services and tours/trips are booked post-confirmation in the client portal.

    // Insert notification (with deduplication guard)
    const { data: notifRow, error: notifErr } = await supabase
      .from("notification")
      .insert([
        {
          customer_cust_id: custId,
          booking_booking_id: bookingId,
          notif_type: "Booking Confirmation",
          notif_status: "Pending",
          sent_date: new Date().toISOString(),
          created_by: "Stripe Verify",
          date_created: new Date().toISOString(),
        },
      ])
      .select("notif_id")
      .maybeSingle();

    // Send confirmation email asynchronously if notification was created by this handler
    if (!notifErr && notifRow && guestEmail) {
      const { subject, html } = buildBookingConfirmationHtml({
        guestName: `${guestFname} ${guestLname}`.trim(),
        bookingId,
        roomTypeName: meta.roomTypeName || "Luxury Accommodation",
        roomId,
        checkInDate: checkInDate || today,
        checkOutDate: checkOutDate || today,
        boardType,
        numAdults,
        numChildren,
        totalAmount: amountPaid,
      });

      const emailRes = await sendEmail({
        to: guestEmail,
        subject,
        html,
      });

      // Update notification record with delivery outcome
      await supabase
        .from("notification")
        .update({
          notif_status: emailRes.success ? "Sent" : "Failed",
          date_updated: new Date().toISOString(),
          updated_by_: emailRes.success ? "Nodemailer" : `Error: ${emailRes.error || "Failed"}`,
        })
        .eq("notif_id", notifRow.notif_id);
    }

    return NextResponse.json({ success: true, bookingId, custId });
  } catch (error: any) {
    console.error("verify-payment error:", error);
    return NextResponse.json(
      { error: error.message || "Payment verification failed" },
      { status: 500 }
    );
  }
}
