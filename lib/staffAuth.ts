// lib/staffAuth.ts
// Server-side staff verification, role enforcement, and shared operational helpers.
// Reads the staff role from Supabase on every request rather than Clerk metadata,
// and verifies that the staff account is active (is_active === 'Y').

import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { StaffRole, normalizeStaffRole } from "@/lib/types";
import { nowInstant } from "@/lib/time";

export interface AuthenticatedStaff {
  staffId: number;
  email: string;
  role: StaffRole;
  fname: string;
  lname: string;
  clerkUserId: string;
}

export type StaffAuthResult =
  | { authorized: true; staff: AuthenticatedStaff; supabase: SupabaseClient }
  | { authorized: false; status: number; error: string; supabase: SupabaseClient };

export function getServiceSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "placeholder_key";
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Looks up the currently authenticated Clerk user in Supabase staff table,
 * matching by clerk_user_id first (if present) and falling back to verified email.
 * Checks is_active === 'Y' and validates against allowedRoles.
 */
export async function requireStaffRole(
  allowedRoles?: StaffRole[]
): Promise<StaffAuthResult> {
  const supabase = getServiceSupabase();

  const { userId } = auth();
  if (!userId) {
    return {
      authorized: false,
      status: 401,
      error: "Unauthorized. Please sign in.",
      supabase,
    };
  }

  const user = await currentUser();
  const primaryEmail = user?.primaryEmailAddress?.emailAddress?.trim() || "";

  let staffRow: any = null;

  // 1. Try matching by clerk_user_id first
  const { data: byClerk, error: clerkErr } = await supabase
    .from("staff")
    .select("*")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!clerkErr && byClerk) {
    staffRow = byClerk;
  } else if (primaryEmail) {
    // 2. Fallback to email lookup
    const { data: byEmail } = await supabase
      .from("staff")
      .select("*")
      .ilike("email", primaryEmail)
      .maybeSingle();

    if (byEmail) {
      staffRow = byEmail;
      // Backfill clerk_user_id if column exists and is empty
      if (!clerkErr && !byEmail.clerk_user_id) {
        await supabase
          .from("staff")
          .update({ clerk_user_id: userId })
          .eq("staff_id", byEmail.staff_id);
      }
    }
  }

  if (!staffRow) {
    return {
      authorized: false,
      status: 403,
      error: "Forbidden. Active staff account required.",
      supabase,
    };
  }

  if (staffRow.is_active !== "Y") {
    return {
      authorized: false,
      status: 403,
      error: "Forbidden. Your staff account is inactive.",
      supabase,
    };
  }

  const normalizedRole = normalizeStaffRole(staffRow.role);

  if (allowedRoles && !allowedRoles.includes(normalizedRole)) {
    return {
      authorized: false,
      status: 403,
      error: `Forbidden. Role "${normalizedRole}" cannot access this department resource.`,
      supabase,
    };
  }

  return {
    authorized: true,
    staff: {
      staffId: staffRow.staff_id,
      email: staffRow.email || primaryEmail,
      role: normalizedRole,
      fname: staffRow.staff_fname,
      lname: staffRow.staff_lname,
      clerkUserId: userId,
    },
    supabase,
  };
}

/**
 * Recalculates room.room_status based on open High or Urgent maintenance tickets.
 * Rule D3: High and Urgent open tickets (Pending or In Progress) keep the room in Maintenance.
 * Low and Medium tickets never block room availability.
 */
export async function syncRoomMaintenanceStatus(
  supabase: SupabaseClient,
  roomId: number,
  updatedByEmail: string
): Promise<"Available" | "Maintenance"> {
  const { data: openBlockingTickets } = await supabase
    .from("maintenance_request")
    .select("maintenance_id, priority, request_status")
    .eq("room_room_id", roomId)
    .in("request_status", ["Pending", "In Progress", "Open"])
    .in("priority", ["High", "Urgent"]);

  const targetStatus: "Available" | "Maintenance" =
    openBlockingTickets && openBlockingTickets.length > 0 ? "Maintenance" : "Available";

  await supabase
    .from("room")
    .update({
      room_status: targetStatus,
      updated_by_: updatedByEmail,
      date_updated: nowInstant(),
    })
    .eq("room_id", roomId);

  return targetStatus;
}

