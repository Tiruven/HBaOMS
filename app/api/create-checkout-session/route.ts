// app/api/create-checkout-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

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
        return NextResponse.json({
          sessionId: `cs_test_mock_addon_${Date.now()}`,
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
