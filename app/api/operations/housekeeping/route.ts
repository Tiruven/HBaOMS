// app/api/operations/housekeeping/route.ts
// Housekeeping Supervisor, Admin, and read-only Receptionist endpoint:
// - Derives rooms currently in Cleaning using the shared readiness function
// - Lists today's check-outs and open housekeeping requests
// - Allows creating and updating housekeeping_request rows for rooms without a checked-in guest

import { NextResponse } from "next/server";
import { requireStaffRole } from "@/lib/staffAuth";
import { fetchAllRoomsReadiness } from "@/lib/roomReadiness";
import { nowInstant } from "@/lib/time";

export const dynamic = "force-dynamic";

const ALLOWED_REQUEST_TYPES = ["Special cleaning", "Excessive mess", "Extra cleaning"] as const;
const ALLOWED_HK_STATUSES = ["Pending", "In Progress", "Completed", "Cancelled"] as const;

export async function GET() {
  try {
    const authCheck = await requireStaffRole([
      "Admin",
      "Housekeeping Supervisor",
      "Receptionist",
    ]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase, staff } = authCheck;
    const [readinessPayload, hkRes] = await Promise.all([
      fetchAllRoomsReadiness(supabase),
      supabase
        .from("housekeeping_request")
        .select("*, room(room_id, room_desc, room_type(type, cleaning_minutes))")
        .order("created_at", { ascending: false }),
    ]);

    const cleaningRooms = readinessPayload.rooms
      .map((room: any) => ({
        room,
        readiness: readinessPayload.readinessByRoomId[room.room_id],
      }))
      .filter((item) => item.readiness?.derivedStatus === "Cleaning");

    const eligibleRoomsForRequest = readinessPayload.rooms.filter(
      (room: any) => readinessPayload.readinessByRoomId[room.room_id]?.derivedStatus !== "Occupied"
    );

    return NextResponse.json({
      role: staff.role,
      housekeepingTableReady: readinessPayload.housekeepingTableReady && !hkRes.error,
      cleaningRooms,
      todaysCheckouts: readinessPayload.todaysCheckouts,
      requests: hkRes.error ? [] : hkRes.data || [],
      allRooms: readinessPayload.rooms,
      readinessByRoomId: readinessPayload.readinessByRoomId,
      eligibleRoomsForRequest,
    });
  } catch (err: any) {
    console.error("GET /api/operations/housekeeping error:", err);
    return NextResponse.json({ error: err.message || "Failed to load housekeeping data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authCheck = await requireStaffRole(["Admin", "Housekeeping Supervisor"]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase, staff } = authCheck;
    const body = await req.json();
    const roomId = Number(body.roomId);
    const requestType = body.requestType as string;
    const description = body.description ? String(body.description).trim() : null;

    if (!roomId || Number.isNaN(roomId)) {
      return NextResponse.json({ error: "Please select a valid room." }, { status: 400 });
    }

    if (!ALLOWED_REQUEST_TYPES.includes(requestType as any)) {
      return NextResponse.json(
        { error: `Invalid request type. Allowed: ${ALLOWED_REQUEST_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (description && description.length > 500) {
      return NextResponse.json({ error: "Description cannot exceed 500 characters." }, { status: 400 });
    }

    // Enforce Requirement E6: applies only to rooms without a checked-in guest
    const { data: checkedInStay } = await supabase
      .from("check_in_out")
      .select("booking_booking_id")
      .eq("room_room_id", roomId)
      .eq("status", "Checked In")
      .limit(1);

    if (checkedInStay && checkedInStay.length > 0) {
      return NextResponse.json(
        {
          error:
            "Housekeeping requests can only be created for rooms without a checked-in guest.",
        },
        { status: 400 }
      );
    }

    const now = nowInstant();
    const { data: created, error: insertErr } = await supabase
      .from("housekeeping_request")
      .insert([
        {
          room_room_id: roomId,
          request_type: requestType,
          description,
          request_status: "Pending",
          created_at: now,
          created_by: staff.email,
          updated_by_: staff.email,
          date_updated: now,
        },
      ])
      .select()
      .single();

    if (insertErr) {
      if (insertErr.message?.includes("housekeeping_request")) {
        return NextResponse.json(
          {
            error:
              "Table housekeeping_request is missing. Please run database/v7_operations_supervisor_staff.sql in Supabase first.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, request: created });
  } catch (err: any) {
    console.error("POST /api/operations/housekeeping error:", err);
    return NextResponse.json({ error: err.message || "Failed to create housekeeping request" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authCheck = await requireStaffRole(["Admin", "Housekeeping Supervisor"]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase, staff } = authCheck;
    const body = await req.json();
    const hkReqId = Number(body.hkReqId);
    const status = body.status as string;

    if (!hkReqId || Number.isNaN(hkReqId)) {
      return NextResponse.json({ error: "Missing valid hkReqId." }, { status: 400 });
    }

    if (!ALLOWED_HK_STATUSES.includes(status as any)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${ALLOWED_HK_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const now = nowInstant();
    const updatePayload: Record<string, any> = {
      request_status: status,
      completed_at: status === "Completed" ? now : null,
      updated_by_: staff.email,
      date_updated: now,
    };

    const { data: updated, error: updErr } = await supabase
      .from("housekeeping_request")
      .update(updatePayload)
      .eq("hk_req_id", hkReqId)
      .select()
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (err: any) {
    console.error("PATCH /api/operations/housekeeping error:", err);
    return NextResponse.json({ error: err.message || "Failed to update housekeeping request" }, { status: 500 });
  }
}

