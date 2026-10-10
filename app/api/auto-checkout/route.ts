// app/api/auto-checkout/route.ts
import { NextResponse } from "next/server";
import { runAutoCheckout } from "@/lib/autoCheckout";

export async function GET() {
  try {
    const result = await runAutoCheckout();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Auto-checkout execution failed." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await runAutoCheckout();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Auto-checkout execution failed." },
      { status: 500 }
    );
  }
}
