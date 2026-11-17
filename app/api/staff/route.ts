// app/api/staff/route.ts
// Staff directory, current-staff role lookup, customer-to-staff promotion, and activation toggle.

import { NextResponse } from "next/server";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import {
  requireStaffRole,
  getServiceSupabase,
} from "@/lib/staffAuth";
import {
  ALL_STAFF_ROLES,
  StaffRole,
  normalizeStaffRole,
} from "@/lib/types";
import { nowInstant } from "@/lib/time";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const isMeQuery = url.searchParams.get("me") === "1";

    if (isMeQuery) {
      const { userId } = auth();
      if (!userId) {
        return NextResponse.json({ staff: null });
      }
      const user = await currentUser();
      const email = user?.primaryEmailAddress?.emailAddress?.trim() || "";
      const supabase = getServiceSupabase();

      let staffRow: any = null;

      const { data: byClerk, error: clerkErr } = await supabase
        .from("staff")
        .select("*")
        .eq("clerk_user_id", userId)
        .maybeSingle();

      if (!clerkErr && byClerk) {
        staffRow = byClerk;
      } else if (email) {
        const { data: byEmail } = await supabase
          .from("staff")
          .select("*")
          .ilike("email", email)
          .maybeSingle();

        if (byEmail) {
          staffRow = byEmail;
          if (!clerkErr && !byEmail.clerk_user_id) {
            await supabase
              .from("staff")
              .update({ clerk_user_id: userId })
              .eq("staff_id", byEmail.staff_id);
          }
        }
      }

      if (!staffRow || staffRow.is_active !== "Y") {
        return NextResponse.json({ staff: null });
      }

      return NextResponse.json({
        staff: {
          ...staffRow,
          role: normalizeStaffRole(staffRow.role),
        },
      });
    }

    // Full directory & customer list for Admin only
    const authCheck = await requireStaffRole(["Admin"]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase } = authCheck;
    const [staffRes, custRes] = await Promise.all([
      supabase.from("staff").select("*").order("staff_id", { ascending: true }),
      supabase
        .from("customer")
        .select("cust_id, cust_fname, cust_lname, email, contact_info, clerk_user_id, date_created")
        .order("cust_fname", { ascending: true }),
    ]);

    if (staffRes.error) {
      return NextResponse.json({ error: staffRes.error.message }, { status: 500 });
    }

    const staffList = (staffRes.data || []).map((s: any) => ({
      ...s,
      role: normalizeStaffRole(s.role),
    }));

    const existingEmails = new Set(staffList.map((s: any) => (s.email || "").toLowerCase()));
    const existingClerkIds = new Set(
      staffList.map((s: any) => s.clerk_user_id).filter(Boolean)
    );

    const customers = (custRes.data || []).map((c: any) => ({
      ...c,
      isAlreadyStaff:
        existingEmails.has((c.email || "").toLowerCase()) ||
        (c.clerk_user_id ? existingClerkIds.has(c.clerk_user_id) : false),
    }));

    return NextResponse.json({
      staff: staffList,
      customers,
      currentAdminStaffId: authCheck.staff.staffId,
    });
  } catch (err: any) {
    console.error("GET /api/staff error:", err);
    return NextResponse.json({ error: err.message || "Failed to load staff data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authCheck = await requireStaffRole(["Admin"]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase, staff: admin } = authCheck;
    const body = await req.json();
    const custId = Number(body.custId);
    const targetRole = body.role as StaffRole;

    if (!custId || Number.isNaN(custId)) {
      return NextResponse.json({ error: "Please select an existing customer account." }, { status: 400 });
    }

    if (!ALL_STAFF_ROLES.includes(targetRole)) {
      return NextResponse.json({ error: "Invalid staff role selected." }, { status: 400 });
    }

    // 1. Fetch customer record
    const { data: customer, error: custErr } = await supabase
      .from("customer")
      .select("*")
      .eq("cust_id", custId)
      .maybeSingle();

    if (custErr || !customer) {
      return NextResponse.json({ error: "Selected customer account not found." }, { status: 404 });
    }

    const customerEmail = (customer.email || "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(customerEmail)) {
      return NextResponse.json({ error: "Customer account has an invalid email address." }, { status: 400 });
    }

    // 2. Verify Clerk account & verified email status
    let matchedClerkUserId: string | null = customer.clerk_user_id || null;
    try {
      const client = clerkClient();
      let clerkUser: any = null;

      if (matchedClerkUserId) {
        try {
          clerkUser = await client.users.getUser(matchedClerkUserId);
        } catch {
          clerkUser = null;
        }
      }

      if (!clerkUser) {
        const listRes = await client.users.getUserList({
          emailAddress: [customerEmail],
          limit: 1,
        });
        if (listRes?.data && listRes.data.length > 0) {
          clerkUser = listRes.data[0];
        }
      }

      if (!clerkUser) {
        return NextResponse.json(
          {
            error:
              "This customer does not have a Clerk login account yet. Ask them to sign in at least once before promoting.",
          },
          { status: 400 }
        );
      }

      const primaryEmailObj = clerkUser.emailAddresses?.find(
        (e: any) => e.id === clerkUser.primaryEmailAddressId
      ) || clerkUser.emailAddresses?.[0];

      if (primaryEmailObj?.verification?.status !== "verified") {
        return NextResponse.json(
          { error: "Only accounts with a verified email address in Clerk can be promoted to staff." },
          { status: 400 }
        );
      }

      matchedClerkUserId = clerkUser.id;
    } catch (clerkCheckErr) {
      console.warn("Clerk verification check fallback:", clerkCheckErr);
      if (!matchedClerkUserId) {
        return NextResponse.json(
          { error: "Unable to verify the customer's Clerk account status." },
          { status: 400 }
        );
      }
    }

    // 3. Check for existing staff row (match by clerk_user_id first, then email)
    let existingStaff: any = null;
    if (matchedClerkUserId) {
      const { data: byClerk } = await supabase
        .from("staff")
        .select("*")
        .eq("clerk_user_id", matchedClerkUserId)
        .maybeSingle();
      if (byClerk) existingStaff = byClerk;
    }

    if (!existingStaff) {
      const { data: byEmail } = await supabase
        .from("staff")
        .select("*")
        .ilike("email", customerEmail)
        .maybeSingle();
      if (byEmail) existingStaff = byEmail;
    }

    const now = nowInstant();

    if (existingStaff) {
      if (existingStaff.is_active === "Y") {
        return NextResponse.json(
          { error: "This account already has an active staff profile." },
          { status: 409 }
        );
      }

      // Reactivate previously deactivated staff row with new role
      const { data: reactivated, error: reactivateErr } = await supabase
        .from("staff")
        .update({
          role: targetRole,
          is_active: "Y",
          clerk_user_id: matchedClerkUserId,
          updated_by_: admin.email,
          date_updated: now,
        })
        .eq("staff_id", existingStaff.staff_id)
        .select()
        .single();

      if (reactivateErr) {
        return NextResponse.json({ error: reactivateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        staff: reactivated,
        message: "Staff account reactivated with the selected role.",
      });
    }

    // 4. Insert new staff record
    const insertPayload: Record<string, any> = {
      staff_fname: (customer.cust_fname || "Staff").substring(0, 100),
      staff_lname: (customer.cust_lname || "Member").substring(0, 100),
      role: targetRole,
      email: customer.email.trim(),
      password_hash: "CLERK_AUTH",
      contact_info: (customer.contact_info || "N/A").substring(0, 30),
      is_active: "Y",
      clerk_user_id: matchedClerkUserId,
      created_by: admin.email,
      date_created: now,
      updated_by_: admin.email,
      date_updated: now,
    };

    let { data: created, error: insertErr } = await supabase
      .from("staff")
      .insert([insertPayload])
      .select()
      .single();

    // Fallback if clerk_user_id column is not yet added in Supabase
    if (insertErr && insertErr.message?.includes("clerk_user_id")) {
      delete insertPayload.clerk_user_id;
      const retry = await supabase.from("staff").insert([insertPayload]).select().single();
      created = retry.data;
      insertErr = retry.error;
    }

    if (insertErr) {
      if (insertErr.message?.includes("value too long") || insertErr.message?.includes("chk_role")) {
        return NextResponse.json(
          {
            error:
              "Database migration database/v7_operations_supervisor_staff.sql must be executed in Supabase first to allow the new supervisor role names.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Sync clerk_user_id back onto customer row if empty
    if (matchedClerkUserId && !customer.clerk_user_id) {
      await supabase
        .from("customer")
        .update({ clerk_user_id: matchedClerkUserId })
        .eq("cust_id", customer.cust_id);
    }

    return NextResponse.json({
      success: true,
      staff: created,
      message: `${customer.cust_fname} ${customer.cust_lname} added as ${targetRole}.`,
    });
  } catch (err: any) {
    console.error("POST /api/staff error:", err);
    return NextResponse.json({ error: err.message || "Failed to promote account" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authCheck = await requireStaffRole(["Admin"]);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase, staff: admin } = authCheck;
    const body = await req.json();
    const staffId = Number(body.staffId);
    const nextRole = body.role as StaffRole | undefined;
    const nextActive = body.is_active as "Y" | "N" | undefined;

    if (!staffId || Number.isNaN(staffId)) {
      return NextResponse.json({ error: "Missing staffId." }, { status: 400 });
    }

    if (nextRole && !ALL_STAFF_ROLES.includes(nextRole)) {
      return NextResponse.json({ error: "Invalid staff role." }, { status: 400 });
    }

    if (nextActive && nextActive !== "Y" && nextActive !== "N") {
      return NextResponse.json({ error: "Invalid is_active value." }, { status: 400 });
    }

    const { data: targetStaff, error: findErr } = await supabase
      .from("staff")
      .select("*")
      .eq("staff_id", staffId)
      .maybeSingle();

    if (findErr || !targetStaff) {
      return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    }

    const targetCurrentRole = normalizeStaffRole(targetStaff.role);
    const isSelf =
      targetStaff.staff_id === admin.staffId ||
      (targetStaff.clerk_user_id && targetStaff.clerk_user_id === admin.clerkUserId) ||
      (targetStaff.email || "").toLowerCase() === admin.email.toLowerCase();

    // Security rule: Block admin from deactivating or demoting themselves
    if (isSelf) {
      if (nextActive === "N") {
        return NextResponse.json(
          { error: "You cannot deactivate your own Admin account." },
          { status: 400 }
        );
      }
      if (nextRole && nextRole !== "Admin") {
        return NextResponse.json(
          { error: "You cannot demote your own Admin role." },
          { status: 400 }
        );
      }
    }

    // Security rule: Ensure at least one active Admin remains in the system
    if (
      targetCurrentRole === "Admin" &&
      targetStaff.is_active === "Y" &&
      (nextActive === "N" || (nextRole && nextRole !== "Admin"))
    ) {
      const { count } = await supabase
        .from("staff")
        .select("staff_id", { count: "exact", head: true })
        .eq("role", "Admin")
        .eq("is_active", "Y")
        .neq("staff_id", staffId);

      if (!count || count < 1) {
        return NextResponse.json(
          { error: "Cannot remove the last active Admin in the system." },
          { status: 400 }
        );
      }
    }

    const updateFields: Record<string, any> = {
      updated_by_: admin.email,
      date_updated: nowInstant(),
    };
    if (nextRole) updateFields.role = nextRole;
    if (nextActive) updateFields.is_active = nextActive;

    const { data: updated, error: updateErr } = await supabase
      .from("staff")
      .update(updateFields)
      .eq("staff_id", staffId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      staff: {
        ...updated,
        role: normalizeStaffRole(updated.role),
      },
    });
  } catch (err: any) {
    console.error("PATCH /api/staff error:", err);
    return NextResponse.json({ error: err.message || "Failed to update staff" }, { status: 500 });
  }
}

