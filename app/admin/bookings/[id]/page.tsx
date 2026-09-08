// app/admin/bookings/[id]/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Booking, CheckInOut, Payment, ServiceBooking, TripBooking } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  CalendarCheck,
  User,
  BedDouble,
  CreditCard,
  ConciergeBell,
  Compass,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Mail,
  Phone,
  Globe,
  Printer,
  Sparkles,
} from "lucide-react";

export default function AdminBookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [stay, setStay] = useState<CheckInOut | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [services, setServices] = useState<ServiceBooking[]>([]);
  const [trips, setTrips] = useState<TripBooking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchAllBookingDetails() {
      if (!bookingId) return;
      setLoading(true);
      try {
        const idNum = Number(bookingId);
        const [bRes, cioRes, pRes, sbRes, tbRes] = await Promise.all([
          supabase.from("booking").select("*, customer(*)").eq("booking_id", idNum).single(),
          supabase.from("check_in_out").select("*, room(*, room_type(*))").eq("booking_booking_id", idNum).maybeSingle(),
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
        console.error("Error loading admin booking detail:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAllBookingDetails();
  }, [bookingId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Confirmed":
        return <Badge className="bg-emerald-500 text-white gap-1"><CheckCircle className="h-3.5 w-3.5" /> Confirmed</Badge>;
      case "Pending":
        return <Badge className="bg-amber-500 text-white gap-1"><Clock className="h-3.5 w-3.5" /> Pending</Badge>;
      case "Cancelled":
        return <Badge className="bg-red-500 text-white gap-1"><XCircle className="h-3.5 w-3.5" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gold-500" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-4">
        <h2 className="text-xl font-bold text-navy-900">Booking Record Not Found</h2>
        <p className="text-sm text-slate-500">Booking #{bookingId} does not exist in the database.</p>
        <Button asChild variant="outline">
          <Link href="/admin/bookings">Back to Bookings Directory</Link>
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
    <div className="space-y-6 pb-16">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/bookings")}>
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-navy-900">Booking #{booking.booking_id}</h1>
              {getStatusBadge(booking.booking_status)}
            </div>
            <p className="text-xs text-slate-500">
              Created on {formatDate(booking.booking_date)} • Board Plan: <strong>{booking.booking_type}</strong>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Print Dossier
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Room & Guest Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Room Accommodation Overview */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-navy-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <BedDouble className="h-4 w-4 text-gold-400" /> Allocated Room Details
              </div>
              <span className="text-xs text-gold-300 font-mono">
                Room #{stay?.room_room_id || "Unassigned"}
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Room Image */}
              <div className="relative h-48 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                <img
                  src={
                    stay?.room?.room_type?.type === "Deluxe Suite"
                      ? "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80"
                      : "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80"
                  }
                  alt="Room preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-navy-900/90 text-white font-black text-sm px-3 py-1 rounded-lg">
                  Room #{stay?.room_room_id || "N/A"}
                </div>
              </div>

              {/* Room Details */}
              <div className="space-y-3">
                <div className="text-xl font-bold text-navy-900">
                  {stay?.room?.room_type?.type || "Standard Resort Suite"}
                </div>
                <div className="text-xs text-slate-500">
                  Base Rate: <strong>{formatCurrency(roomPrice)} / night</strong>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Scheduled Check-In:</span>
                    <strong className="text-navy-900">{stay ? formatDate(stay.check_in_date) : "Not Set"}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Scheduled Check-Out:</span>
                    <strong className="text-navy-900">{stay ? formatDate(stay.check_out_date) : "Not Set"}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Actual Check-In:</span>
                    <span className="text-slate-500">{stay?.actual_check_in ? formatDate(stay.actual_check_in) : "Pending Check-in"}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Actual Check-Out:</span>
                    <span className="text-slate-500">{stay?.actual_check_out ? formatDate(stay.actual_check_out) : "Pending Check-out"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Add-on Services Booked */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-base text-navy-900 flex items-center gap-2">
              <ConciergeBell className="h-5 w-5 text-gold-500" /> Booked Resort Services ({services.length})
            </h3>
            {services.length === 0 ? (
              <p className="text-xs text-slate-400">No extra spa or dining services requested.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {services.map((s) => (
                  <div key={s.sb_id} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{s.service?.service_name || "Service Package"}</div>
                      <div className="text-slate-400">Date: {formatDate(s.service_date)} • Status: {s.sb_status}</div>
                    </div>
                    <div className="font-bold text-navy-900">{formatCurrency(s.total_amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Excursions & Tour Trips Booked */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-base text-navy-900 flex items-center gap-2">
              <Compass className="h-5 w-5 text-gold-500" /> Excursion & Tour Bookings ({trips.length})
            </h3>
            {trips.length === 0 ? (
              <p className="text-xs text-slate-400">No island excursions reserved.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {trips.map((t) => (
                  <div key={`${t.trip_trip_id}-${t.booking_booking_id}`} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{t.trip?.tour?.tour_name || "Island Excursion"}</div>
                      <div className="text-slate-400">Adults: {t.num_adult} • Children: {t.num_child}</div>
                    </div>
                    <div className="font-bold text-navy-900">{formatCurrency(t.total_amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: Customer & Financial Summary */}
        <div className="space-y-6">
          {/* Guest Profile Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-base text-navy-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="h-5 w-5 text-gold-500" /> Guest Details
            </h3>
            <div className="space-y-2 text-xs">
              <div className="font-bold text-sm text-navy-900">
                {booking.customer ? `${booking.customer.cust_fname} ${booking.customer.cust_lname}` : "Guest Customer"}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-3.5 w-3.5 text-slate-400" /> {booking.customer?.email || "N/A"}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-3.5 w-3.5 text-slate-400" /> {booking.customer?.contact_info || "N/A"}
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Globe className="h-3.5 w-3.5 text-slate-400" /> {booking.customer?.nationality || "Mauritian"}
              </div>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-base text-navy-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileText className="h-5 w-5 text-gold-500" /> Financial Summary
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Room Stay:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(roomPrice)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Services Total:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(servicesTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Excursions Total:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(tripsTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-100">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>VAT (15%):</span>
                <span className="font-semibold text-slate-800">{formatCurrency(subtotal * 0.15)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-emerald-600 pt-2 border-t border-slate-200">
                <span>Total Amount:</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payment Logs */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-base text-navy-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard className="h-5 w-5 text-gold-500" /> Payment Logs
            </h3>
            {payments.length === 0 ? (
              <p className="text-xs text-slate-400">No payment transaction records found.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.payment_id || p.pay_id} className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between font-bold text-navy-900">
                      <span>Transaction #{p.payment_id || p.pay_id}</span>
                      <span className="text-emerald-600">{formatCurrency(p.payment_amount || p.amount_paid || 0)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex justify-between">
                      <span>Date: {formatDate(p.payment_date)}</span>
                      <span>Type: {p.payment_type || p.payment_method}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
