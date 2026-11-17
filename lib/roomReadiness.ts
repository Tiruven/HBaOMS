// lib/roomReadiness.ts
// Shared room readiness calculator used across the booking wizard, receptionist views,
// housekeeping supervisor views, and maintenance workflows.
//
// Known assumptions & limitations:
// 1. False-ready assumption: Routine cleaning is timer-based without worker accounts or
//    manual completion confirmations. The system assumes routine cleaning completes within
//    room_type.cleaning_minutes unless the Housekeeping Supervisor logs an open
//    housekeeping_request. If a worker is delayed verbally and no request is logged
//    before the timer expires, the room displays Available until a request is logged.
// 2. No room-change feature: If an assigned room is Cleaning or Maintenance at check-in,
//    reception sees a warning before confirming check-in, but reassigning a stay to another
//    room is not implemented in v7.

import type { SupabaseClient } from "@supabase/supabase-js";
import { instantToMauritiusParts, mauritiusToday } from "@/lib/time";

export type DerivedRoomStatus = "Available" | "Occupied" | "Cleaning" | "Maintenance";

export interface RoomReadinessStayInput {
  bookingId: number;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn?: string | null;
  actualCheckOut?: string | null;
}

export interface RoomReadinessHKInput {
  hkReqId: number;
  requestType: "Special cleaning" | "Excessive mess" | "Extra cleaning";
  status: "Pending" | "In Progress";
  description?: string | null;
  createdAt?: string;
}

export interface RoomReadinessMaintInput {
  maintenanceId: number;
  priority: "Low" | "Medium" | "High" | "Urgent";
  status: "Pending" | "In Progress" | "Open";
  description?: string | null;
}

export interface RoomReadinessInput {
  roomId: number;
  storedRoomStatus: "Available" | "Maintenance";
  cleaningMinutes: number;
  now: Date;
  activeOrLastStay?: RoomReadinessStayInput | null;
  openHousekeepingRequests: RoomReadinessHKInput[];
  openMaintenanceTickets: RoomReadinessMaintInput[];
}

export interface RoomReadinessResult {
  roomId: number;
  derivedStatus: DerivedRoomStatus;
  housekeepingStatus: "Ready" | "Cleaning" | "Held by Request" | "Occupied" | "Unavailable";
  maintenanceStatus: "Clear" | "Low/Medium Open" | "Blocked (High/Urgent)";
  isReadyForCheckIn: boolean;
  isBlockedForWizard: boolean;
  maintenanceBlocked: boolean;
  hasLowMedMaintenance: boolean;
  cleaningActive: boolean;
  cleaningReason: "NONE" | "TIMER" | "REQUEST" | "TIMER_AND_REQUEST";
  cleaningMinutes: number;
  timerStartedAt: string | null;
  expectedReadyAt: string | null;
  remainingMinutes: number;
  openHousekeepingCount: number;
  openHousekeepingRequests: RoomReadinessHKInput[];
  openHighUrgentMaintenanceCount: number;
  openMaintenanceTickets: RoomReadinessMaintInput[];
}

export function getRoomReadiness(input: RoomReadinessInput): RoomReadinessResult {
  const cleaningMinutes = Math.max(1, Number(input.cleaningMinutes) || 45);
  const openHK = input.openHousekeepingRequests.filter(
    (r) => r.status === "Pending" || r.status === "In Progress"
  );
  const openMaint = input.openMaintenanceTickets.filter(
    (t) => t.status === "Pending" || t.status === "In Progress" || t.status === "Open"
  );
  const openHighUrgent = openMaint.filter(
    (t) => t.priority === "High" || t.priority === "Urgent"
  );
  const hasLowMedMaintenance = openMaint.some(
    (t) => t.priority === "Low" || t.priority === "Medium"
  );

  const maintenanceBlocked =
    input.storedRoomStatus === "Maintenance" || openHighUrgent.length > 0;

  const stay = input.activeOrLastStay;
  const isOccupied = Boolean(stay && stay.status === "Checked In");

  // Timer start: actual_check_out for manual checkout, or scheduled check_out_date for Auto Checked Out
  let timerStartedAt: string | null = null;
  if (stay) {
    if (stay.status === "Auto Checked Out") {
      timerStartedAt = stay.checkOutDate;
    } else if (stay.status === "Checked Out") {
      timerStartedAt = stay.actualCheckOut || stay.checkOutDate;
    }
  }

  let expectedReadyAt: string | null = null;
  let timerActive = false;
  let remainingMinutes = 0;

  if (timerStartedAt && !isOccupied) {
    const startMs = new Date(timerStartedAt).getTime();
    if (!Number.isNaN(startMs)) {
      const readyMs = startMs + cleaningMinutes * 60_000;
      expectedReadyAt = new Date(readyMs).toISOString();
      const diffMs = readyMs - input.now.getTime();
      if (diffMs > 0) {
        timerActive = true;
        remainingMinutes = Math.ceil(diffMs / 60_000);
      }
    }
  }

  const hasOpenHK = openHK.length > 0;
  const cleaningActive = !isOccupied && (timerActive || hasOpenHK);

  let cleaningReason: RoomReadinessResult["cleaningReason"] = "NONE";
  if (timerActive && hasOpenHK) {
    cleaningReason = "TIMER_AND_REQUEST";
  } else if (timerActive) {
    cleaningReason = "TIMER";
  } else if (hasOpenHK) {
    cleaningReason = "REQUEST";
  }

  let derivedStatus: DerivedRoomStatus = "Available";
  if (maintenanceBlocked) {
    derivedStatus = "Maintenance";
  } else if (isOccupied) {
    derivedStatus = "Occupied";
  } else if (cleaningActive) {
    derivedStatus = "Cleaning";
  }

  let housekeepingStatus: RoomReadinessResult["housekeepingStatus"] = "Ready";
  if (maintenanceBlocked) {
    housekeepingStatus = "Unavailable";
  } else if (isOccupied) {
    housekeepingStatus = "Occupied";
  } else if (hasOpenHK) {
    housekeepingStatus = "Held by Request";
  } else if (timerActive) {
    housekeepingStatus = "Cleaning";
  }

  let maintenanceStatus: RoomReadinessResult["maintenanceStatus"] = "Clear";
  if (maintenanceBlocked) {
    maintenanceStatus = "Blocked (High/Urgent)";
  } else if (hasLowMedMaintenance) {
    maintenanceStatus = "Low/Medium Open";
  }

  return {
    roomId: input.roomId,
    derivedStatus,
    housekeepingStatus,
    maintenanceStatus,
    // Ready only if Available (not Maintenance, not Occupied, not Cleaning)
    isReadyForCheckIn: derivedStatus === "Available",
    // Booking wizard excludes ONLY Maintenance; routine Cleaning never blocks future bookings
    isBlockedForWizard: derivedStatus === "Maintenance",
    maintenanceBlocked,
    hasLowMedMaintenance,
    cleaningActive,
    cleaningReason,
    cleaningMinutes,
    timerStartedAt: timerActive ? timerStartedAt : null,
    expectedReadyAt: timerActive ? expectedReadyAt : null,
    remainingMinutes,
    openHousekeepingCount: openHK.length,
    openHousekeepingRequests: openHK,
    openHighUrgentMaintenanceCount: openHighUrgent.length,
    openMaintenanceTickets: openMaint,
  };
}

export interface BlockedRoomGuestAlert {
  roomId: number;
  roomDesc: string;
  bookingId: number;
  guestName: string;
  situation: "Checked In" | "Arriving Today";
  ticketDescriptions: string[];
}

export interface AllRoomsReadinessPayload {
  rooms: any[];
  readinessByRoomId: Record<number, RoomReadinessResult>;
  readinessList: RoomReadinessResult[];
  blockedRoomAlerts: BlockedRoomGuestAlert[];
  todaysCheckouts: {
    roomId: number;
    roomDesc: string;
    bookingId: number;
    checkoutTime: string;
    checkoutType: string;
    derivedStatus: DerivedRoomStatus;
    expectedReadyAt: string | null;
  }[];
  housekeepingTableReady: boolean;
}

/**
 * Fetches all room readiness states from Supabase in a small batch of queries.
 * Gracefully degrades if v7 housekeeping_request or cleaning_minutes columns are not yet applied.
 */
export async function fetchAllRoomsReadiness(
  supabaseClient: SupabaseClient,
  nowDate: Date = new Date()
): Promise<AllRoomsReadinessPayload> {
  const todayStr = mauritiusToday();

  const [roomsRes, staysRes, maintRes, hkRes] = await Promise.all([
    supabaseClient
      .from("room")
      .select("*, room_type(*)")
      .order("room_id", { ascending: true }),
    supabaseClient
      .from("check_in_out")
      .select("*, booking(booking_id, booking_status, customer(cust_fname, cust_lname))"),
    supabaseClient
      .from("maintenance_request")
      .select("*")
      .in("request_status", ["Pending", "In Progress", "Open"]),
    supabaseClient
      .from("housekeeping_request")
      .select("*")
      .in("request_status", ["Pending", "In Progress"]),
  ]);

  const rooms = roomsRes.data || [];
  const stays = staysRes.data || [];
  const maintTickets = maintRes.data || [];
  const housekeepingTableReady = !hkRes.error;
  const hkRequests = hkRes.error ? [] : hkRes.data || [];

  const readinessByRoomId: Record<number, RoomReadinessResult> = {};
  const readinessList: RoomReadinessResult[] = [];
  const blockedRoomAlerts: BlockedRoomGuestAlert[] = [];
  const todaysCheckouts: AllRoomsReadinessPayload["todaysCheckouts"] = [];

  for (const room of rooms) {
    const rid = room.room_id;
    const roomStays = stays.filter((s: any) => s.room_room_id === rid);

    // Pick Checked In stay first; otherwise most recently completed stay
    const checkedInStay = roomStays.find((s: any) => s.status === "Checked In");
    const completedStays = roomStays
      .filter((s: any) => s.status === "Checked Out" || s.status === "Auto Checked Out")
      .sort((a: any, b: any) => {
        const aTime = new Date(
          a.status === "Auto Checked Out" ? a.check_out_date : a.actual_check_out || a.check_out_date
        ).getTime();
        const bTime = new Date(
          b.status === "Auto Checked Out" ? b.check_out_date : b.actual_check_out || b.check_out_date
        ).getTime();
        return bTime - aTime;
      });

    const latestStayRaw = checkedInStay || completedStays[0] || null;
    const latestStay: RoomReadinessStayInput | null = latestStayRaw
      ? {
          bookingId: latestStayRaw.booking_booking_id,
          status: latestStayRaw.status || "Scheduled",
          checkInDate: latestStayRaw.check_in_date,
          checkOutDate: latestStayRaw.check_out_date,
          actualCheckIn: latestStayRaw.actual_check_in,
          actualCheckOut: latestStayRaw.actual_check_out,
        }
      : null;

    const roomOpenHK: RoomReadinessHKInput[] = hkRequests
      .filter((h: any) => h.room_room_id === rid)
      .map((h: any) => ({
        hkReqId: h.hk_req_id,
        requestType: h.request_type,
        status: h.request_status,
        description: h.description,
        createdAt: h.created_at,
      }));

    const roomOpenMaint: RoomReadinessMaintInput[] = maintTickets
      .filter((m: any) => m.room_room_id === rid)
      .map((m: any) => ({
        maintenanceId: m.maintenance_id || m.mr_id,
        priority: m.priority,
        status: m.request_status,
        description: m.mr_desc,
      }));

    const cleaningMinutes = Number(room.room_type?.cleaning_minutes) || 45;
    const storedStatus: "Available" | "Maintenance" =
      room.room_status === "Maintenance" ? "Maintenance" : "Available";

    const result = getRoomReadiness({
      roomId: rid,
      storedRoomStatus: storedStatus,
      cleaningMinutes,
      now: nowDate,
      activeOrLastStay: latestStay,
      openHousekeepingRequests: roomOpenHK,
      openMaintenanceTickets: roomOpenMaint,
    });

    readinessByRoomId[rid] = result;
    readinessList.push(result);

    // Record today's checkouts for Housekeeping view
    for (const s of completedStays) {
      const outTime = s.status === "Auto Checked Out" ? s.check_out_date : s.actual_check_out || s.check_out_date;
      if (outTime && instantToMauritiusParts(outTime).dateStr === todayStr) {
        todaysCheckouts.push({
          roomId: rid,
          roomDesc: room.room_desc || `Room #${rid}`,
          bookingId: s.booking_booking_id,
          checkoutTime: outTime,
          checkoutType: s.status,
          derivedStatus: result.derivedStatus,
          expectedReadyAt: result.expectedReadyAt,
        });
      }
    }

    // Reception alert: Room is blocked by Maintenance AND has a Checked In guest or Scheduled arrival today
    if (result.maintenanceBlocked) {
      const impactedStay = roomStays.find((s: any) => {
        const bStatus = s.booking?.booking_status;
        if (bStatus === "Cancelled" || bStatus === "No Show" || bStatus === "Checked Out") {
          return false;
        }
        if (s.status === "Checked In") return true;
        const inDateStr = s.check_in_date ? instantToMauritiusParts(s.check_in_date).dateStr : "";
        return (!s.status || s.status === "Scheduled") && inDateStr === todayStr;
      });

      if (impactedStay) {
        const cust = impactedStay.booking?.customer;
        const guestName = cust ? `${cust.cust_fname} ${cust.cust_lname}`.trim() : "Guest";
        blockedRoomAlerts.push({
          roomId: rid,
          roomDesc: room.room_desc || `Room #${rid}`,
          bookingId: impactedStay.booking_booking_id,
          guestName,
          situation: impactedStay.status === "Checked In" ? "Checked In" : "Arriving Today",
          ticketDescriptions: roomOpenMaint
            .filter((t) => t.priority === "High" || t.priority === "Urgent")
            .map((t) => t.description || `Ticket #${t.maintenanceId}`),
        });
      }
    }
  }

  return {
    rooms,
    readinessByRoomId,
    readinessList,
    blockedRoomAlerts,
    todaysCheckouts,
    housekeepingTableReady,
  };
}

