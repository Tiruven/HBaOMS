// app/api/verify-payment/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_for_build";
const stripe = new Stripe(stripeSecretKey);

// Server-side Supabase client using service role key (bypasses RLS)
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

    // 2. Idempotency check — skip if already processed
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

    const meta = session.metadata || {};
    const guestEmail = meta.guestEmail || "";
    const guestFname = (meta.guestFname || "Guest").substring(0, 20);
    const guestLname = (meta.guestLname || "Customer").substring(0, 20);
    const roomId = meta.roomId ? Number(meta.roomId) : null;
    const checkInDate = meta.checkInDate || null;
    const checkOutDate = meta.checkOutDate || null;
    const boardType = meta.boardType || "RO";
    const amountPaid = (session.amount_total || 0) / 100;
    const today = new Date().toISOString().split("T")[0];

    // 3. Get or create customer record
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

    // 4. Insert confirmed booking with duplicate key race condition protection
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
          created_by: guestEmail.substring(0, 30),
          date_created: new Date().toISOString(),
        },
      ])
      .select("booking_id")
      .single();

    if (bErr) {
      // Race condition handling if duplicate key occurs
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

    // 5. Insert check_in_out stay record
    if (roomId && checkInDate && checkOutDate) {
      const formattedIn = checkInDate.includes("T") ? checkInDate : `${checkInDate}T14:00:00.000Z`;
      const formattedOut = checkOutDate.includes("T") ? checkOutDate : `${checkOutDate}T11:00:00.000Z`;

      const { error: cioErr } = await supabase.from("check_in_out").insert([
        {
          booking_booking_id: bookingId,
          room_room_id: roomId,
          check_in_date: formattedIn,
          check_out_date: formattedOut,
        },
      ]);
      if (cioErr) {
        console.error("check_in_out insert error:", cioErr.message);
      }
    }

    // 5b. Insert service bookings
    const selectedServices = meta.services ? JSON.parse(meta.services) : [];
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
            created_by: "Stripe Verify",
            date_created: new Date().toISOString(),
          },
        ]);
      }
    }

    // 5c. Insert trip bookings
    const selectedTours = meta.tours ? JSON.parse(meta.tours) : [];
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
              created_by: "Stripe Sync",
            })
            .select("trip_id")
            .single();

          if (tErr || !newTrip) {
            console.error("Trip creation error for tour:", tourId, tErr);
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

    // 6. Insert payment record
    const { error: payErr } = await supabase.from("payment").insert([
      {
        booking_booking_id: bookingId,
        payment_date: today,
        payment_type: "Stripe",
        payment_method: "ON",
        payment_amount: amountPaid,
        created_by: guestEmail.substring(0, 30),
        date_created: new Date().toISOString(),
      },
    ]);
    if (payErr) console.error("payment insert error:", payErr.message);

    // 7. Insert notification
    const { error: notifErr } = await supabase.from("notification").insert([
      {
        customer_cust_id: custId,
        booking_booking_id: bookingId,
        notif_type: "Booking Confirmation",
        notif_status: "Pending",
        sent_date: new Date().toISOString(),
        created_by: "Stripe Verify",
        date_created: new Date().toISOString(),
      },
    ]);
    if (notifErr) console.error("notification insert error:", notifErr.message);

    console.log(`[INFO] Booking #${bookingId} created via Stripe session ${sessionId}`);
    return NextResponse.json({ success: true, bookingId, custId });
  } catch (error: any) {
    console.error("verify-payment error:", error);
    return NextResponse.json(
      { error: error.message || "Payment verification failed" },
      { status: 500 }
    );
  }
}
