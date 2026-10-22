// app/admin/service-bookings/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { ServiceBooking, Service, Booking } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  nowInstant,
  mauritiusToday,
  mauritiusToInstant,
  startOfMauritiusDay,
  instantToMauritiusParts,
  formatMauritius,
} from "@/lib/time";
import { SkeletonTable } from "@/components/shared/SkeletonTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Trash2,
  Edit,
  ConciergeBell,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function ServiceBookingsPage() {
  const { user } = useUser();
  const [sbList, setSbList] = useState<ServiceBooking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit / Add Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [selectedSB, setSelectedSB] = useState<ServiceBooking | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Hotel Cancellation Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [sbToCancel, setSbToCancel] = useState<ServiceBooking | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Form State
  const [bookingId, setBookingId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [serviceDate, setServiceDate] = useState<string>("");
  const [timeIn, setTimeIn] = useState<string>("10:00");
  const [timeOut, setTimeOut] = useState<string>("12:00");
  const [numPerson, setNumPerson] = useState<string>("1");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [sbStatus, setSbStatus] = useState<ServiceBooking["sb_status"]>("Pending");
  const [formError, setFormError] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sbRes, sRes, bRes] = await Promise.all([
        supabase.from("service_booking").select("*, service(*), booking(*, customer(*))").order("sb_id", { ascending: false }),
        supabase.from("service").select("*").order("service_name", { ascending: true }),
        supabase.from("booking").select("*, customer(*)").order("booking_id", { ascending: false }),
      ]);

      if (sbRes.data) setSbList(sbRes.data);
      if (sRes.data) setServices(sRes.data);
      if (bRes.data) setBookings(bRes.data);
    } catch (err) {
      console.error("Fetch service bookings error:", err);
    } finally {
      setLoading(false);
    }
  };

  const extractTime = (timeStr: string) => {
    if (!timeStr) return "10:00";
    return instantToMauritiusParts(timeStr).timeStr;
  };

  const handleOpenAdd = () => {
    setSelectedSB(null);
    setBookingId(bookings.length > 0 ? String(bookings[0].booking_id) : "");
    const firstService = services.length > 0 ? services[0] : null;
    setServiceId(firstService ? String(firstService.service_id) : "");
    setServiceDate(mauritiusToday());
    setTimeIn("10:00");
    setTimeOut("11:00");
    setNumPerson("1");
    setTotalAmount(firstService ? String(firstService.price) : "0");
    setSbStatus("Pending");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sb: ServiceBooking) => {
    setSelectedSB(sb);
    setBookingId(String(sb.booking_booking_id));
    setServiceId(String(sb.service_service_id));
    setServiceDate(sb.service_date ? instantToMauritiusParts(sb.service_date).dateStr : mauritiusToday());
    setTimeIn(extractTime(sb.time_in));
    setTimeOut(extractTime(sb.time_out));
    setNumPerson(String(sb.num_person));
    setTotalAmount(String(sb.total_amount));
    setSbStatus(sb.sb_status);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenCancel = (sb: ServiceBooking) => {
    setSbToCancel(sb);
    setCancelReason("Hotel operational / schedule cancellation");
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancelSB = async () => {
    if (!sbToCancel) return;
    setIsCancelling(true);

    try {
      const res = await fetch("/api/cancel-addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: sbToCancel.booking_booking_id,
          itemType: "service",
          itemId: sbToCancel.sb_id,
          reason: cancelReason || "Hotel-initiated cancellation (100% full refund)",
          isHotelInitiated: true,
          userEmail: user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to cancel service booking.");
      }

      setFeedbackMsg({
        type: "success",
        text: `Service booking #${sbToCancel.sb_id} cancelled. 100% refund of ${formatCurrency(data.refundAmount)} processed to guest.`,
      });
      setIsCancelModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error("Cancel service error:", err);
      setFeedbackMsg({
        type: "error",
        text: err.message || "Failed to cancel service booking.",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const persons = parseInt(numPerson);
    const amount = parseFloat(totalAmount);

    if (!bookingId || !serviceId) {
      setFormError("Please select both Booking and Service.");
      return;
    }
    if (isNaN(persons) || persons <= 0) {
      setFormError("Number of persons must be at least 1.");
      return;
    }
    if (timeOut <= timeIn) {
      setFormError("Time Out must be later than Time In.");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setFormError("Total amount must be greater than 0.");
      return;
    }

    setIsSaving(true);
    const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";
    const now = nowInstant();

    const serviceDateClean = serviceDate.includes("T") ? serviceDate.split("T")[0] : serviceDate;
    const timeInInstant = mauritiusToInstant(serviceDateClean, timeIn);
    const timeOutInstant = mauritiusToInstant(serviceDateClean, timeOut);
    const serviceDateInstant = startOfMauritiusDay(serviceDateClean);

    const payload = {
      booking_booking_id: Number(bookingId),
      service_service_id: Number(serviceId),
      service_date: serviceDateInstant,
      time_in: timeInInstant,
      time_out: timeOutInstant,
      num_person: persons,
      total_amount: amount,
      sb_status: sbStatus,
      updated_by_: currentUserEmail,
      date_updated: now,
    };

    try {
      if (selectedSB) {
        const { error } = await supabase.from("service_booking").update(payload).eq("sb_id", selectedSB.sb_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("service_booking").insert([
          {
            ...payload,
            created_by: currentUserEmail,
            date_created: now,
          },
        ]);
        if (error) throw error;
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Save SB error:", err);
      setFormError(err.message || "Failed to save service booking.");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = sbList.filter((sb) => {
    const search = searchTerm.toLowerCase();
    const serviceName = (sb.service?.service_name || "").toLowerCase();
    const custName = `${sb.booking?.customer?.cust_fname || ""} ${sb.booking?.customer?.cust_lname || ""}`.toLowerCase();
    return String(sb.sb_id).includes(search) || serviceName.includes(search) || custName.includes(search);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return <Badge className="bg-amber-500 text-white gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "In Progress":
        return <Badge className="bg-blue-600 text-white gap-1"><Clock className="h-3 w-3" /> In Progress</Badge>;
      case "Completed":
        return <Badge className="bg-emerald-500 text-white gap-1"><CheckCircle className="h-3 w-3" /> Completed</Badge>;
      case "Cancelled":
        return <Badge className="bg-red-500 text-white gap-1"><XCircle className="h-3 w-3" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Service Reservations</h1>
          <p className="text-slate-500 text-sm">Spa, dining, and custom hotel service bookings for guests.</p>
        </div>
        <Button onClick={handleOpenAdd} variant="gold" className="gap-2">
          <Plus className="h-4 w-4" /> Book Service
        </Button>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by Service Booking ID, Service name or Guest..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {loading ? (
        <SkeletonTable rows={5} columns={8} />
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">SB ID</th>
                  <th className="px-4 py-3">Booking & Guest</th>
                  <th className="px-4 py-3">Service Name</th>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Persons</th>
                  <th className="px-4 py-3">Total Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      No service bookings found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((sb) => (
                    <tr key={sb.sb_id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-navy-900">#{sb.sb_id}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">
                          {sb.booking?.customer ? `${sb.booking.customer.cust_fname} ${sb.booking.customer.cust_lname}` : "Guest"}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">Booking #{sb.booking_booking_id}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-navy-900">{sb.service?.service_name || "Service"}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        <div>{formatDate(sb.service_date)}</div>
                        <div className="text-slate-400">{formatMauritius(sb.time_in, "time")} to {formatMauritius(sb.time_out, "time")}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-semibold">{sb.num_person}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{formatCurrency(sb.total_amount)}</td>
                      <td className="px-4 py-3">{getStatusBadge(sb.sb_status)}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(sb)} title="Edit">
                          <Edit className="h-4 w-4 text-slate-600" />
                        </Button>
                        {sb.sb_status !== "Cancelled" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Cancel Service (100% Refund to Guest)"
                            onClick={() => handleOpenCancel(sb)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {filtered.map((sb) => (
              <div key={sb.sb_id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-xs text-[#A37836]">SB #{sb.sb_id}</span>
                  {getStatusBadge(sb.sb_status)}
                </div>
                <div className="font-bold text-navy-900">{sb.service?.service_name}</div>
                <div className="text-xs text-slate-600 flex justify-between">
                  <span>Guest: {sb.booking?.customer?.cust_fname}</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(sb.total_amount)}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenEdit(sb)}>Edit</Button>
                  {sb.sb_status !== "Cancelled" && (
                    <Button variant="destructive" size="sm" onClick={() => handleOpenCancel(sb)}>
                      Cancel (100% Refund)
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Edit / Add Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle>{selectedSB ? "Edit Service Booking" : "Book Service for Guest"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {formError && <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded">{formError}</p>}

            <div className="space-y-2">
              <Label>Select Reservation *</Label>
              <Select value={bookingId} onValueChange={setBookingId} disabled={!!selectedSB}>
                <SelectTrigger><SelectValue placeholder="Select booking..." /></SelectTrigger>
                <SelectContent>
                  {bookings.map((b) => (
                    <SelectItem key={b.booking_id} value={String(b.booking_id)}>
                      #{b.booking_id} - {b.customer ? `${b.customer.cust_fname} ${b.customer.cust_lname}` : "Guest"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select Service *</Label>
              <Select
                value={serviceId}
                onValueChange={(val) => {
                  setServiceId(val);
                  const found = services.find((s) => s.service_id === Number(val));
                  if (found) setTotalAmount(String(found.price * (parseInt(numPerson) || 1)));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select service..." /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.service_id} value={String(s.service_id)}>
                      {s.service_name} (MUR {s.price})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Service Date *</Label>
              <Input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Time In *</Label>
                <Input type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Time Out *</Label>
                <Input type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Number of Persons *</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={numPerson}
                  onChange={(e) => {
                    const np = e.target.value;
                    setNumPerson(np);
                    const found = services.find((s) => s.service_id === Number(serviceId));
                    if (found) setTotalAmount(String(found.price * (parseInt(np) || 1)));
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Total Amount (MUR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Booking Status *</Label>
              <Select value={sbStatus} onValueChange={(val: any) => setSbStatus(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={isSaving}>
                {isSaving ? "Saving..." : selectedSB ? "Save Changes" : "Confirm Booking"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hotel Cancellation with 100% Refund Dialog */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-red-800 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" /> Cancel Service Booking #{sbToCancel?.sb_id}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-red-800 space-y-1">
              <span className="font-bold block">Hotel-Initiated Cancellation (100% Refund):</span>
              <p>
                Cancelling this service reservation will immediately issue a <strong>100% full refund</strong> of {formatCurrency(sbToCancel?.total_amount || 0)} to the guest via Stripe and record the refund entry.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold">Cancellation Reason</Label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Spa maintenance, specialist unavailable"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setIsCancelModalOpen(false)} disabled={isCancelling}>
              Keep Booking
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancelSB}
              disabled={isCancelling}
              className="gap-2"
            >
              {isCancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCancelling ? "Processing Refund..." : "Confirm & Refund 100%"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
