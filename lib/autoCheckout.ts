// lib/autoCheckout.ts
import { supabase } from "@/lib/supabaseClient";
import { CheckInOut } from "@/lib/types";

export interface AutoCheckoutResult {
  success: boolean;
  count: number;
  processed: {
    room_id: number;
    booking_id: number;
    check_out_date: string;
    was_checked_in: boolean;
  }[];
  error?: string;
}

/**
 * Automatically checks out reservations where the scheduled check-out date/time has passed
 * and the guest has not explicitly checked out.
 * Handles both:
 * 1. Guests who checked in but never checked out before end of stay.
 * 2. Guests who never checked in (no-shows) whose stay duration has now passed.
 */
export async function runAutoCheckout(): Promise<AutoCheckoutResult> {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const nowIso = new Date().toISOString();

    // Find all check_in_out stays where check_out_date is in the past (<= todayStr or < todayStr)
    // and status is not already 'Checked Out' or 'Auto Checked Out'
    const { data: overdueStays, error: fetchError } = await supabase
      .from("check_in_out")
      .select("*, booking(*, customer(*))")
      .lte("check_out_date", todayStr);

    if (fetchError) {
      console.error("[Auto-Checkout] Error querying overdue stays:", fetchError);
      return { success: false, count: 0, processed: [], error: fetchError.message };
    }

    if (!overdueStays || overdueStays.length === 0) {
      return { success: true, count: 0, processed: [] };
    }

    // Filter stays that are NOT already checked out or auto checked out
    const candidates = overdueStays.filter((stay: CheckInOut) => {
      const status = stay.status || "Scheduled";
      return status !== "Checked Out" && status !== "Auto Checked Out";
    });

    if (candidates.length === 0) {
      return { success: true, count: 0, processed: [] };
    }

    const processedList: AutoCheckoutResult["processed"] = [];

    for (const stay of candidates) {
      const wasCheckedIn = Boolean(stay.actual_check_in || stay.status === "Checked In");

      // 1. Update check_in_out record with Auto Checked Out status
      const { error: updateError } = await supabase
        .from("check_in_out")
        .update({
          status: "Auto Checked Out",
          actual_check_out: stay.actual_check_out || nowIso,
          updated_by_: "SYSTEM_AUTO_CHECKOUT",
          date_updated: nowIso,
        })
        .eq("room_room_id", stay.room_room_id)
        .eq("booking_booking_id", stay.booking_booking_id);

      if (updateError) {
        console.error(`[Auto-Checkout] Error updating stay for Room #${stay.room_room_id}, Booking #${stay.booking_booking_id}:`, updateError);
        continue;
      }

      // 2. Queue notification record for tracking / future email/SMS dispatch
      try {
        if (stay.booking?.customer_cust_id) {
          // Check if notification already exists to avoid duplicates
          const { data: existingNotifs } = await supabase
            .from("notification")
            .select("notif_id")
            .eq("booking_booking_id", stay.booking_booking_id)
            .eq("notif_type", "Check-in Reminder")
            .limit(1);

          if (!existingNotifs || existingNotifs.length === 0) {
            await supabase.from("notification").insert([
              {
                sent_date: nowIso,
                notif_type: "Check-in Reminder",
                notif_status: "Pending",
                customer_cust_id: stay.booking.customer_cust_id,
                booking_booking_id: stay.booking_booking_id,
                created_by: "SYSTEM_AUTO_CHECKOUT",
                date_created: nowIso,
              },
            ]);
          }
        }
      } catch (notifErr) {
        console.warn("[Auto-Checkout] Notification record creation skipped/failed:", notifErr);
      }

      processedList.push({
        room_id: stay.room_room_id,
        booking_id: stay.booking_booking_id,
        check_out_date: stay.check_out_date,
        was_checked_in: wasCheckedIn,
      });
    }

    return {
      success: true,
      count: processedList.length,
      processed: processedList,
    };
  } catch (err: any) {
    console.error("[Auto-Checkout] Unexpected failure during execution:", err);
    return { success: false, count: 0, processed: [], error: err?.message || "Unknown error" };
  }
}
