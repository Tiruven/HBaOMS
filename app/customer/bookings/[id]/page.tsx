// app/customer/bookings/[id]/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Booking, CheckInOut, Payment, ServiceBooking, TripBooking } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  Printer,
  ChevronLeft,
  FileText,
  CreditCard,
  BedDouble,
} from "lucide-react";

export default function CustomerBookingDetailPage() {
  const params = useParams();
  const bookingId = params.id;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [stay, setStay] = useState<CheckInOut | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [services, setServices] = useState<ServiceBooking[]>([]);
  const [trips, setTrips] = useState<TripBooking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchDetail() {
      if (!bookingId) return;
      setLoading(true);
      try {
        const idNum = Number(bookingId);
        const [bRes, cioRes, pRes, sbRes, tbRes] = await Promise.all([
          supabase.from("booking").select("*, customer(*)").eq("booking_id", idNum).single(),
          supabase.from("check_in_out").select("*, room(*, room_type(*))").eq("booking_booking_id", idNum).single(),
          supabase.from("payment").select("*").eq("booking_booking_id", idNum),
          supabase.from("service_booking").select("*, service(*)").eq("booking_booking_id", idNum),
          supabase.from("trip_booking").select("*, trip(*, tour(*))").eq("booking_booking_id", idNum),
        ]);

        if (bRes.data) setBooking(bRes.data);
        if (cioRes.data) setStay(cioRes.data);
        if (pRes.data) setPayments(pRes.data);
        if (sbRes.data) setServices(sbRes.data);
        if (tbRes.data) setTrips(tbRes.data);
      } catch (err) {
        console.error("Fetch booking detail error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [bookingId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#A37836]" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-[#E5E2DC] space-y-4">
        <h2 className="text-xl font-bold text-[#1A202C]">Reservation Not Found</h2>
        <p className="text-xs text-slate-500">We could not locate booking ID #{bookingId}.</p>
        <Button asChild variant="outline">
          <Link href="/customer/bookings">Back to Bookings</Link>
        </Button>
      </div>
    );
  }

  const calculateNights = () => {
    if (!stay?.check_in_date || !stay?.check_out_date) return 1;
    const d1 = new Date(stay.check_in_date);
    const d2 = new Date(stay.check_out_date);
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
    return diff > 0 ? diff : 1;
  };

  const nights = calculateNights();
  const baseRate = stay?.room?.room_type?.price || 250;
  const boardSurchargePerNight = booking.booking_type === "HB" ? 1500 : booking.booking_type === "FB" ? 3000 : 0;
  const roomPrice = (baseRate + boardSurchargePerNight) * nights;

  const servicesTotal = services.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const tripsTotal = trips.reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const subtotal = roomPrice + servicesTotal + tripsTotal;
  const grandTotal = subtotal * 1.15;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" className="text-slate-600 hover:text-[#1A202C] gap-1">
          <Link href="/customer/bookings">
            <ChevronLeft className="h-4 w-4" /> Back to My Bookings
          </Link>
        </Button>
        <Button onClick={handlePrint} variant="outline" className="border-[#E5E2DC] text-[#A37836] gap-2">
          <Printer className="h-4 w-4" /> Print Invoice Receipt
        </Button>
      </div>

      {/* Main Receipt Card */}
      <div className="bg-white p-8 rounded-3xl border border-[#E5E2DC] shadow-md space-y-8 print:border-none print:shadow-none">
        {/* Invoice Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-[#A37836]" />
              <span className="font-extrabold text-xl text-[#1A202C]">Le Paradis Royal Resort</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Grand Baie Coastal Road, Mauritius • +230 200 8888</p>
          </div>
          <div className="text-right">
            <Badge className="bg-[#A37836] text-white text-xs mb-1">
              Reservation #{booking.booking_id}
            </Badge>
            <div className="text-xs text-slate-400">Date Issued: {formatDate(booking.booking_date)}</div>
          </div>
        </div>

        {/* Guest & Prominent Room Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-[#F8F7F4] p-6 rounded-2xl border border-[#E5E2DC]">
          <div className="space-y-1 text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider block">Guest Information</span>
            <div className="font-bold text-sm text-[#1A202C]">
              {booking.customer ? `${booking.customer.cust_fname} ${booking.customer.cust_lname}` : "Guest"}
            </div>
            <div className="text-slate-600">{booking.customer?.email}</div>
            <div className="text-slate-600">{booking.customer?.contact_info}</div>
          </div>

          <div className="space-y-1 text-xs border-t sm:border-t-0 sm:border-l sm:pl-6 border-slate-200 pt-4 sm:pt-0">
            <span className="text-slate-400 font-bold uppercase tracking-wider block">Allocated Accommodation</span>
            {/* Prominent Large Room Number Display */}
            <div className="flex items-center gap-2 my-1">
              <BedDouble className="h-6 w-6 text-[#A37836]" />
              <span className="text-2xl font-black text-[#A37836]">
                Room #{stay?.room_room_id || "Unassigned"}
              </span>
            </div>
            <div className="font-bold text-sm text-[#1A202C]">
              {stay?.room?.room_type?.type || "Luxury Suite"}
            </div>
            <div className="text-slate-600 mt-2">
              Check-In: <strong>{stay ? formatDate(stay.check_in_date) : "Pending"}</strong>
            </div>
            <div className="text-slate-600">
              Check-Out: <strong>{stay ? formatDate(stay.check_out_date) : "Pending"}</strong>
            </div>
          </div>
        </div>

        {/* Itemized Invoice Table */}
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-[#1A202C] uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#A37836]" /> Itemized Charges Breakdown
          </h3>
          <table className="w-full text-left text-xs border border-slate-100 rounded-xl overflow-hidden">
            <thead className="bg-[#F4EFE6] text-[#8B6327] uppercase font-bold">
              <tr>
                <th className="p-3">Description</th>
                <th className="p-3">Plan / Type</th>
                <th className="p-3 text-right">Amount (MUR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-3 font-semibold text-[#1A202C]">
                  {stay?.room?.room_type?.type || "Room Stay"} ({nights} night{nights > 1 ? "s" : ""})
                </td>
                <td className="p-3 text-slate-500">Board Plan: {booking.booking_type}</td>
                <td className="p-3 text-right font-bold text-[#1A202C]">
                  {formatCurrency(roomPrice)}
                </td>
              </tr>
              {services.map((s) => (
                <tr key={s.sb_id}>
                  <td className="p-3 font-semibold text-[#1A202C]">{s.service?.service_name || "Service"}</td>
                  <td className="p-3 text-slate-500">Service Booking #{s.sb_id}</td>
                  <td className="p-3 text-right font-bold text-[#1A202C]">{formatCurrency(s.total_amount)}</td>
                </tr>
              ))}
              {trips.map((t) => (
                <tr key={`${t.trip_trip_id}-${t.booking_booking_id}`}>
                  <td className="p-3 font-semibold text-[#1A202C]">{t.trip?.tour?.tour_name || "Excursion"}</td>
                  <td className="p-3 text-slate-500">Trip #{t.trip_trip_id}</td>
                  <td className="p-3 text-right font-bold text-[#1A202C]">{formatCurrency(t.total_amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#F8F7F4] font-bold text-xs">
              <tr className="border-t border-slate-200">
                <td colSpan={2} className="p-3 text-slate-600 text-right">Subtotal:</td>
                <td className="p-3 text-right text-[#1A202C]">{formatCurrency(subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={2} className="p-3 text-slate-600 text-right">VAT (15% Mauritius):</td>
                <td className="p-3 text-right text-[#1A202C]">{formatCurrency(subtotal * 0.15)}</td>
              </tr>
              <tr className="text-sm bg-[#F4EFE6] text-[#A37836]">
                <td colSpan={2} className="p-3 font-extrabold text-right">Grand Total Amount Due:</td>
                <td className="p-3 text-right font-black text-base">{formatCurrency(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Payments Summary */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <h3 className="font-bold text-sm text-[#1A202C] uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[#A37836]" /> Recorded Payments & Transactions
          </h3>
          {payments.length === 0 ? (
            <p className="text-xs text-slate-400">No payment transaction records logged for this reservation.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.payment_id || p.pay_id} className="flex justify-between items-center bg-[#F8F7F4] p-3.5 rounded-xl text-xs border border-slate-100">
                  <div>
                    <span className="font-bold text-[#1A202C]">Transaction #{p.payment_id || p.pay_id}</span>
                    <span className="text-slate-500 block">{formatDate(p.payment_date)} • Method: {p.payment_method || p.payment_type}</span>
                  </div>
                  <div className="font-bold text-emerald-600 text-sm">
                    {formatCurrency(p.payment_amount || p.amount_paid || 0)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
