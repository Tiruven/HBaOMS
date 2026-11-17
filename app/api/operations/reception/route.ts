// app/api/operations/reception/route.ts
// Server-side Receptionist & Admin endpoints:
// - Dashboard metrics, room readiness overview, masked guest data for Receptionist
// - Check-in (with readiness warning check), Check-out (starts cleaning timer), No Show

import { NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/staffAuth";
import { fetchAllRoomsReadiness } from "@/lib/roomReadiness";
import { runAutoCheckout } from "@/lib/autoCheckout";
import { instantToMauritiusParts, mauritiusToday, nowInstant } from "@/lib/time";

export const dynamic = "force-dynamic";

function maskPassport(passport?: string | null): string | null {
  if (!passport) return null;
  const trimmed = passport.trim();
  if (trimmed.length <= 3) return "****";
  return `****${trimmed.slice(-3)}`;
}

function sanitizeCustomerForRole(cust: any, role: string) {
  if (!cust) return cust;
  const { password_hash, ...rest } = cust;
  if (role === "Receptionist") {
    return {
      ...rest,
      passport_number: maskPassport(rest.passport_number),
      passport_masked: true,
    };
  }
  return rest;
}

export async function GET(req: Request) {
  try {
    const authCheck = await requireStaffRole(["Admin", "Receptionist"]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase, staff } = authCheck;
    const url = new URL(req.url);
    const bookingIdParam = url.searchParams.get("bookingId");

    // Keep overdue stays synced before computing readiness and stats
    await runAutoCheckout();

    if (bookingIdParam) {
      const idNum = Number(bookingIdParam);
      if (!idNum || Number.isNaN(idNum)) {
        return NextResponse.json({ error: "Invalid bookingId" }, { status: 400 });
      }

      const [bRes, cioRes, pRes, sbRes, tbRes, prRes, rfRes] = await Promise.all([
        supabase.from("booking").select("*, customer(*)").eq("booking_id", idNum).maybeSingle(),
        supabase.from("check_in_out").select("*, room(*, room_type(*))").eq("booking_booking_id", idNum).maybeSingle(),
        supabase.from("payment").select("*").eq("booking_booking_id", idNum),
        supabase.from("service_booking").select("*, service(*)").eq("booking_booking_id", idNum),
        supabase.from("trip_booking").select("*, trip(*, tour(*))").eq("booking_booking_id", idNum),
        supabase.from("pricing_rule").select("*"),
        supabase.from("refund").select("*").eq("booking_booking_id", idNum).order("refund_date", { ascending: false }),
      ]);

      if (!bRes.data) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }

      const sanitizedBooking = {
        ...bRes.data,
        customer: sanitizeCustomerForRole(bRes.data.customer, staff.role),
      };

      return NextResponse.json({
        role: staff.role,
        booking: sanitizedBooking,
        stay: cioRes.data || null,
        payments: pRes.data || [],
        services: sbRes.data || [],
        trips: tbRes.data || [],
        pricingRules: prRes.data || [],
        refunds: rfRes.data || [],
      });
    }

    const todayStr = mauritiusToday();
    const [readinessPayload, bookingsRes, staysRes, customersRes] = await Promise.all([
      fetchAllRoomsReadiness(supabase),
      supabase.from("booking").select("*, customer(*)").order("booking_id", { ascending: false }),
      supabase.from("check_in_out").select("*, room(*, room_type(*)), booking(*, customer(*))"),
      supabase.from("customer").select("*").order("cust_id", { ascending: false }),
    ]);

    const bookings = (bookingsRes.data || []).map((b: any) => ({
      ...b,
      customer: sanitizeCustomerForRole(b.customer, staff.role),
    }));

    const stays = (staysRes.data || []).map((s: any) => ({
      ...s,
      booking: s.booking
        ? {
            ...s.booking,
            customer: sanitizeCustomerForRole(s.booking.customer, staff.role),
          }
        : null,
    }));

    const customers = (customersRes.data || []).map((c: any) =>
      sanitizeCustomerForRole(c, staff.role)
    );

    // Dashboard summary counts
    let todaysArrivals = 0;
    let todaysDepartures = 0;
    let currentGuests = 0;

    for (const s of stays) {
      const bStatus = s.booking?.booking_status;
      if (bStatus === "Cancelled" || bStatus === "No Show") continue;

      const inDate = s.check_in_date ? instantToMauritiusParts(s.check_in_date).dateStr : "";
      const outDate = s.check_out_date ? instantToMauritiusParts(s.check_out_date).dateStr : "";

      if (inDate === todayStr && (!s.status || s.status === "Scheduled")) {
        todaysArrivals++;
      }
      if (outDate === todayStr && (s.status === "Checked In" || s.status === "Checked Out" || s.status === "Auto Checked Out")) {
        todaysDepartures++;
      }
      if (s.status === "Checked In") {
        currentGuests++;
      }
    }

    const availableRooms = readinessPayload.readinessList.filter(
      (r) => r.derivedStatus === "Available"
    ).length;
    const cleaningRooms = readinessPayload.readinessList.filter(
      (r) => r.derivedStatus === "Cleaning"
    ).length;
    const maintenanceRooms = readinessPayload.readinessList.filter(
      (r) => r.derivedStatus === "Maintenance"
    ).length;

    const bookingStatusCounts = {
      Confirmed: bookings.filter((b: any) => b.booking_status === "Confirmed").length,
      "Checked In": bookings.filter((b: any) => b.booking_status === "Checked In").length,
      "Checked Out": bookings.filter((b: any) => b.booking_status === "Checked Out").length,
      Cancelled: bookings.filter((b: any) => b.booking_status === "Cancelled").length,
      "No Show": bookings.filter((b: any) => b.booking_status === "No Show").length,
    };

    return NextResponse.json({
      role: staff.role,
      metrics: {
        todaysArrivals,
        todaysDepartures,
        currentGuests,
        availableRooms,
        cleaningRooms,
        maintenanceRooms,
        bookingStatusCounts,
      },
      blockedRoomAlerts: readinessPayload.blockedRoomAlerts,
      rooms: readinessPayload.rooms,
      readinessByRoomId: readinessPayload.readinessByRoomId,
      readinessList: readinessPayload.readinessList,
      stays,
      bookings,
      customers,
    });
  } catch (err: any) {
    console.error("GET /api/operations/reception error:", err);
    return NextResponse.json({ error: err.message || "Failed to load reception data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authCheck = await requireStaffRole(["Admin", "Receptionist"]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase, staff } = authCheck;
    const body = await req.json();
    const action = body.action as "check_in" | "check_out" | "no_show";
    const roomId = Number(body.roomId);
    const bookingId = Number(body.bookingId);
    const confirmNotReady = Boolean(body.confirmNotReady);

    if (!bookingId || Number.isNaN(bookingId)) {
      return NextResponse.json({ error: "Missing valid bookingId." }, { status: 400 });
    }

    const now = nowInstant();

    if (action === "no_show") {
      const { data: booking } = await supabase
        .from("booking")
        .select("booking_id, booking_status")
        .eq("booking_id", bookingId)
        .maybeSingle();

      if (!booking) {
        return NextResponse.json({ error: "Booking not found." }, { status: 404 });
      }
      if (booking.booking_status === "Checked In" || booking.booking_status === "Checked Out") {
        return NextResponse.json(
          { error: `Cannot mark booking as No Show from status "${booking.booking_status}".` },
          { status: 400 }
        );
      }

      const { error: updErr } = await supabase
        .from("booking")
        .update({
          booking_status: "No Show",
          updated_by_: staff.email,
          date_updated: now,
        })
        .eq("booking_id", bookingId);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: `Booking #${bookingId} marked as No Show.` });
    }

    if (!roomId || Number.isNaN(roomId)) {
      return NextResponse.json({ error: "Missing valid roomId." }, { status: 400 });
    }

    if (action === "check_in") {
      const { data: stay } = await supabase
        .from("check_in_out")
        .select("*, booking(booking_status)")
        .eq("room_room_id", roomId)
        .eq("booking_booking_id", bookingId)
        .maybeSingle();

      if (!stay) {
        return NextResponse.json({ error: "Stay allocation not found." }, { status: 404 });
      }
      if (stay.status === "Checked In") {
        return NextResponse.json({ error: "Guest is already checked in." }, { status: 400 });
      }
      if (stay.booking?.booking_status === "Cancelled" || stay.booking?.booking_status === "No Show") {
        return NextResponse.json(
          { error: `Cannot check in a booking marked "${stay.booking.booking_status}".` },
          { status: 400 }
        );
      }

      // Check derived room readiness before completing check-in
      const readinessPayload = await fetchAllRoomsReadiness(supabase);
      const roomReadiness = readinessPayload.readinessByRoomId[roomId];

      if (roomReadiness && !roomReadiness.isReadyForCheckIn && !confirmNotReady) {
        const reasons: string[] = [];
        if (roomReadiness.maintenanceBlocked) {
          reasons.push("Room is blocked in Maintenance (open High/Urgent ticket).");
        }
        if (roomReadiness.openHousekeepingCount > 0) {
          reasons.push(
            `There ${roomReadiness.openHousekeepingCount === 1 ? "is 1 open housekeeping request" : `are ${roomReadiness.openHousekeepingCount} open housekeeping requests`} on this room.`
          );
        }
        if (roomReadiness.expectedReadyAt && roomReadiness.remainingMinutes > 0) {
          reasons.push(
            `Routine cleaning timer has ${roomReadiness.remainingMinutes} min remaining (expected ready at ${instantToMauritiusParts(roomReadiness.expectedReadyAt).timeStr}).`
          );
        }

        return NextResponse.json({
          requiresConfirmation: true,
          derivedStatus: roomReadiness.derivedStatus,
          warnings: reasons.length > 0 ? reasons : [`Room #${roomId} is currently ${roomReadiness.derivedStatus}.`],
          note: "Room reassignment is not supported in this version. Confirm only if the guest should proceed with this room.",
        });
      }

      const { error: cioErr } = await supabase
        .from("check_in_out")
        .update({
          actual_check_in: now,
          status: "Checked In",
          updated_by_: staff.email,
          date_updated: now,
        })
        .eq("room_room_id", roomId)
        .eq("booking_booking_id", bookingId);

      if (cioErr) {
        return NextResponse.json({ error: cioErr.message }, { status: 500 });
      }

      await supabase
        .from("booking")
        .update({
          booking_status: "Checked In",
          updated_by_: staff.email,
          date_updated: now,
        })
        .eq("booking_id", bookingId);

      return NextResponse.json({ success: true, message: `Checked in Room #${roomId} for Booking #${bookingId}.` });
    }

    if (action === "check_out") {
      const { error: cioErr } = await supabase
        .from("check_in_out")
        .update({
          actual_check_out: now,
          status: "Checked Out",
          updated_by_: staff.email,
          date_updated: now,
        })
        .eq("room_room_id", roomId)
        .eq("booking_booking_id", bookingId);

      if (cioErr) {
        return NextResponse.json({ error: cioErr.message }, { status: 500 });
      }

      await supabase
        .from("booking")
        .update({
          booking_status: "Checked Out",
          updated_by_: staff.email,
          date_updated: now,
        })
        .eq("booking_id", bookingId);

      return NextResponse.json({
        success: true,
        message: `Checked out Room #${roomId}. Housekeeping cleaning timer has started.`,
      });
    }

    return NextResponse.json({ error: "Unsupported reception action." }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/operations/reception error:", err);
    return NextResponse.json({ error: err.message || "Reception action failed" }, { status: 500 });
  }
}

