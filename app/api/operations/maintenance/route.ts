// app/api/operations/maintenance/route.ts
// Maintenance Supervisor, Admin, and read-only Receptionist endpoint:
// - Auto-fills staff_staff_id, created_by, updated_by_ from authenticated staff user on the server
// - High and Urgent open tickets (Pending / In Progress) set room.room_status = 'Maintenance'
// - Low and Medium tickets never block rooms from sale
// - Changing priority or resolving/cancelling re-evaluates room.room_status immediately

import { NextResponse } from "next/server";
import { requireStaffRole, syncRoomMaintenanceStatus } from "@/lib/staffAuth";
import { fetchAllRoomsReadiness } from "@/lib/roomReadiness";
import { nowInstant, startOfMauritiusDay, mauritiusToday } from "@/lib/time";

export const dynamic = "force-dynamic";

const ALLOWED_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
const ALLOWED_STATUSES = ["Pending", "In Progress", "Completed", "Cancelled"] as const;

export async function GET() {
  try {
    const authCheck = await requireStaffRole(["Admin", "Maintenance Supervisor", "Receptionist"]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase, staff } = authCheck;
    const [reqRes, readinessPayload] = await Promise.all([
      supabase
        .from("maintenance_request")
        .select("*, room(*, room_type(*)), staff(staff_id, staff_fname, staff_lname, email, is_active)")
        .order("maintenance_id", { ascending: false }),
      fetchAllRoomsReadiness(supabase),
    ]);

    // Fallback query without staff join if fk/column is not yet added in DB
    let requests = reqRes.data || [];
    if (reqRes.error) {
      const fallback = await supabase
        .from("maintenance_request")
        .select("*, room(*, room_type(*))")
        .order("maintenance_id", { ascending: false });
      requests = fallback.data || [];
    }

    return NextResponse.json({
      role: staff.role,
      requests,
      rooms: readinessPayload.rooms,
      readinessByRoomId: readinessPayload.readinessByRoomId,
      blockedRoomAlerts: readinessPayload.blockedRoomAlerts,
    });
  } catch (err: any) {
    console.error("GET /api/operations/maintenance error:", err);
    return NextResponse.json({ error: err.message || "Failed to load maintenance data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authCheck = await requireStaffRole(["Admin", "Maintenance Supervisor"]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase, staff } = authCheck;
    const body = await req.json();
    const roomId = Number(body.roomId);
    const description = (body.description || "").trim();
    const priority = body.priority as string;
    const status = (body.status || "Pending") as string;
    const requestDateStr = body.requestDate || mauritiusToday();

    if (!roomId || Number.isNaN(roomId)) {
      return NextResponse.json({ error: "Please select a valid room." }, { status: 400 });
    }
    if (!description || description.length < 3 || description.length > 500) {
      return NextResponse.json(
        { error: "Description must be between 3 and 500 characters." },
        { status: 400 }
      );
    }
    if (!ALLOWED_PRIORITIES.includes(priority as any)) {
      return NextResponse.json({ error: "Invalid priority value." }, { status: 400 });
    }
    if (!ALLOWED_STATUSES.includes(status as any)) {
      return NextResponse.json({ error: "Invalid request status." }, { status: 400 });
    }

    const now = nowInstant();
    const cleanDate = requestDateStr.includes("T") ? requestDateStr.split("T")[0] : requestDateStr;
    const reqDateInstant = startOfMauritiusDay(cleanDate);

    const payload: Record<string, any> = {
      room_room_id: roomId,
      mr_desc: description,
      priority,
      request_status: status,
      request_date: reqDateInstant,
      staff_staff_id: staff.staffId,
      created_by: staff.email,
      date_created: now,
      updated_by_: staff.email,
      date_updated: now,
    };

    let { data: created, error: insertErr } = await supabase
      .from("maintenance_request")
      .insert([payload])
      .select()
      .single();

    if (insertErr && insertErr.message?.includes("staff_staff_id")) {
      delete payload.staff_staff_id;
      const retry = await supabase.from("maintenance_request").insert([payload]).select().single();
      created = retry.data;
      insertErr = retry.error;
    }

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const roomStatus = await syncRoomMaintenanceStatus(supabase, roomId, staff.email);

    return NextResponse.json({
      success: true,
      ticket: created,
      roomStatus,
    });
  } catch (err: any) {
    console.error("POST /api/operations/maintenance error:", err);
    return NextResponse.json({ error: err.message || "Failed to create maintenance ticket" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authCheck = await requireStaffRole(["Admin", "Maintenance Supervisor"]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase, staff } = authCheck;
    const body = await req.json();
    const maintenanceId = Number(body.maintenanceId);

    if (!maintenanceId || Number.isNaN(maintenanceId)) {
      return NextResponse.json({ error: "Missing valid maintenanceId." }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("maintenance_request")
      .select("*")
      .eq("maintenance_id", maintenanceId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Maintenance ticket not found." }, { status: 404 });
    }

    const updateFields: Record<string, any> = {
      updated_by_: staff.email,
      date_updated: nowInstant(),
    };

    if (body.priority !== undefined) {
      if (!ALLOWED_PRIORITIES.includes(body.priority)) {
        return NextResponse.json({ error: "Invalid priority value." }, { status: 400 });
      }
      updateFields.priority = body.priority;
    }

    if (body.status !== undefined) {
      if (!ALLOWED_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status value." }, { status: 400 });
      }
      updateFields.request_status = body.status;
    }

    if (body.description !== undefined) {
      const desc = String(body.description).trim();
      if (desc.length < 3 || desc.length > 500) {
        return NextResponse.json(
          { error: "Description must be between 3 and 500 characters." },
          { status: 400 }
        );
      }
      updateFields.mr_desc = desc;
    }

    if (body.roomId !== undefined) {
      const nextRoomId = Number(body.roomId);
      if (!nextRoomId || Number.isNaN(nextRoomId)) {
        return NextResponse.json({ error: "Invalid roomId." }, { status: 400 });
      }
      updateFields.room_room_id = nextRoomId;
    }

    const { data: updated, error: updErr } = await supabase
      .from("maintenance_request")
      .update(updateFields)
      .eq("maintenance_id", maintenanceId)
      .select()
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Re-evaluate both old room (if room changed) and current room
    const targetRoomId = updated.room_room_id;
    const roomStatus = await syncRoomMaintenanceStatus(supabase, targetRoomId, staff.email);
    if (existing.room_room_id !== targetRoomId) {
      await syncRoomMaintenanceStatus(supabase, existing.room_room_id, staff.email);
    }

    return NextResponse.json({
      success: true,
      ticket: updated,
      roomStatus,
    });
  } catch (err: any) {
    console.error("PATCH /api/operations/maintenance error:", err);
    return NextResponse.json({ error: err.message || "Failed to update maintenance ticket" }, { status: 500 });
  }
}

