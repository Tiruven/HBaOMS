// app/admin/trip-bookings/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { TripBooking, Trip, Booking } from "@/lib/types";
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
import { Plus, Search, Trash2, Edit, Compass, MapPin } from "lucide-react";

export default function TripBookingsPage() {
  const { user } = useUser();
  const [tbList, setTbList] = useState<TripBooking[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [selectedTB, setSelectedTB] = useState<TripBooking | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form
  const [bookingId, setBookingId] = useState<string>("");
  const [tripId, setTripId] = useState<string>("");
  const [numAdult, setNumAdult] = useState<string>("1");
  const [numChild, setNumChild] = useState<string>("0");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [formError, setFormError] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tbRes, trRes, bRes] = await Promise.all([
        supabase.from("trip_booking").select("*, trip(*, tour(*)), booking(*, customer(*))").order("tb_id", { ascending: false }),
        supabase.from("trip").select("*, tour(*)").order("trip_date", { ascending: false }),
        supabase.from("booking").select("*, customer(*)").order("booking_id", { ascending: false }),
      ]);

      if (tbRes.data) setTbList(tbRes.data);
      if (trRes.data) setTrips(trRes.data);
      if (bRes.data) setBookings(bRes.data);
    } catch (err) {
      console.error("Fetch trip bookings error:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = (trId: string, adultStr: string, childStr: string) => {
    const tr = trips.find((t) => t.trip_id === Number(trId));
    const adultCount = parseInt(adultStr) || 0;
    const childCount = parseInt(childStr) || 0;
    if (tr && tr.tour) {
      const total = adultCount * tr.tour.adult_price + childCount * tr.tour.child_price;
      setTotalAmount(String(total.toFixed(2)));
    }
  };

  const handleOpenAdd = () => {
    setSelectedTB(null);
    setBookingId(bookings.length > 0 ? String(bookings[0].booking_id) : "");
    const initialT = trips.length > 0 ? String(trips[0].trip_id) : "";
    setTripId(initialT);
    setNumAdult("1");
    setNumChild("0");
    if (trips.length > 0 && trips[0].tour) {
      setTotalAmount(String(trips[0].tour.adult_price.toFixed(2)));
    } else {
      setTotalAmount("0.00");
    }
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tb: TripBooking) => {
    setSelectedTB(tb);
    setBookingId(String(tb.booking_booking_id));
    setTripId(String(tb.trip_trip_id));
    setNumAdult(String(tb.num_adult));
    setNumChild(String(tb.num_child));
    setTotalAmount(String(tb.total_amount));
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenDelete = (tb: TripBooking) => {
    setSelectedTB(tb);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const adults = parseInt(numAdult) || 0;
    const children = parseInt(numChild) || 0;
    const amount = parseFloat(totalAmount);

    if (!bookingId || !tripId) {
      setFormError("Please select both Booking and Scheduled Trip.");
      return;
    }
    if (adults + children < 1) {
      setFormError("Total travelers (adults + children) must be at least 1.");
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
      trip_trip_id: Number(tripId),
      num_adult: adults,
      num_child: children,
      total_amount: amount,
      updated_by_: currentUserEmail,
      date_updated: now,
    };

    try {
      if (selectedTB) {
        const { error } = await supabase.from("trip_booking").update(payload).eq("tb_id", selectedTB.tb_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trip_booking").insert([
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
      console.error("Save TB error:", err);
      setFormError(err.message || "Failed to save trip booking.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTB) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("trip_booking").delete().eq("tb_id", selectedTB.tb_id);
      if (error) throw error;
      await fetchData();
      setIsDeleteOpen(false);
    } catch (err) {
      console.error("Delete TB error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = tbList.filter((tb) => {
    const search = searchTerm.toLowerCase();
    const tourName = (tb.trip?.tour?.tour_name || "").toLowerCase();
    const custName = `${tb.booking?.customer?.cust_fname || ""} ${tb.booking?.customer?.cust_lname || ""}`.toLowerCase();
    return String(tb.tb_id).includes(search) || tourName.includes(search) || custName.includes(search);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Trip Excursion Bookings</h1>
          <p className="text-slate-500 text-sm">Guest passenger counts and tickets for scheduled island trips.</p>
        </div>
        <Button onClick={handleOpenAdd} variant="gold" className="gap-2">
          <Plus className="h-4 w-4" /> Book Trip Excursion
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by Ticket ID, Tour name or Guest..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {loading ? (
        <SkeletonTable rows={5} columns={7} />
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">TB ID</th>
                  <th className="px-4 py-3">Booking & Guest</th>
                  <th className="px-4 py-3">Excursion Tour</th>
                  <th className="px-4 py-3">Trip Date</th>
                  <th className="px-4 py-3">Passengers</th>
                  <th className="px-4 py-3">Total Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No trip bookings found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((tb) => (
                    <tr key={tb.tb_id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-navy-900">#{tb.tb_id}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">
                          {tb.booking?.customer ? `${tb.booking.customer.cust_fname} ${tb.booking.customer.cust_lname}` : "Guest"}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">Booking #{tb.booking_booking_id}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-navy-900">{tb.trip?.tour?.tour_name || "Island Tour"}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{tb.trip ? formatDate(tb.trip.trip_date) : "N/A"}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        <strong>{tb.num_adult}</strong> Adult{tb.num_adult > 1 ? "s" : ""}, <strong>{tb.num_child}</strong> Child{tb.num_child > 1 ? "ren" : ""}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{formatCurrency(tb.total_amount)}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(tb)}>
                          <Edit className="h-4 w-4 text-slate-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(tb)}>
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
            {filtered.map((tb) => (
              <div key={tb.tb_id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-xs text-gold-600">Ticket #{tb.tb_id}</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(tb.total_amount)}</span>
                </div>
                <div className="font-bold text-navy-900">{tb.trip?.tour?.tour_name}</div>
                <div className="text-xs text-slate-600">
                  <div><strong>Guest:</strong> {tb.booking?.customer?.cust_fname}</div>
                  <div><strong>Passengers:</strong> {tb.num_adult} A, {tb.num_child} C</div>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenEdit(tb)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleOpenDelete(tb)}>Delete</Button>
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
            <DialogTitle>{selectedTB ? "Edit Trip Booking" : "Reserve Excursion Ticket"}</DialogTitle>
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
              <Label>Select Scheduled Trip *</Label>
              <Select
                value={tripId}
                onValueChange={(val) => {
                  setTripId(val);
                  calculateTotal(val, numAdult, numChild);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Choose trip..." /></SelectTrigger>
                <SelectContent>
                  {trips.map((tr) => (
                    <SelectItem key={tr.trip_id} value={String(tr.trip_id)}>
                      Trip #{tr.trip_id} - {tr.tour?.tour_name} ({formatDate(tr.trip_date)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Num Adults *</Label>
                <Input
                  type="number"
                  min="0"
                  value={numAdult}
                  onChange={(e) => {
                    setNumAdult(e.target.value);
                    calculateTotal(tripId, e.target.value, numChild);
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Num Children *</Label>
                <Input
                  type="number"
                  min="0"
                  value={numChild}
                  onChange={(e) => {
                    setNumChild(e.target.value);
                    calculateTotal(tripId, numAdult, e.target.value);
                  }}
                  required
                />
              </div>
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

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={isSaving}>
                {isSaving ? "Saving..." : selectedTB ? "Update Ticket" : "Save Reservation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete Trip Booking</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Delete ticket <strong>#{selectedTB?.tb_id}</strong> for {selectedTB?.trip?.tour?.tour_name}?
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
