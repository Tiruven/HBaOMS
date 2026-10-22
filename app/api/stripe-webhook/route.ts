// app/api/stripe-webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabaseClient";
import { nowInstant, mauritiusToday, mauritiusToInstant, startOfMauritiusDay } from "@/lib/time";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_mock_key_hbaoms";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-04-10" as any,
});

export async function POST(req: Request) {
  const bodyText = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(bodyText, signature, webhookSecret);
    } else {
      event = JSON.parse(bodyText) as Stripe.Event;
    }
  } catch (err: any) {
    console.error("Webhook signature validation failed:", err.message);
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};
    const amountPaid = (session.amount_total || 0) / 100;
    const today = mauritiusToday();

    try {
      // Branch on add-on vs new booking
      if (metadata.type === "addon") {
        const bookingId = Number(metadata.bookingId);
        const guestEmail = metadata.guestEmail || "guest@hbaoms.com";

        // Idempotency check on payment table
        const { data: existingPayment } = await supabase
          .from("payment")
          .select("payment_id")
          .eq("stripe_session_id", session.id)
          .maybeSingle();

        if (existingPayment) {
          console.log(`Add-on payment for session ${session.id} already exists, skipping webhook.`);
          return NextResponse.json({ received: true });
        }

        const { data: newPay, error: pErr } = await supabase
          .from("payment")
          .insert([
            {
              booking_booking_id: bookingId,
              payment_date: today,
              payment_type: "Addon",
              payment_method: "ON",
              payment_amount: amountPaid,
              stripe_session_id: session.id,
              created_by: guestEmail,
              date_created: new Date().toISOString(),
            },
          ])
          .select("payment_id")
          .single();

        if (pErr || !newPay) {
          console.error("Webhook add-on payment error:", pErr);
          return NextResponse.json({ received: true });
        }

        const paymentId = newPay.payment_id;
        const serviceBookings = metadata.serviceBookings ? JSON.parse(metadata.serviceBookings) : [];
        const tripBookings = metadata.tripBookings ? JSON.parse(metadata.tripBookings) : [];

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

        return NextResponse.json({ received: true });
      }

      // Default: Flow 1 (New Room Booking)
      const {
        roomId,
        checkInDate,
        checkOutDate,
        boardType,
        guestEmail,
        guestFname,
        guestLname,
        numAdults,
        numChildren,
        services,
        tours,
      } = metadata;

      // Idempotency check — skip if already processed
      const { data: existingBooking } = await supabase
        .from("booking")
        .select("booking_id")
        .eq("stripe_session_id", session.id)
        .maybeSingle();

      if (existingBooking) {
        console.log(`Booking for session ${session.id} already exists (ID: ${existingBooking.booking_id}), skipping webhook.`);
        return NextResponse.json({ received: true });
      }

      // Get or create customer record
      let custId: number;
      const { data: existingCust } = await supabase
        .from("customer")
        .select("cust_id")
        .eq("email", guestEmail)
        .maybeSingle();

      if (existingCust) {
        custId = existingCust.cust_id;
      } else {
        const { data: newCust, error: cErr } = await supabase
          .from("customer")
          .insert([
            {
              cust_fname: guestFname || "Guest",
              cust_lname: guestLname || "Customer",
              email: guestEmail,
              password_hash: "STRIPE_PAYMENT",
              town: "N/A",
              city: "N/A",
              gender: "M",
              contact_info: "N/A",
              nationality: "Mauritian",
              country: "Mauritius",
              created_by: "Stripe Webhook",
              date_created: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (cErr) throw cErr;
        custId = newCust.cust_id;
      }

      // Insert booking row
      const { data: newBooking, error: bErr } = await supabase
        .from("booking")
        .insert([
          {
            customer_cust_id: custId,
            booking_date: today,
            booking_type: boardType || "RO",
            booking_status: "Confirmed",
            stripe_session_id: session.id,
            num_adults: Number(numAdults) || 1,
            num_children: Number(numChildren) || 0,
            created_by: guestEmail || "Stripe Webhook",
            date_created: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (bErr) throw bErr;
      const bookingId = newBooking.booking_id;

      // Insert stay row in check_in_out
      if (roomId && checkInDate && checkOutDate) {
        await supabase.from("check_in_out").insert([
          {
            booking_booking_id: bookingId,
            room_room_id: Number(roomId),
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            status: "Scheduled",
            created_by: guestEmail || "Stripe Webhook",
            date_created: new Date().toISOString(),
          },
        ]);
      }

      // Insert payment row
      const { data: payRow } = await supabase
        .from("payment")
        .insert([
          {
            booking_booking_id: bookingId,
            payment_date: today,
            payment_type: "Booking",
            payment_method: "ON",
            payment_amount: amountPaid,
            stripe_session_id: session.id,
            created_by: guestEmail || "Stripe Webhook",
            date_created: new Date().toISOString(),
          },
        ])
        .select("payment_id")
        .single();

      const paymentId = payRow?.payment_id;

      // Note: Per v5.1, Flow 1 wizard handles room, board plan, and packages only.
      // All services and tours/trips are booked post-confirmation in the client portal.

      console.log(`Webhook successfully processed session: ${session.id} for booking: ${bookingId}`);
      return NextResponse.json({ received: true });
    } catch (err: any) {
      console.error("Error processing webhook event:", err);
      return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
