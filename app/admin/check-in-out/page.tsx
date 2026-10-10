// app/admin/check-in-out/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { CheckInOut, Room, Booking } from "@/lib/types";
import { formatDate, cn } from "@/lib/utils";
import { runAutoCheckout } from "@/lib/autoCheckout";
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
import { Plus, Search, Trash2, CalendarCheck, AlertTriangle, RefreshCw, Bot, CheckCircle } from "lucide-react";

export default function CheckInOutPage() {
  const { user } = useUser();
  const [stays, setStays] = useState<CheckInOut[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncingAutoCheckout, setIsSyncingAutoCheckout] = useState<boolean>(false);
  const [autoCheckoutNotice, setAutoCheckoutNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [selectedStay, setSelectedStay] = useState<CheckInOut | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form Fields
  const [roomId, setRoomId] = useState<string>("");
  const [bookingId, setBookingId] = useState<string>("");
  const [checkInDate, setCheckInDate] = useState<string>("");
  const [checkOutDate, setCheckOutDate] = useState<string>("");
  const [inlineError, setInlineError] = useState<string>("");

  useEffect(() => {
    // Run auto checkout on mount to ensure expired stays are handled immediately
    initData();
  }, []);

  const initData = async () => {
    try {
      await runAutoCheckout();
    } catch (e) {
      console.warn("Auto checkout on mount error:", e);
    }
    await fetchData();
  };

  const handleManualAutoCheckoutSync = async () => {
    setIsSyncingAutoCheckout(true);
    setAutoCheckoutNotice(null);
    try {
      const res = await runAutoCheckout();
      if (res.success) {
        if (res.count > 0) {
          setAutoCheckoutNotice(`Auto-checked out ${res.count} overdue reservation${res.count > 1 ? "s" : ""}.`);
        } else {
          setAutoCheckoutNotice("All reservation stays are currently up-to-date.");
        }
      }
      await fetchData();
    } catch (e: any) {
      setAutoCheckoutNotice("Sync failed: " + (e.message || "Unknown error"));
    } finally {
      setIsSyncingAutoCheckout(false);
      setTimeout(() => setAutoCheckoutNotice(null), 6000);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sRes, rRes, bRes] = await Promise.all([
        supabase.from("check_in_out").select("*, room(*), booking(*, customer(*))"),
        supabase.from("room").select("*").order("room_id", { ascending: true }),
        supabase.from("booking").select("*, customer(*)").order("booking_id", { ascending: false }),
      ]);

      if (sRes.data) setStays(sRes.data);
      if (rRes.data) setRooms(rRes.data);
      if (bRes.data) setBookings(bRes.data);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setSelectedStay(null);
    setRoomId(rooms.length > 0 ? String(rooms[0].room_id) : "");
    setBookingId(bookings.length > 0 ? String(bookings[0].booking_id) : "");
    const todayStr = new Date().toISOString().split("T")[0];
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    setCheckInDate(todayStr);
    setCheckOutDate(tomorrowStr);
    setInlineError("");
    setIsModalOpen(true);
  };

  const handleOpenDelete = (stay: CheckInOut) => {
    setSelectedStay(stay);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError("");

    if (!roomId || !bookingId) {
      setInlineError("Please select both Room and Booking.");
      return;
    }
    if (!checkInDate || !checkOutDate) {
      setInlineError("Please select valid check-in and check-out dates.");
      return;
    }
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      setInlineError("Check-out date must be strictly after check-in date.");
      return;
    }

    // 1. Room status verification
    const targetRoom = rooms.find((r) => r.room_id === Number(roomId));
    if (!targetRoom || targetRoom.room_status !== "Available") {
      setInlineError(`Cannot allocate Room #${roomId} - Room status is currently Maintenance/Unavailable.`);
      return;
    }

    // 2. Overlap detection query against check_in_out
    try {
      const { data: existingStays, error: queryError } = await supabase
        .from("check_in_out")
        .select("*")
        .eq("room_room_id", Number(roomId));

      if (queryError) throw queryError;

      const hasOverlap = (existingStays || []).some((s) => {
        if (selectedStay && s.room_room_id === selectedStay.room_room_id && s.booking_booking_id === selectedStay.booking_booking_id) {
          return false;
        }
        return new Date(checkInDate) < new Date(s.check_out_date) && new Date(checkOutDate) > new Date(s.check_in_date);
      });

      if (hasOverlap) {
        setInlineError(`Overlapping stay detected! Room #${roomId} is already occupied or reserved between those dates.`);
        return;
      }

      setIsSaving(true);
      const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";
      const now = new Date().toISOString();

      const { error: insertError } = await supabase.from("check_in_out").insert([
        {
          room_room_id: Number(roomId),
          booking_booking_id: Number(bookingId),
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          created_by: currentUserEmail,
          date_created: now,
          updated_by_: currentUserEmail,
          date_updated: now,
        },
      ]);

      if (insertError) throw insertError;

      await fetchData();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Save stay error:", err);
      setInlineError(err.message || "Failed to process check in/out allocation.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStay) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("check_in_out")
        .delete()
        .eq("room_room_id", selectedStay.room_room_id)
        .eq("booking_booking_id", selectedStay.booking_booking_id);

      if (error) throw error;
      await fetchData();
      setIsDeleteOpen(false);
    } catch (err) {
      console.error("Delete stay error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckIn = async (stay: CheckInOut) => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("check_in_out")
        .update({
          actual_check_in: now,
          status: "Checked In"
        })
        .eq("room_room_id", stay.room_room_id)
        .eq("booking_booking_id", stay.booking_booking_id);

      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      console.error("Check in error:", err);
      alert("Failed to check in: " + err.message);
    }
  };

  const handleCheckOut = async (stay: CheckInOut) => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("check_in_out")
        .update({
          actual_check_out: now,
          status: "Checked Out"
        })
        .eq("room_room_id", stay.room_room_id)
        .eq("booking_booking_id", stay.booking_booking_id);

      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      console.error("Check out error:", err);
      alert("Failed to check out: " + err.message);
    }
  };

  const getStatusBadge = (status?: string | null) => {
    if (status === "Auto Checked Out") {
      return (
        <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-semibold gap-1 text-xs" variant="outline">
          <Bot className="h-3 w-3 text-purple-600" /> Auto Checked Out
        </Badge>
      );
    }
    if (status === "Checked Out") {
      return (
        <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-semibold gap-1 text-xs" variant="outline">
          <CheckCircle className="h-3 w-3 text-slate-500" /> Checked Out
        </Badge>
      );
    }
    if (status === "Checked In") {
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold gap-1 text-xs" variant="outline">
          <CheckCircle className="h-3 w-3 text-emerald-600" /> Checked In
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs" variant="outline">
        Scheduled
      </Badge>
    );
  };

  const filteredStays = stays.filter((s) => {
    const search = searchTerm.toLowerCase();
    const custName = `${s.booking?.customer?.cust_fname || ""} ${s.booking?.customer?.cust_lname || ""}`.toLowerCase();
    const statusText = (s.status || "scheduled").toLowerCase();
    return (
      String(s.room_room_id).includes(search) ||
      String(s.booking_booking_id).includes(search) ||
      custName.includes(search) ||
      statusText.includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Check In / Out Allocations</h1>
          <p className="text-slate-500 text-sm">Assign room stays to confirmed guest bookings with automated checkout and overlap verification.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleManualAutoCheckoutSync}
            variant="outline"
            disabled={isSyncingAutoCheckout}
            className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
            title="Scan and automatically check out past reservations"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncingAutoCheckout ? "animate-spin" : ""}`} />
            {isSyncingAutoCheckout ? "Checking Overdue..." : "Auto-Checkout Check"}
          </Button>
          <Button onClick={handleOpenAdd} variant="gold" className="gap-2">
            <Plus className="h-4 w-4" /> Allocate Room Stay
          </Button>
        </div>
      </div>

      {/* Auto Checkout System Notification Banner */}
      {autoCheckoutNotice && (
        <div className="bg-purple-50 border border-purple-200 text-purple-800 p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-purple-600 shrink-0" />
            <span>{autoCheckoutNotice}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAutoCheckoutNotice(null)} className="text-xs h-7 text-purple-700">
            Dismiss
          </Button>
        </div>
      )}

      {/* Filter */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by Room ID, Booking ID, Guest name, or Status..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Booking & Guest</th>
                  <th className="px-4 py-3">Scheduled Dates</th>
                  <th className="px-4 py-3">Actual Check-In/Out</th>
                  <th className="px-4 py-3">Stay Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredStays.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No room stay allocations recorded.
                    </td>
                  </tr>
                ) : (
                  filteredStays.map((s) => (
                    <tr key={`${s.room_room_id}-${s.booking_booking_id}`} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono text-navy-900 border-navy-300 font-bold">
                          Room #{s.room_room_id}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-navy-900">
                          {s.booking?.customer ? `${s.booking.customer.cust_fname} ${s.booking.customer.cust_lname}` : "Guest"}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">Booking #{s.booking_booking_id}</div>
                      </td>
                      <td className="px-4 py-3 text-xs space-y-1">
                        <div className="text-emerald-700">In: {formatDate(s.check_in_date)}</div>
                        <div className="text-amber-700">Out: {formatDate(s.check_out_date)}</div>
                      </td>
                      <td className="px-4 py-3 text-xs space-y-1">
                        <div>
                          In: {s.actual_check_in ? formatDate(s.actual_check_in) : <span className="text-slate-400 font-normal italic">Not yet</span>}
                        </div>
                        <div>
                          Out: {s.actual_check_out ? (
                            <span>
                              {formatDate(s.actual_check_out)}
                              {s.status === "Auto Checked Out" && (
                                <span className="ml-1 text-[10px] text-purple-700 font-bold">(Auto)</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal italic">Not yet</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(s.status)}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {(!s.status || s.status === "Scheduled") && (
                          <Button size="sm" variant="gold" className="text-xs" onClick={() => handleCheckIn(s)}>
                            Check In
                          </Button>
                        )}
                        {s.status === "Checked In" && (
                          <Button size="sm" variant="outline" className="text-xs border-amber-600 text-amber-600 hover:bg-amber-50" onClick={() => handleCheckOut(s)}>
                            Check Out
                          </Button>
                        )}
                        {s.status === "Auto Checked Out" && (
                          <span className="text-xs text-purple-600 font-semibold mr-2 inline-flex items-center gap-1">
                            <Bot className="h-3 w-3" /> Auto Handled
                          </span>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(s)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden space-y-4">
            {filteredStays.map((s) => (
              <div key={`${s.room_room_id}-${s.booking_booking_id}`} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <Badge variant="outline" className="font-mono font-bold">Room #{s.room_room_id}</Badge>
                  {getStatusBadge(s.status)}
                </div>
                <div className="font-bold text-navy-900">
                  {s.booking?.customer ? `${s.booking.customer.cust_fname} ${s.booking.customer.cust_lname}` : "Guest"}
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Scheduled In:</span>
                    <strong>{formatDate(s.check_in_date)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Scheduled Out:</span>
                    <strong>{formatDate(s.check_out_date)}</strong>
                  </div>
                  {s.actual_check_in && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Actual In:</span>
                      <strong>{formatDate(s.actual_check_in)}</strong>
                    </div>
                  )}
                  {s.actual_check_out && (
                    <div className="flex justify-between text-amber-700">
                      <span>Actual Out:</span>
                      <strong>
                        {formatDate(s.actual_check_out)} {s.status === "Auto Checked Out" ? "(Auto)" : ""}
                      </strong>
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                  {(!s.status || s.status === "Scheduled") && (
                    <Button size="sm" variant="gold" onClick={() => handleCheckIn(s)}>Check In</Button>
                  )}
                  {s.status === "Checked In" && (
                    <Button size="sm" variant="outline" className="border-amber-600 text-amber-600 hover:bg-amber-50" onClick={() => handleCheckOut(s)}>Check Out</Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={() => handleOpenDelete(s)}>Delete</Button>
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
            <DialogTitle>Allocate Room Stay</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {inlineError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Validation Error</strong>
                  {inlineError}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Select Room *</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose room..." />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.room_id} value={String(r.room_id)}>
                      Room #{r.room_id} ({r.room_status}) {r.room_desc ? `- ${r.room_desc}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select Booking *</Label>
              <Select value={bookingId} onValueChange={setBookingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose booking..." />
                </SelectTrigger>
                <SelectContent>
                  {bookings.map((b) => (
                    <SelectItem key={b.booking_id} value={String(b.booking_id)}>
                      Booking #{b.booking_id} - {b.customer ? `${b.customer.cust_fname} ${b.customer.cust_lname}` : "Guest"} ({b.booking_status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Check-In Date *</Label>
                <Input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Check-Out Date *</Label>
                <Input
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={isSaving}>
                {isSaving ? "Allocating..." : "Allocate Room"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete Allocation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Remove stay allocation for <strong>Room #{selectedStay?.room_room_id}</strong> & <strong>Booking #{selectedStay?.booking_booking_id}</strong>?
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
