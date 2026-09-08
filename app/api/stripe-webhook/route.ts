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
      // 0. Idempotency check — skip if already processed
      const { data: existingBooking } = await supabase
        .from("booking")
        .select("booking_id")
        .eq("stripe_session_id", session.id)
        .maybeSingle();

      if (existingBooking) {
        console.log(`Booking for session ${session.id} already exists (ID: ${existingBooking.booking_id}), skipping webhook.`);
        return NextResponse.json({ received: true });
      }

      // 1. Get or create customer record
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
            stripe_session_id: session.id,
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
        const { error: cioErr } = await supabase.from("check_in_out").insert([
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
        if (cioErr) {
          console.warn("Webhook check_in_out insert error, trying fallback with core columns:", cioErr.message);
          const { error: fallbackErr } = await supabase.from("check_in_out").insert([
            {
              booking_booking_id: bookingId,
              room_room_id: Number(roomId),
              check_in_date: checkInDate,
              check_out_date: checkOutDate,
            },
          ]);
          if (fallbackErr) {
            console.error("Webhook check_in_out fallback error:", fallbackErr.message);
          }
        }
      }

      // 3b. Insert service bookings
      const selectedServices = services ? JSON.parse(services) : [];
      if (selectedServices && Array.isArray(selectedServices) && selectedServices.length > 0) {
        for (const srvId of selectedServices) {
          const { data: srv } = await supabase
            .from("service")
            .select("price")
            .eq("service_id", Number(srvId))
            .maybeSingle();

          const srvPrice = srv?.price || 0;
          await supabase.from("service_booking").insert([
            {
              booking_booking_id: bookingId,
              service_service_id: Number(srvId),
              service_date: checkInDate || today,
              time_in: `${checkInDate || today}T10:00:00.000Z`,
              time_out: `${checkInDate || today}T11:00:00.000Z`,
              num_person: 1,
              total_amount: srvPrice,
              sb_status: "Confirmed",
              created_by: "Stripe Webhook",
              date_created: new Date().toISOString(),
            },
          ]);
        }
      }

      // 3c. Insert trip bookings
      const selectedTours = tours ? JSON.parse(tours) : [];
      if (selectedTours && Array.isArray(selectedTours) && selectedTours.length > 0) {
        for (const tourId of selectedTours) {
          const { data: tourData } = await supabase
            .from("tour")
            .select("adult_price")
            .eq("tour_id", Number(tourId))
            .maybeSingle();

          const adultPrice = tourData?.adult_price || 0;

          const { data: existingTrip } = await supabase
            .from("trip")
            .select("trip_id")
            .eq("tour_tour_id", Number(tourId))
            .eq("trip_status", "Scheduled")
            .limit(1)
            .maybeSingle();

          let tripId: number;
          if (existingTrip) {
            tripId = existingTrip.trip_id;
          } else {
            const { data: newTrip, error: tErr } = await supabase
              .from("trip")
              .insert({
                tour_tour_id: Number(tourId),
                trip_date: `${checkInDate || today}T09:00:00.000Z`,
                start_time: `${checkInDate || today}T09:00:00.000Z`,
                return_time: `${checkInDate || today}T17:00:00.000Z`,
                trip_status: "Scheduled",
                created_by: "Stripe Webhook",
              })
              .select("trip_id")
              .single();

            if (tErr || !newTrip) {
              console.error("Failed to create webhook trip for tour:", tourId, tErr);
              continue;
            }
            tripId = newTrip.trip_id;
          }

          await supabase.from("trip_booking").insert({
            trip_trip_id: tripId,
            booking_booking_id: bookingId,
            num_adult: 1,
            num_child: 0,
            total_amount: adultPrice,
          });
        }
      }

      // 4. Record Payment
      await supabase.from("payment").insert([
        {
          booking_booking_id: bookingId,
          payment_date: today,
          payment_type: "Stripe",
          payment_method: "ON",
          payment_amount: amountPaid,
          amount_paid: amountPaid,
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
