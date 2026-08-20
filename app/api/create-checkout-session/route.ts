// app/api/create-checkout-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_mock_key_hbaoms";
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-04-10" as any,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roomId, roomTypeName, totalAmount, checkInDate, checkOutDate, boardType, guestInfo, services, tours } = body;

    const origin = req.headers.get("origin") || "http://localhost:3000";

    // If no real Stripe key configured, return fallback success response
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("mock")) {
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
              description: `Check-in: ${checkInDate} | Check-out: ${checkOutDate} | Plan: ${boardType}`,
            },
            unit_amount: Math.round((totalAmount || 5000) * 100), // Stripe expects amount in cents/sub-units
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/customer/bookings?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/customer/booking/new?canceled=true`,
      metadata: {
        roomId: String(roomId || ""),
        checkInDate: String(checkInDate || ""),
        checkOutDate: String(checkOutDate || ""),
        boardType: String(boardType || "RO"),
        guestEmail: String(guestInfo?.email || ""),
        guestFname: String(guestInfo?.fname || ""),
        guestLname: String(guestInfo?.lname || ""),
        services: JSON.stringify(services || []),
        tours: JSON.stringify(tours || []),
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error("Error creating Stripe checkout session:", error);
    return NextResponse.json({ error: error.message || "Failed to create checkout session" }, { status: 500 });
  }
}
