// app/admin/service-bookings/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { ServiceBooking, Service, Booking } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
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
import { Plus, Search, Trash2, Edit, ConciergeBell, CheckCircle, Clock, XCircle } from "lucide-react";

export default function ServiceBookingsPage() {
  const { user } = useUser();
  const [sbList, setSbList] = useState<ServiceBooking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [selectedSB, setSelectedSB] = useState<ServiceBooking | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form
  const [bookingId, setBookingId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [serviceDate, setServiceDate] = useState<string>("");
  const [timeIn, setTimeIn] = useState<string>("10:00");
  const [timeOut, setTimeOut] = useState<string>("12:00");
  const [numPerson, setNumPerson] = useState<string>("1");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [sbStatus, setSbStatus] = useState<"Pending" | "Confirmed" | "Cancelled" | "Completed">("Pending");
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

  const calculateTotal = (sId: string, personsStr: string) => {
    const s = services.find((srv) => srv.service_id === Number(sId));
    const count = parseInt(personsStr) || 1;
    if (s) {
      setTotalAmount(String((s.price * count).toFixed(2)));
    }
  };

  const handleOpenAdd = () => {
    setSelectedSB(null);
    setBookingId(bookings.length > 0 ? String(bookings[0].booking_id) : "");
    const initialS = services.length > 0 ? String(services[0].service_id) : "";
    setServiceId(initialS);
    setServiceDate(new Date().toISOString().split("T")[0]);
    setTimeIn("10:00");
    setTimeOut("12:00");
    setNumPerson("1");
    if (services.length > 0) {
      setTotalAmount(String(services[0].price.toFixed(2)));
    } else {
      setTotalAmount("0.00");
    }
    setSbStatus("Pending");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sb: ServiceBooking) => {
    setSelectedSB(sb);
    setBookingId(String(sb.booking_booking_id));
    setServiceId(String(sb.service_service_id));
    setServiceDate(sb.service_date.split("T")[0]);
    setTimeIn(sb.time_in);
    setTimeOut(sb.time_out);
    setNumPerson(String(sb.num_person));
    setTotalAmount(String(sb.total_amount));
    setSbStatus(sb.sb_status);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenDelete = (sb: ServiceBooking) => {
    setSelectedSB(sb);
    setIsDeleteOpen(true);
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
    const now = new Date().toISOString();

    const payload = {
      booking_booking_id: Number(bookingId),
      service_service_id: Number(serviceId),
      service_date: serviceDate,
      time_in: timeIn,
      time_out: timeOut,
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

  const handleDelete = async () => {
    if (!selectedSB) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("service_booking").delete().eq("sb_id", selectedSB.sb_id);
      if (error) throw error;
      await fetchData();
      setIsDeleteOpen(false);
    } catch (err) {
      console.error("Delete SB error:", err);
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
      case "Confirmed":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1"><CheckCircle className="h-3 w-3" /> Confirmed</Badge>;
      case "Completed":
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white gap-1"><CheckCircle className="h-3 w-3" /> Completed</Badge>;
      case "Pending":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "Cancelled":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white gap-1"><XCircle className="h-3 w-3" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Service Reservations</h1>
          <p className="text-slate-500 text-sm">Spa, dining, and custom hotel service bookings for guests.</p>
        </div>
        <Button onClick={handleOpenAdd} variant="gold" className="gap-2">
          <Plus className="h-4 w-4" /> Book Service
        </Button>
      </div>

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
                        <div className="text-slate-400">{sb.time_in} - {sb.time_out}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-semibold">{sb.num_person}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{formatCurrency(sb.total_amount)}</td>
                      <td className="px-4 py-3">{getStatusBadge(sb.sb_status)}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(sb)}>
                          <Edit className="h-4 w-4 text-slate-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(sb)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
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
                  <span className="font-mono font-bold text-xs text-gold-600">SB #{sb.sb_id}</span>
                  {getStatusBadge(sb.sb_status)}
                </div>
                <div className="font-bold text-navy-900">{sb.service?.service_name}</div>
                <div className="text-xs text-slate-600 flex justify-between">
                  <span>Guest: {sb.booking?.customer?.cust_fname}</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(sb.total_amount)}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenEdit(sb)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleOpenDelete(sb)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle>{selectedSB ? "Edit Service Booking" : "Book Service for Guest"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {formError && <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded">{formError}</p>}

            <div className="space-y-2">
              <Label>Select Booking *</Label>
              <Select value={bookingId} onValueChange={setBookingId}>
                <SelectTrigger><SelectValue placeholder="Choose booking..." /></SelectTrigger>
                <SelectContent>
                  {bookings.map((b) => (
                    <SelectItem key={b.booking_id} value={String(b.booking_id)}>
                      Booking #{b.booking_id} - {b.customer ? `${b.customer.cust_fname} ${b.customer.cust_lname}` : "Guest"}
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
                  calculateTotal(val, numPerson);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Choose service..." /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.service_id} value={String(s.service_id)}>
                      {s.service_name} (MUR {s.price})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Service Date *</Label>
                <Input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Num Persons *</Label>
                <Input
                  type="number"
                  min="1"
                  value={numPerson}
                  onChange={(e) => {
                    setNumPerson(e.target.value);
                    calculateTotal(serviceId, e.target.value);
                  }}
                  required
                />
              </div>
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
                <Label>Total Amount (MUR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Booking Status *</Label>
                <Select value={sbStatus} onValueChange={(val: any) => setSbStatus(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={isSaving}>
                {isSaving ? "Saving..." : selectedSB ? "Update Booking" : "Save Reservation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete Service Booking</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Delete service booking <strong>#{selectedSB?.sb_id}</strong> for {selectedSB?.service?.service_name}?
          </p>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
