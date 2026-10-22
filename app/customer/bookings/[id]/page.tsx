// app/customer/bookings/[id]/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Booking, CheckInOut, Payment, ServiceBooking, TripBooking, PricingRule, Refund } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { formatMauritius } from "@/lib/timeUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building,
  Printer,
  ChevronLeft,
  FileText,
  CreditCard,
  BedDouble,
  Sparkles,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCcw,
  Loader2,
  Calendar,
  Compass,
} from "lucide-react";

export default function CustomerBookingDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookingId = params.id;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [stay, setStay] = useState<CheckInOut | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [services, setServices] = useState<ServiceBooking[]>([]);
  const [trips, setTrips] = useState<TripBooking[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Booking cancellation modal state
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string>("");
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string>("");
  const [bookingCancelPreview, setBookingCancelPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  // Single Add-on cancellation modal state
  const [addonCancelItem, setAddonCancelItem] = useState<{
    itemType: "service" | "trip";
    itemId: number;
    name: string;
    totalAmount: number;
  } | null>(null);
  const [addonCancelPreview, setAddonCancelPreview] = useState<any>(null);
  const [isCancellingAddon, setIsCancellingAddon] = useState<boolean>(false);
  const [addonCancelError, setAddonCancelError] = useState<string>("");

  const addonSuccess = searchParams.get("addon_success") === "true";

  const fetchDetail = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const idNum = Number(bookingId);
      const [bRes, cioRes, pRes, sbRes, tbRes, prRes, refRes] = await Promise.all([
        supabase.from("booking").select("*, customer(*)").eq("booking_id", idNum).single(),
        supabase.from("check_in_out").select("*, room(*, room_type(*))").eq("booking_booking_id", idNum).single(),
        supabase.from("payment").select("*").eq("booking_booking_id", idNum).order("payment_id", { ascending: true }),
        supabase.from("service_booking").select("*, service(*)").eq("booking_booking_id", idNum),
        supabase.from("trip_booking").select("*, trip(*, tour(*))").eq("booking_booking_id", idNum),
        supabase.from("pricing_rule").select("*"),
        supabase.from("refund").select("*").eq("booking_booking_id", idNum).order("refund_id", { ascending: true }),
      ]);

      if (bRes.data) setBooking(bRes.data);
      if (cioRes.data) setStay(cioRes.data);
      if (pRes.data) setPayments(pRes.data);
      if (sbRes.data) setServices(sbRes.data);
      if (tbRes.data) setTrips(tbRes.data);
      if (prRes.data) setPricingRules(prRes.data);
      if (refRes.data) setRefunds(refRes.data);
    } catch (err) {
      console.error("Fetch booking detail error:", err);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handlePrint = () => {
    window.print();
  };

  // Open booking cancellation modal with live server preview
  const handleOpenCancelModal = async () => {
    if (!booking) return;
    setIsCancelModalOpen(true);
    setLoadingPreview(true);
    setCancelError("");

    try {
      const res = await fetch("/api/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.booking_id,
          previewOnly: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.preview) {
        setBookingCancelPreview(data);
      }
    } catch (e) {
      console.error("Preview error:", e);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!booking) return;
    setIsCancelling(true);
    setCancelError("");

    try {
      const res = await fetch("/api/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.booking_id,
          reason: cancelReason || "Customer cancellation requested via client portal",
          userEmail: booking.customer?.email,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process cancellation.");
      }

      setCancelSuccessMsg(
        `Reservation cancelled successfully. Total refund issued: ${formatCurrency(data.totalRefundAmount || 0)}.`
      );
      setIsCancelModalOpen(false);
      await fetchDetail();
    } catch (err: any) {
      setCancelError(err.message || "Failed to cancel reservation.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Open single add-on cancellation modal with live server preview
  const handleOpenAddonCancel = async (itemType: "service" | "trip", itemId: number, name: string, totalAmount: number) => {
    setAddonCancelItem({ itemType, itemId, name, totalAmount });
    setAddonCancelPreview(null);
    setAddonCancelError("");

    try {
      const res = await fetch("/api/cancel-addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking?.booking_id,
          itemType,
          itemId,
          previewOnly: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.preview) {
        setAddonCancelPreview(data);
      }
    } catch (e) {
      console.error("Add-on preview error:", e);
    }
  };

  const handleConfirmAddonCancel = async () => {
    if (!addonCancelItem || !booking) return;
    setIsCancellingAddon(true);
    setAddonCancelError("");

    try {
      const res = await fetch("/api/cancel-addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.booking_id,
          itemType: addonCancelItem.itemType,
          itemId: addonCancelItem.itemId,
          reason: "Cancelled by guest via client portal",
          userEmail: booking.customer?.email,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to cancel add-on item.");
      }

      setCancelSuccessMsg(
        `${addonCancelItem.name} cancelled successfully. Refund of ${formatCurrency(data.refundAmount)} processed.`
      );
      setAddonCancelItem(null);
      await fetchDetail();
    } catch (err: any) {
      setAddonCancelError(err.message || "Failed to cancel add-on.");
    } finally {
      setIsCancellingAddon(false);
    }
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
  const rawBaseRate = stay?.room?.room_type?.price || 250;
  const activeRule = pricingRules.find((p) => {
    if (!stay?.room?.room_type_room_type_id || p.room_type_room_type_id !== stay.room.room_type_room_type_id) return false;
    const ruleStart = p.start_date.split("T")[0];
    const ruleEnd = p.end_date.split("T")[0];
    const stayIn = stay.check_in_date ? stay.check_in_date.split("T")[0] : "";
    const stayOut = stay.check_out_date ? stay.check_out_date.split("T")[0] : "";
    return stayIn <= ruleEnd && stayOut >= ruleStart;
  });

  const baseRate = activeRule ? Math.round(rawBaseRate * (1 + activeRule.rate_override / 100)) : rawBaseRate;
  const boardSurchargePerNight = booking.booking_type === "HB" ? 1500 : booking.booking_type === "FB" ? 3000 : 0;
  const roomPrice = (baseRate + boardSurchargePerNight) * nights;

  const servicesTotal = services.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const tripsTotal = trips.reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const subtotal = roomPrice + servicesTotal + tripsTotal;
  const grandTotal = Math.round(subtotal * 1.15 * 100) / 100;

  const canCancel = booking.booking_status === "Confirmed" || booking.booking_status === "Pending";
  const canAddServices = booking.booking_status === "Confirmed" || booking.booking_status === "Checked In";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Button asChild variant="ghost" className="text-slate-600 hover:text-[#1A202C] gap-1 self-start">
          <Link href="/customer/bookings">
            <ChevronLeft className="h-4 w-4" /> Back to My Bookings
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {canAddServices && (
            <Button asChild variant="gold" className="rounded-xl gap-2 text-xs font-bold">
              <Link href={`/customer/bookings/${booking.booking_id}/addons`}>
                <Sparkles className="h-4 w-4" /> Add Services & Tours
              </Link>
            </Button>
          )}
          {canCancel && (
            <Button
              onClick={handleOpenCancelModal}
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-xl"
            >
              Cancel Reservation
            </Button>
          )}
          <Button onClick={handlePrint} variant="outline" className="border-[#E5E2DC] text-[#A37836] gap-2 text-xs font-semibold rounded-xl">
            <Printer className="h-4 w-4" /> Print Invoice Receipt
          </Button>
        </div>
      </div>

      {addonSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-2 text-xs font-semibold">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Add-on services and excursions confirmed successfully! Your receipt has been updated below.</span>
        </div>
      )}

      {cancelSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-2 text-xs font-semibold">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{cancelSuccessMsg}</span>
        </div>
      )}

      {/* Cancelled Booking Banner */}
      {booking.booking_status === "Cancelled" && (
        <div className="bg-red-50 border border-red-200 p-6 rounded-3xl space-y-2">
          <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
            <XCircle className="h-5 w-5 text-red-600" />
            <span>This reservation has been cancelled.</span>
          </div>
          {booking.cancellation_reason && (
            <p className="text-xs text-red-700">
              Reason: <strong>{booking.cancellation_reason}</strong>
            </p>
          )}
          {booking.cancelled_at && (
            <p className="text-[11px] text-red-500">
              Cancelled on: {formatDate(booking.cancelled_at)}
            </p>
          )}
        </div>
      )}

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
            <Badge className={`${booking.booking_status === "Cancelled" ? "bg-red-500" : "bg-[#A37836]"} text-white text-xs mb-1`}>
              Reservation #{booking.booking_id} ({booking.booking_status})
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
            <div className="text-slate-500 pt-2 font-medium">
              Room Occupancy: <strong>{booking.num_adults || 1} Adult(s)</strong>, <strong>{booking.num_children || 0} Child(ren)</strong>
            </div>
          </div>

          <div className="space-y-1 text-xs border-t sm:border-t-0 sm:border-l sm:pl-6 border-slate-200 pt-4 sm:pt-0">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-bold uppercase tracking-wider block">Allocated Accommodation</span>
              {stay?.status && (
                <Badge variant="outline" className="text-[10px] font-semibold">
                  {stay.status}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 my-1">
              <BedDouble className="h-6 w-6 text-[#A37836]" />
              <span className="text-2xl font-black text-[#A37836]">
                Room #{stay?.room_room_id || "Unassigned"}
              </span>
            </div>
            <div className="font-bold text-base text-[#1A202C]">
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

        {/* Itemized Invoice Table (Decision F.1: room line, each add-on as its own line with date/time, status, amount paid, and if cancelled refund details) */}
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-[#1A202C] uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#A37836]" /> Itemized Charges Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-100 rounded-xl overflow-hidden">
              <thead className="bg-[#F4EFE6] text-[#8B6327] uppercase font-bold">
                <tr>
                  <th className="p-3">Item Description</th>
                  <th className="p-3">Schedule / Status</th>
                  <th className="p-3 text-right">Amount (MUR)</th>
                  <th className="p-3 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Room Line */}
                <tr>
                  <td className="p-3 font-semibold text-[#1A202C]">
                    <div>{stay?.room?.room_type?.type || "Room Stay"} ({nights} night{nights > 1 ? "s" : ""})</div>
                    <div className="text-[10px] text-slate-400">
                      Room #{stay?.room_room_id} • {booking.num_adults || 1} Adult(s), {booking.num_children || 0} Child(ren)
                    </div>
                    {activeRule && (
                      <div className="text-[10px] text-amber-700 font-normal">
                        Seasonal {activeRule.rate_override > 0 ? `+${activeRule.rate_override}%` : `${activeRule.rate_override}%`} ({activeRule.reason}) applied ({formatCurrency(baseRate)}/nt)
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-slate-500">
                    <div>Plan: {booking.booking_type}</div>
                    <Badge variant="outline" className="text-[10px] mt-0.5">
                      {booking.booking_status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right font-bold text-[#1A202C]">
                    {formatCurrency(roomPrice)}
                  </td>
                  <td className="p-3 text-center print:hidden text-slate-400">
                    -
                  </td>
                </tr>

                {/* Services Lines */}
                {services.map((s) => {
                  const linkedRefund = refunds.find((r) => r.service_booking_id === s.sb_id);
                  const isCancelled = s.sb_status === "Cancelled";

                  return (
                    <tr key={s.sb_id} className={isCancelled ? "bg-red-50/40" : ""}>
                      <td className="p-3 font-semibold text-[#1A202C]">
                        <div>{s.service?.service_name || "Hotel Service"}</div>
                        <div className="text-[10px] text-slate-400">
                          {s.num_person} person(s) • Date: {formatDate(s.service_date)}
                          {s.service?.service_type === "scheduled" && ` (${formatMauritius(s.time_in, "time")} - ${formatMauritius(s.time_out, "time")})`}
                        </div>
                        {linkedRefund && (
                          <div className="text-[10px] text-red-600 font-bold mt-0.5">
                            Refunded: {formatCurrency(linkedRefund.refund_amount)} ({linkedRefund.refund_percentage}%)
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge
                          className={`text-[10px] ${
                            isCancelled ? "bg-red-100 text-red-700 border-red-200" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {s.sb_status}
                        </Badge>
                        {isCancelled && s.cancelled_at && (
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            Cancelled {formatDate(s.cancelled_at)}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold text-[#1A202C]">
                        <span className={isCancelled ? "line-through text-slate-400" : ""}>
                          {formatCurrency(s.total_amount)}
                        </span>
                      </td>
                      <td className="p-3 text-center print:hidden">
                        {!isCancelled && canCancel && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleOpenAddonCancel(
                                "service",
                                s.sb_id,
                                s.service?.service_name || "Service",
                                s.total_amount
                              )
                            }
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px] h-7 px-2"
                          >
                            Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Excursion Trips Lines */}
                {trips.map((t, idx) => {
                  const linkedRefund = refunds.find((r) => r.trip_trip_id === t.trip_trip_id);
                  const isCancelled = t.tb_status === "Cancelled" || booking.booking_status === "Cancelled";

                  return (
                    <tr key={`${t.trip_trip_id}-${idx}`} className={isCancelled ? "bg-red-50/40" : ""}>
                      <td className="p-3 font-semibold text-[#1A202C]">
                        <div>{t.trip?.tour?.tour_name || "Island Excursion"}</div>
                        <div className="text-[10px] text-slate-400">
                          {t.num_adult} Adult(s), {t.num_child} Child(ren) (under 12) • Departure: {formatDate(t.trip?.trip_date)}
                          {t.trip?.start_time && ` (${formatMauritius(t.trip.start_time, "time")})`}
                        </div>
                        {linkedRefund && (
                          <div className="text-[10px] text-red-600 font-bold mt-0.5">
                            Refunded: {formatCurrency(linkedRefund.refund_amount)} ({linkedRefund.refund_percentage}%)
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge
                          className={`text-[10px] ${
                            isCancelled ? "bg-red-100 text-red-700 border-red-200" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {t.tb_status || "Pending"}
                        </Badge>
                        {isCancelled && t.cancelled_at && (
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            Cancelled {formatDate(t.cancelled_at)}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold text-[#1A202C]">
                        <span className={isCancelled ? "line-through text-slate-400" : ""}>
                          {formatCurrency(t.total_amount)}
                        </span>
                      </td>
                      <td className="p-3 text-center print:hidden">
                        {!isCancelled && canCancel && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleOpenAddonCancel(
                                "trip",
                                t.trip_trip_id,
                                t.trip?.tour?.tour_name || "Excursion Trip",
                                t.total_amount
                              )
                            }
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 text-[11px] h-7 px-2"
                          >
                            Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#F8F7F4] font-bold text-xs">
                <tr className="border-t border-slate-200">
                  <td colSpan={2} className="p-3 text-slate-600 text-right">Subtotal:</td>
                  <td className="p-3 text-right text-[#1A202C]">{formatCurrency(subtotal)}</td>
                  <td className="print:hidden"></td>
                </tr>
                <tr>
                  <td colSpan={2} className="p-3 text-slate-600 text-right">VAT (15% Mauritius):</td>
                  <td className="p-3 text-right text-[#1A202C]">{formatCurrency(subtotal * 0.15)}</td>
                  <td className="print:hidden"></td>
                </tr>
                <tr className="text-sm bg-[#F4EFE6] text-[#A37836]">
                  <td colSpan={2} className="p-3 font-extrabold text-right">Grand Total:</td>
                  <td className="p-3 text-right font-black text-base">{formatCurrency(grandTotal)}</td>
                  <td className="print:hidden"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Payments & Receipts Summary (Decision F.2: one receipt per payment, and cancellations with refunds) */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <h3 className="font-bold text-sm text-[#1A202C] uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[#A37836]" /> Separate Payment Receipts & Refund Records
          </h3>
          {payments.length === 0 ? (
            <p className="text-xs text-slate-400">No payment transaction records logged for this reservation.</p>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => {
                const linkedRefunds = refunds.filter((r) => r.payment_payment_id === (p.payment_id || p.pay_id));
                return (
                  <div key={p.payment_id || p.pay_id} className="bg-[#F8F7F4] p-4 rounded-2xl text-xs border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-[#1A202C]">
                          Payment Receipt #{p.payment_id || p.pay_id}
                        </span>
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          {p.payment_type || "Booking"}
                        </Badge>
                        <span className="text-slate-500 block mt-0.5">
                          {formatDate(p.payment_date)} • Method: {p.payment_method || "Online"}
                          {p.stripe_session_id && ` • Stripe Ref: ${p.stripe_session_id.substring(0, 16)}...`}
                        </span>
                      </div>
                      <div className="font-bold text-emerald-600 text-sm">
                        {formatCurrency(p.payment_amount || p.amount_paid || 0)}
                      </div>
                    </div>

                    {/* Linked Refunds */}
                    {linkedRefunds.map((ref) => (
                      <div key={ref.refund_id} className="bg-red-50 p-2.5 rounded-xl border border-red-200 flex justify-between items-center text-xs">
                        <div className="text-red-800">
                          <span className="font-bold flex items-center gap-1">
                            <RefreshCcw className="h-3 w-3 text-red-600" /> Refund #{ref.refund_id} ({ref.refund_status})
                            <Badge className="bg-red-600 text-white text-[9px] py-0">{ref.refund_percentage || 100}%</Badge>
                          </span>
                          <span className="text-[11px] text-red-600 block">
                            {ref.refund_reason || "Item cancellation refund"} • Proportional VAT Refund: {formatCurrency(ref.vat_amount || 0)} • {formatDate(ref.refund_date)}
                          </span>
                        </div>
                        <span className="font-bold text-red-700">-{formatCurrency(ref.refund_amount)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Whole Reservation Cancellation Confirmation Dialog with Live Preview */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-800 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" /> Cancel Reservation #{booking.booking_id}
            </DialogTitle>
          </DialogHeader>

          {cancelError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
              {cancelError}
            </div>
          )}

          <div className="space-y-4 text-xs py-2">
            {loadingPreview ? (
              <div className="flex items-center justify-center p-6 gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Computing graduated cancellation refund preview...</span>
              </div>
            ) : bookingCancelPreview ? (
              <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#EDE7DE] space-y-3">
                <span className="font-bold text-[#1A202C] block">Graduated Refund Preview:</span>
                <div className="space-y-2 border-b border-slate-200 pb-3">
                  {bookingCancelPreview.items?.map((it: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-start text-[11px]">
                      <div>
                        <span className="font-bold text-slate-800 block">{it.name}</span>
                        <span className="text-slate-500">{it.explanation}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-800 block">{formatCurrency(it.refundAmount)}</span>
                        <span className="text-[10px] text-slate-400">({it.refundPercent}% refund)</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-1 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Total Originally Paid:</span>
                    <span className="font-bold">{formatCurrency(bookingCancelPreview.totalPaid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Proportional VAT Refund:</span>
                    <span className="font-bold">{formatCurrency(bookingCancelPreview.totalVatRefund)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-extrabold pt-2 border-t border-slate-200 text-sm">
                    <span>Total Refund to Stripe:</span>
                    <span>{formatCurrency(bookingCancelPreview.totalRefundAmount)}</span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="cancelReason" className="font-semibold text-slate-700">Reason for cancellation (Optional)</Label>
              <Input
                id="cancelReason"
                placeholder="e.g. Flight rescheduling, personal emergency..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsCancelModalOpen(false)} disabled={isCancelling}>
              Keep Reservation
            </Button>
            <Button variant="destructive" onClick={handleConfirmCancel} disabled={isCancelling} className="gap-2">
              {isCancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCancelling ? "Processing..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Add-on Item Cancellation Confirmation Dialog with Live Preview */}
      <Dialog open={Boolean(addonCancelItem)} onOpenChange={() => setAddonCancelItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-800 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" /> Cancel {addonCancelItem?.name}
            </DialogTitle>
          </DialogHeader>

          {addonCancelError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
              {addonCancelError}
            </div>
          )}

          <div className="space-y-4 text-xs py-2">
            {addonCancelPreview ? (
              <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#EDE7DE] space-y-2">
                <span className="font-bold text-[#1A202C] block">Cancellation Ladder Breakdown:</span>
                <p className="text-slate-600">{addonCancelPreview.explanation}</p>
                <div className="pt-2 border-t border-slate-200 space-y-1">
                  <div className="flex justify-between">
                    <span>Original Item Amount:</span>
                    <span className="font-bold">{formatCurrency(addonCancelPreview.originalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Refund Percentage:</span>
                    <span className="font-bold">{addonCancelPreview.refundPercent}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Proportional VAT Refund:</span>
                    <span className="font-bold">{formatCurrency(addonCancelPreview.vatAmount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-extrabold pt-1 border-t border-slate-200 text-sm">
                    <span>Refund Issued to Stripe:</span>
                    <span>{formatCurrency(addonCancelPreview.refundAmount)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center p-4 gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Computing add-on refund preview...</span>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setAddonCancelItem(null)} disabled={isCancellingAddon}>
              Keep Add-on
            </Button>
            <Button variant="destructive" onClick={handleConfirmAddonCancel} disabled={isCancellingAddon} className="gap-2">
              {isCancellingAddon && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCancellingAddon ? "Processing..." : "Confirm Item Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
