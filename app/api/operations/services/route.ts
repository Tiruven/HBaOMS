// app/api/operations/services/route.ts
// Service Supervisor & Admin endpoint:
// - Returns service bookings (without assigned staff fields)
// - Returns active/upcoming Half Board (HB) and Full Board (FB) room stays for dining/chef planning
// - Allows updating service booking status (Pending, In Progress, Completed, Cancelled) with audit fields

import { NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/staffAuth";
import { nowInstant, mauritiusToday, instantToMauritiusParts } from "@/lib/time";

export const dynamic = "force-dynamic";

const ALLOWED_SERVICE_STATUSES = ["Pending", "In Progress", "Completed", "Cancelled"] as const;

export async function GET() {
  try {
    const authCheck = await requireStaffRole(["Admin", "Service Supervisor"]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase } = authCheck;
    const todayStr = mauritiusToday();

    const [sbRes, boardStaysRes] = await Promise.all([
      supabase
        .from("service_booking")
        .select("sb_id, booking_booking_id, service_service_id, service_date, time_in, time_out, num_person, total_amount, sb_status, updated_by_, date_updated, service(service_id, service_name, service_type), booking(booking_id, booking_type, booking_status, customer(cust_fname, cust_lname))")
        .order("sb_id", { ascending: false }),
      supabase
        .from("check_in_out")
        .select("room_room_id, booking_booking_id, check_in_date, check_out_date, status, room(room_id, room_desc, room_type(type)), booking!inner(booking_id, booking_type, booking_status, num_adults, num_children)")
        .in("booking.booking_type", ["HB", "FB"])
        .in("booking.booking_status", ["Confirmed", "Checked In"]),
    ]);

    if (sbRes.error) {
      return NextResponse.json({ error: sbRes.error.message }, { status: 500 });
    }

    // Filter board plan stays to currently active or upcoming stays (check_out_date >= today)
    const mealPlanRooms = (boardStaysRes.data || [])
      .filter((s: any) => {
        if (s.status === "Checked Out" || s.status === "Auto Checked Out") return false;
        const outDate = s.check_out_date ? instantToMauritiusParts(s.check_out_date).dateStr : "";
        return s.status === "Checked In" || outDate >= todayStr;
      })
      .map((s: any) => ({
        roomId: s.room_room_id,
        roomDesc: s.room?.room_desc || `Room #${s.room_room_id}`,
        roomType: s.room?.room_type?.type || "Room",
        bookingId: s.booking_booking_id,
        boardType: s.booking?.booking_type as "HB" | "FB",
        bookingStatus: s.booking?.booking_status,
        stayStatus: s.status || "Scheduled",
        numAdults: s.booking?.num_adults || 1,
        numChildren: s.booking?.num_children || 0,
        checkInDate: s.check_in_date,
        checkOutDate: s.check_out_date,
      }));

    return NextResponse.json({
      serviceBookings: sbRes.data || [],
      mealPlanRooms,
    });
  } catch (err: any) {
    console.error("GET /api/operations/services error:", err);
    return NextResponse.json({ error: err.message || "Failed to load service bookings" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authCheck = await requireStaffRole(["Admin", "Service Supervisor"]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase, staff } = authCheck;
    const body = await req.json();
    const sbId = Number(body.sbId);
    const status = body.status as string;

    if (!sbId || Number.isNaN(sbId)) {
      return NextResponse.json({ error: "Missing valid sbId." }, { status: 400 });
    }

    if (!ALLOWED_SERVICE_STATUSES.includes(status as any)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed values: ${ALLOWED_SERVICE_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const now = nowInstant();
    const updatePayload: Record<string, any> = {
      sb_status: status,
      updated_by_: staff.email,
      date_updated: now,
    };

    if (status === "Cancelled") {
      updatePayload.cancelled_at = now;
      updatePayload.cancellation_reason = body.reason || "Cancelled by Service Supervisor";
    }

    const { data, error } = await supabase
      .from("service_booking")
      .update(updatePayload)
      .eq("sb_id", sbId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, serviceBooking: data });
  } catch (err: any) {
    console.error("PATCH /api/operations/services error:", err);
    return NextResponse.json({ error: err.message || "Failed to update service status" }, { status: 500 });
  }
}

