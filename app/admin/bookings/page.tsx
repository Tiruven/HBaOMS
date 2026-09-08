// app/admin/bookings/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Booking, Customer } from "@/lib/types";
import { formatDate } from "@/lib/utils";
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
import Link from "next/link";
import { Plus, Search, Calendar, User, Trash2, Edit, CheckCircle, Clock, XCircle, Eye } from "lucide-react";

export default function BookingsPage() {
  const { user } = useUser();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form State
  const [customerId, setCustomerId] = useState<string>("");
  const [bookingDate, setBookingDate] = useState<string>("");
  const [bookingStatus, setBookingStatus] = useState<"Pending" | "Confirmed" | "Cancelled">("Pending");
  const [bookingType, setBookingType] = useState<"RO" | "HB" | "FB">("RO");
  const [formError, setFormError] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, cRes] = await Promise.all([
        supabase.from("booking").select("*, customer(*)").order("booking_id", { ascending: false }),
        supabase.from("customer").select("*").order("cust_fname", { ascending: true }),
      ]);

      if (bRes.data) setBookings(bRes.data);
      if (cRes.data) setCustomers(cRes.data);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setSelectedBooking(null);
    setCustomerId(customers.length > 0 ? String(customers[0].cust_id) : "");
    setBookingDate(new Date().toISOString().split("T")[0]);
    setBookingStatus("Pending");
    setBookingType("RO");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (booking: Booking) => {
    setSelectedBooking(booking);
    setCustomerId(String(booking.customer_cust_id));
    setBookingDate(booking.booking_date.split("T")[0]);
    setBookingStatus(booking.booking_status);
    setBookingType(booking.booking_type);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenDelete = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!customerId) {
      setFormError("Please select a customer.");
      return;
    }
    if (!bookingDate) {
      setFormError("Please select a booking date.");
      return;
    }

    // Application validation: date cannot be in the past for new booking
    const selectedD = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedD < today && !selectedBooking) {
      setFormError("Booking date cannot be in the past.");
      return;
    }

    setIsSaving(true);
    const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";
    const now = new Date().toISOString();

    try {
      if (selectedBooking) {
        // UPDATE
        const { error } = await supabase
          .from("booking")
          .update({
            customer_cust_id: Number(customerId),
            booking_date: bookingDate,
            booking_status: bookingStatus,
            booking_type: bookingType,
            updated_by_: currentUserEmail,
            date_updated: now,
          })
          .eq("booking_id", selectedBooking.booking_id);

        if (error) throw error;
      } else {
        // CREATE
        const { error } = await supabase.from("booking").insert([
          {
            customer_cust_id: Number(customerId),
            booking_date: bookingDate,
            booking_status: bookingStatus,
            booking_type: bookingType,
            created_by: currentUserEmail,
            date_created: now,
            updated_by_: currentUserEmail,
            date_updated: now,
          },
        ]);

        if (error) throw error;
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Save error:", err);
      setFormError(err.message || "Failed to save booking.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBooking) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("booking").delete().eq("booking_id", selectedBooking.booking_id);
      if (error) throw error;
      await fetchData();
      setIsDeleteOpen(false);
    } catch (err: any) {
      console.error("Delete error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    const custName = `${b.customer?.cust_fname || ""} ${b.customer?.cust_lname || ""}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    return custName.includes(search) || String(b.booking_id).includes(search) || b.booking_type.toLowerCase().includes(search);
  });

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Guest Bookings</h1>
          <p className="text-slate-500 text-sm">Manage hotel reservations, booking board types, and statuses.</p>
        </div>
        <Button onClick={handleOpenAdd} variant="gold" className="gap-2">
          <Plus className="h-4 w-4" /> New Booking
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by customer name, ID or type..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <SkeletonTable rows={5} columns={7} />
      ) : (
        <>
          {/* Desktop Table view */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Booking Date</th>
                  <th className="px-4 py-3">Board Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No bookings found.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr key={b.booking_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-navy-900">#{b.booking_id}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {b.customer ? `${b.customer.cust_fname} ${b.customer.cust_lname}` : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(b.booking_date)}</td>
                      <td className="px-4 py-3 font-semibold text-gold-600">{b.booking_type}</td>
                      <td className="px-4 py-3">{getStatusBadge(b.booking_status)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{b.created_by || "System"}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button asChild variant="ghost" size="sm" title="View Full Booking Details">
                          <Link href={`/admin/bookings/${b.booking_id}`}>
                            <Eye className="h-4 w-4 text-gold-600" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(b)} title="Edit Booking">
                          <Edit className="h-4 w-4 text-slate-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(b)} title="Delete Booking">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card fallback */}
          <div className="md:hidden space-y-4">
            {filteredBookings.map((b) => (
              <div key={b.booking_id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono font-bold text-xs text-gold-600">#{b.booking_id}</span>
                    <h3 className="font-bold text-navy-900 text-base">
                      {b.customer ? `${b.customer.cust_fname} ${b.customer.cust_lname}` : "Unknown Guest"}
                    </h3>
                  </div>
                  {getStatusBadge(b.booking_status)}
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div><strong className="text-slate-700">Date:</strong> {formatDate(b.booking_date)}</div>
                  <div><strong className="text-slate-700">Type:</strong> {b.booking_type}</div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="outline" size="sm" onClick={() => handleOpenEdit(b)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleOpenDelete(b)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle>{selectedBooking ? "Edit Booking" : "Create New Reservation"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {formError && <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded">{formError}</p>}
            
            <div className="space-y-2">
              <Label>Select Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.cust_id} value={String(c.cust_id)}>
                      {c.cust_fname} {c.cust_lname} ({c.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Booking Date *</Label>
              <Input
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Board Type *</Label>
                <Select value={bookingType} onValueChange={(val: any) => setBookingType(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RO">RO (Room Only)</SelectItem>
                    <SelectItem value="HB">HB (Half Board)</SelectItem>
                    <SelectItem value="FB">FB (Full Board)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Booking Status *</Label>
                <Select value={bookingStatus} onValueChange={(val: any) => setBookingStatus(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={isSaving}>
                {isSaving ? "Saving..." : selectedBooking ? "Update Booking" : "Create Booking"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Are you sure you want to delete booking <strong>#{selectedBooking?.booking_id}</strong>?
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
