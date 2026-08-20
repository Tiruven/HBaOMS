// components/customer/BookingCard.tsx
import React from "react";
import Link from "next/link";
import { Booking, CheckInOut } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, BedDouble, ChevronRight, CheckCircle, Clock, XCircle } from "lucide-react";

interface BookingCardProps {
  booking: Booking;
  stay?: CheckInOut | null;
}

export const BookingCard: React.FC<BookingCardProps> = ({ booking, stay }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Confirmed":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1"><CheckCircle className="h-3 w-3" /> Confirmed</Badge>;
      case "Pending":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "Cancelled":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white gap-1"><XCircle className="h-3 w-3" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E2DC] p-6 shadow-sm hover:shadow-md transition-shadow space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <span className="text-xs font-mono font-bold text-[#A37836]">Reservation #{booking.booking_id}</span>
          <h3 className="font-bold text-lg text-[#1A202C]">
            {stay?.room?.room_type?.type || "Luxury Suite Stay"}
          </h3>
        </div>
        {getStatusBadge(booking.booking_status)}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs text-slate-600">
        <div>
          <span className="text-slate-400 block font-medium">Board Basis</span>
          <span className="font-bold text-[#1A202C] text-sm">
            {booking.booking_type === "RO" ? "Room Only (RO)" : booking.booking_type === "HB" ? "Half Board (HB)" : "Full Board (FB)"}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Check-In Date</span>
          <span className="font-bold text-[#1A202C] text-sm">{stay ? formatDate(stay.check_in_date) : formatDate(booking.booking_date)}</span>
        </div>
        <div>
          <span className="text-slate-400 block font-medium">Check-Out Date</span>
          <span className="font-bold text-[#1A202C] text-sm">{stay ? formatDate(stay.check_out_date) : "N/A"}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="text-xs text-slate-500 flex items-center gap-1">
          <BedDouble className="h-4 w-4 text-[#A37836]" />
          <span>{stay ? `Assigned Room #${stay.room_room_id}` : "Room Allocation Pending"}</span>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1 border-[#A37836] text-[#A37836] hover:bg-[#F4EFE6]">
          <Link href={`/customer/bookings/${booking.booking_id}`}>
            View Receipt <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
};
