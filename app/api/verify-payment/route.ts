// app/api/verify-payment/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-04-10" as any,
});

// Server-side Supabase client using service role key (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
        console.error("Customer insert failed:", cErr);
        return NextResponse.json({ error: "Failed to create customer record" }, { status: 500 });
      }
      custId = newCust.cust_id;
    }

    // 4. Insert confirmed booking
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

    if (bErr || !newBooking) {
      console.error("Booking insert failed:", bErr);
      return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
    }
    const bookingId = newBooking.booking_id;

    // 5. Insert check_in_out stay record
    if (roomId && checkInDate && checkOutDate) {
      const { error: cioErr } = await supabase.from("check_in_out").insert([
        {
          booking_booking_id: bookingId,
          room_room_id: roomId,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          created_by: guestEmail.substring(0, 30),
          date_created: new Date().toISOString(),
        },
      ]);
      if (cioErr) console.error("check_in_out insert error:", cioErr.message);
    }

    // 6. Insert payment record
    const { error: payErr } = await supabase.from("payment").insert([
      {
        booking_booking_id: bookingId,
        payment_date: today,
        payment_type: "Stripe",
        payment_method: "ON",           // VARCHAR(2) constraint in original schema
        payment_amount: amountPaid,
        amount_paid: amountPaid,
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

    console.log(`✅ Booking #${bookingId} created via Stripe session ${sessionId}`);
    return NextResponse.json({ success: true, bookingId, custId });
  } catch (error: any) {
    console.error("verify-payment fatal error:", error);
    return NextResponse.json(
      { error: error.message || "Payment verification failed" },
      { status: 500 }
    );
  }
}
