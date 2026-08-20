// app/api/stripe-webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabaseClient";

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

    const {
      roomId,
      checkInDate,
      checkOutDate,
      boardType,
      guestEmail,
      guestFname,
      guestLname,
      services,
      tours,
    } = metadata;

    try {
      // 1. Get or create customer record
      let custId: number;
      const { data: existingCust } = await supabase
        .from("customer")
        .select("cust_id")
        .eq("email", guestEmail)
        .single();

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
              nationality: "Mauritian",
              country: "Mauritius",
            },
          ])
          .select()
          .single();

        if (cErr) throw cErr;
        custId = newCust.cust_id;
      }

      // 2. Insert booking row
      const amountPaid = (session.amount_total || 0) / 100;
      const today = new Date().toISOString().split("T")[0];

      const { data: newBooking, error: bErr } = await supabase
        .from("booking")
        .insert([
          {
            customer_cust_id: custId,
            booking_date: today,
            booking_type: boardType || "RO",
            booking_status: "Confirmed",
            created_by: guestEmail || "Stripe Webhook",
            date_created: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (bErr) throw bErr;
      const bookingId = newBooking.booking_id;

      // 3. Insert stay row in check_in_out
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

      // 4. Record Payment
      await supabase.from("payment").insert([
        {
          booking_booking_id: bookingId,
          amount_paid: amountPaid,
          payment_date: today,
          payment_method: "Stripe Online",
          created_by: guestEmail || "Stripe Webhook",
          date_created: new Date().toISOString(),
        },
      ]);

      // 5. System Notification Record
      await supabase.from("notification").insert([
        {
          customer_cust_id: custId,
          booking_booking_id: bookingId,
          notif_type: "Booking Confirmation",
          notif_status: "Pending",
          sent_date: new Date().toISOString(),
          created_by: "Stripe Webhook",
          date_created: new Date().toISOString(),
        },
      ]);

      console.log(`Successfully created booking #${bookingId} via Stripe Webhook for ${guestEmail}`);
    } catch (err) {
      console.error("Error processing checkout.session.completed webhook:", err);
    }
  }

  return NextResponse.json({ received: true });
}
