// app/api/send-reminders/route.ts
// Automated check-in reminder job for HBaOMS (v6.2).
// Dispatches pre-arrival reminders for confirmed bookings checking in tomorrow.
// Protected by CRON_SECRET authorization header.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { mauritiusToday, addDaysToMauritiusDate } from "@/lib/time";
import { sendEmail, buildCheckInReminderHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // 1. Verify authorization header against CRON_SECRET if configured
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Target check-in date: Tomorrow in Mauritius time
    const today = mauritiusToday();
    const tomorrow = addDaysToMauritiusDate(today, 1);

    // 3. Find confirmed/scheduled bookings checking in tomorrow
    // check_in_date starts with tomorrow's ISO date string
    const { data: stays, error: sErr } = await supabase
      .from("check_in_out")
      .select(`
        room_room_id,
        check_in_date,
        check_out_date,
        booking:booking_booking_id (
          booking_id,
          booking_status,
          customer:customer_cust_id (
            cust_id,
            cust_fname,
            cust_lname,
            email
          )
        ),
        room:room_room_id (
          room_id,
          room_type:room_type_room_type_id (
            type
          )
        )
      `)
      .gte("check_in_date", `${tomorrow}T00:00:00`)
      .lte("check_in_date", `${tomorrow}T23:59:59`);

    if (sErr) {
      console.error("Error fetching stays for reminders:", sErr);
      return NextResponse.json({ error: "Failed to query upcoming stays" }, { status: 500 });
    }

    const eligibleStays = (stays || []).filter((s: any) => {
      const bStatus = s.booking?.booking_status;
      return bStatus === "Confirmed";
    });

    const results: {
      bookingId: number;
      recipient: string;
      status: "Sent" | "Failed" | "Skipped";
      error?: string;
    }[] = [];

    for (const s of eligibleStays) {
      const booking = s.booking as any;
      const customer = booking?.customer;
      const room = s.room as any;
      const bookingId = booking?.booking_id;
      const custId = customer?.cust_id;
      const recipientEmail = customer?.email;

      if (!bookingId || !recipientEmail || !custId) {
        continue;
      }

      // Check if reminder was already sent (deduplication check)
      const { data: existingNotif } = await supabase
        .from("notification")
        .select("notif_id, notif_status")
        .eq("booking_booking_id", bookingId)
        .eq("notif_type", "Check-in Reminder")
        .maybeSingle();

      if (existingNotif && existingNotif.notif_status === "Sent") {
        results.push({ bookingId, recipient: recipientEmail, status: "Skipped" });
        continue;
      }

      // Create or update Pending notification record
      let notifId = existingNotif?.notif_id;
      if (!notifId) {
        const { data: insertedNotif } = await supabase
          .from("notification")
          .insert([
            {
              customer_cust_id: custId,
              booking_booking_id: bookingId,
              notif_type: "Check-in Reminder",
              notif_status: "Pending",
              sent_date: new Date().toISOString(),
              created_by: "Cron Reminder",
              date_created: new Date().toISOString(),
            },
          ])
          .select("notif_id")
          .maybeSingle();

        notifId = insertedNotif?.notif_id;
      }

      const guestName = `${customer.cust_fname || "Guest"} ${customer.cust_lname || ""}`.trim();
      const roomTypeName = room?.room_type?.type || "Reserved Accommodation";

      const { subject, html } = buildCheckInReminderHtml({
        guestName,
        bookingId,
        roomTypeName,
        checkInDate: s.check_in_date,
        checkOutDate: s.check_out_date,
      });

      const sendResult = await sendEmail({
        to: recipientEmail,
        subject,
        html,
      });

      if (notifId) {
        await supabase
          .from("notification")
          .update({
            notif_status: sendResult.success ? "Sent" : "Failed",
            date_updated: new Date().toISOString(),
            updated_by_: sendResult.success ? "Nodemailer Cron" : `Error: ${sendResult.error || "Failed"}`,
          })
          .eq("notif_id", notifId);
      }

      results.push({
        bookingId,
        recipient: recipientEmail,
        status: sendResult.success ? "Sent" : "Failed",
        error: sendResult.error,
      });
    }

    return NextResponse.json({
      success: true,
      targetDate: tomorrow,
      processedCount: results.length,
      details: results,
    });
  } catch (err: any) {
    console.error("send-reminders error:", err);
    return NextResponse.json({ error: err.message || "Failed to run reminder job" }, { status: 500 });
  }
}

