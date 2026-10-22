// components/customer/BookingCard.tsx
import React from "react";
import Link from "next/link";
import { Booking, CheckInOut } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, BedDouble, ChevronRight, CheckCircle, Clock, XCircle, Sparkles, Bot } from "lucide-react";

interface BookingCardProps {
  booking: Booking;
  stay?: CheckInOut | null;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking, stay }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Confirmed":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1 text-xs"><CheckCircle className="h-3 w-3" /> Confirmed</Badge>;
      case "Pending":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1 text-xs"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "Checked In":
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white gap-1 text-xs"><CheckCircle className="h-3 w-3" /> Checked In</Badge>;
      case "Checked Out":
        return <Badge className="bg-slate-500 hover:bg-slate-600 text-white gap-1 text-xs"><CheckCircle className="h-3 w-3" /> Checked Out</Badge>;
      case "No Show":
        return <Badge className="bg-purple-600 hover:bg-purple-700 text-white gap-1 text-xs"><XCircle className="h-3 w-3" /> No Show</Badge>;
      case "Cancelled":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white gap-1 text-xs"><XCircle className="h-3 w-3" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getStayStatusBadge = (stayStatus?: string | null) => {
    if (!stayStatus) return null;
    if (stayStatus === "Auto Checked Out") {
      return (
        <Badge className="bg-purple-100 text-purple-800 border border-purple-300 gap-1 text-xs font-semibold">
          <Bot className="h-3 w-3 text-purple-600" /> Auto Checked Out
        </Badge>
      );
    }
    return null;
  };

  const roomNumber = stay?.room_room_id;
  const roomTypeName = stay?.room?.room_type?.type || "Luxury Suite Stay";

  return (
    <div className="bg-white rounded-3xl border border-[#E5E2DC] p-6 sm:p-7 shadow-sm hover:shadow-md transition-all space-y-5 flex flex-col justify-between">
      <div className="space-y-4">
        {/* Top bar with Booking ID and Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#A37836] bg-[#F4EFE6] px-2.5 py-0.5 rounded-md">
              Booking #{booking.booking_id}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(booking.booking_status)}
            {getStayStatusBadge(stay?.status)}
          </div>
        </div>

        {/* Prominent Room Number & Room Name Section */}
        <div className="bg-[#FAF8F5] border border-[#EDE7DE] rounded-2xl p-4 sm:p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#A37836] flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Allocated Room
            </span>
            {roomNumber ? (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#A37836]/15 text-[#A37836]">
                Confirmed Room
              </span>
            ) : (
              <span className="text-xs text-slate-400 italic">Pending Assignment</span>
            )}
          </div>

          <div className="flex items-baseline gap-3 pt-1">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-[#A37836] text-white flex items-center justify-center shadow-sm">
                <BedDouble className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-black text-[#A37836] tracking-tight leading-none">
                  {roomNumber ? `Room #${roomNumber}` : "Room Pending"}
                </div>
              </div>
            </div>
          </div>

          <h3 className="font-extrabold text-lg sm:text-xl text-[#1A202C] tracking-tight pt-1">
            {roomTypeName}
          </h3>
        </div>

        {/* Auto Check Out Notification Callout (if applicable) */}
        {stay?.status === "Auto Checked Out" && (
          <div className="bg-purple-50 border border-purple-200 text-purple-900 rounded-xl p-3 text-xs flex items-center gap-2">
            <Bot className="h-4 w-4 text-purple-600 shrink-0" />
            <span>
              <strong>System Notice:</strong> This stay was automatically checked out at the conclusion of the scheduled reservation.
            </span>
          </div>
        )}

        {/* Dates and Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600 pt-1">
          <div className="bg-slate-50 p-2.5 rounded-xl">
            <span className="text-slate-400 block font-medium text-[11px]">Board Basis</span>
            <span className="font-bold text-[#1A202C] text-sm mt-0.5 block">
              {booking.booking_type === "RO" ? "Room Only (RO)" : booking.booking_type === "HB" ? "Half Board (HB)" : "Full Board (FB)"}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl">
            <span className="text-slate-400 block font-medium text-[11px]">Guests</span>
            <span className="font-bold text-[#1A202C] text-sm mt-0.5 block">
              {booking.num_adults || 1} Adult{(booking.num_adults || 1) > 1 ? "s" : ""}{booking.num_children ? `, ${booking.num_children} Child${booking.num_children > 1 ? "ren" : ""}` : ""}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl">
            <span className="text-slate-400 block font-medium text-[11px]">Check-In</span>
            <span className="font-bold text-[#1A202C] text-sm mt-0.5 block">
              {stay ? formatDate(stay.check_in_date) : formatDate(booking.booking_date)}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl">
            <span className="text-slate-400 block font-medium text-[11px]">Check-Out</span>
            <span className="font-bold text-[#1A202C] text-sm mt-0.5 block">
              {stay ? formatDate(stay.check_out_date) : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
        <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
          <Calendar className="h-3.5 w-3.5 text-[#A37836]" />
          <span>Booked on {formatDate(booking.booking_date)}</span>
        </div>
        <div className="flex items-center gap-2">
          {["Confirmed", "Checked In"].includes(booking.booking_status) && (
            <Button asChild size="sm" className="gap-1 bg-[#A37836] hover:bg-[#8C6328] text-white font-semibold rounded-xl text-xs">
              <Link href={`/customer/bookings/${booking.booking_id}/addons`}>
                <Sparkles className="h-3.5 w-3.5" /> Add Services & Tours
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="gap-1 border-[#A37836] text-[#A37836] hover:bg-[#F4EFE6] font-semibold rounded-xl text-xs">
            <Link href={`/customer/bookings/${booking.booking_id}`}>
              View Receipt <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
