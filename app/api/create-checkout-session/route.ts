// app/api/create-checkout-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabaseClient";
import { nowInstant, mauritiusToday } from "@/lib/time";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_mock_key_hbaoms";
const stripe = new Stripe(stripeSecretKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const origin = req.headers.get("origin") || "http://localhost:3000";

    const {
      checkoutType = "booking",
      // Flow 1: New Room Booking
      roomId,
      roomTypeName,
      totalAmount,
      checkInDate,
      checkOutDate,
      boardType,
      guestInfo,
      services,
      tours,
      pricingRule,
      numAdults,
      numChildren,
      // Flow 2: Portal Add-ons
      bookingId,
      guestEmail,
      serviceBookings,
      tripBookings,
      addonDescription,
    } = body;

    // Check mock fallback
    const isMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("mock");

    if (checkoutType === "addon") {
      // Flow 2: Portal Add-on Checkout
      if (!bookingId) {
        return NextResponse.json({ error: "Missing bookingId for add-on checkout" }, { status: 400 });
      }

      if (isMock) {
        // In mock mode, persist add-on records directly since there is
        // no Stripe webhook or verify-payment call to create them.
        const mockSessionId = `cs_test_mock_addon_${Date.now()}`;
        const today = mauritiusToday();
        const emailForAudit = guestEmail || "guest@hbaoms.com";

        try {
          // Insert a payment row for the add-on bundle
          const { data: mockPay, error: mockPayErr } = await supabase
            .from("payment")
            .insert([
              {
                booking_booking_id: Number(bookingId),
                payment_date: today,
                payment_type: "Addon",
                payment_method: "ON",
                payment_amount: Number(totalAmount || 0),
                stripe_session_id: mockSessionId,
                created_by: emailForAudit,
                date_created: new Date().toISOString(),
              },
            ])
            .select("payment_id")
            .single();

          const paymentId = mockPay?.payment_id;

          if (mockPayErr) {
            console.error("Mock addon payment insert error:", mockPayErr);
          }

          // Insert service bookings
          for (const s of (serviceBookings || [])) {
            await supabase.from("service_booking").insert([
              {
                booking_booking_id: Number(bookingId),
                service_service_id: Number(s.serviceId),
                service_date: s.serviceDate,
                time_in: s.timeIn,
                time_out: s.timeOut,
                num_person: Number(s.numPerson) || 1,
                total_amount: Number(s.amount) || 0,
                sb_status: "Pending",
                payment_id: paymentId || null,
                created_by: emailForAudit,
                date_created: new Date().toISOString(),
              },
            ]);
          }

          // Insert trip bookings
          for (const t of (tripBookings || [])) {
            await supabase.from("trip_booking").insert([
              {
                trip_trip_id: Number(t.tripId),
                booking_booking_id: Number(bookingId),
                num_adult: Number(t.numAdult) || 0,
                num_child: Number(t.numChild) || 0,
                total_amount: Number(t.amount) || 0,
                payment_id: paymentId || null,
              },
            ]);
          }
        } catch (mockErr) {
          console.error("Mock addon DB insertion error:", mockErr);
        }

        return NextResponse.json({
          sessionId: mockSessionId,
          url: `${origin}/customer/bookings/${bookingId}?addon_success=true`,
        });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "mur",
              product_data: {
                name: `Resort Add-ons (Booking #${bookingId})`,
                description: addonDescription || "Selected hotel services and excursions (incl. 15% VAT)",
              },
              unit_amount: Math.round(Number(totalAmount || 100) * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/customer/bookings/${bookingId}?addon_success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/customer/bookings/${bookingId}?canceled=true`,
        metadata: {
          type: "addon",
          bookingId: String(bookingId),
          guestEmail: String(guestEmail || ""),
          serviceBookings: JSON.stringify(serviceBookings || []),
          tripBookings: JSON.stringify(tripBookings || []),
        },
      });

      return NextResponse.json({ sessionId: session.id, url: session.url });
    }

    // Flow 1: New Room Booking (Wizard)
    if (isMock) {
      return NextResponse.json({
        sessionId: "cs_test_mock_session_12345",
        url: `${origin}/customer/bookings?success=true`,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "mur",
            product_data: {
              name: `Resort Stay - ${roomTypeName || "Luxury Suite"} (Room #${roomId})`,
              description: `Check-in: ${checkInDate} | Check-out: ${checkOutDate} | Plan: ${boardType}${
                pricingRule ? ` | ${pricingRule.reason || "Special Rate"}` : ""
              }`,
            },
            unit_amount: Math.round((totalAmount || 5000) * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/customer/bookings?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/customer/booking/new?canceled=true`,
      metadata: {
        type: "booking",
        roomId: String(roomId || ""),
        checkInDate: String(checkInDate || ""),
        checkOutDate: String(checkOutDate || ""),
        boardType: String(boardType || "RO"),
        guestEmail: String(guestInfo?.email || ""),
        guestFname: String(guestInfo?.fname || ""),
        guestLname: String(guestInfo?.lname || ""),
        numAdults: String(numAdults || 1),
        numChildren: String(numChildren || 0),
        packageName: String(body.selectedPackage || ""),
        pricingRule: JSON.stringify(pricingRule || null),
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error("Error creating Stripe checkout session:", error);
    return NextResponse.json({ error: error.message || "Failed to create checkout session" }, { status: 500 });
  }
}
