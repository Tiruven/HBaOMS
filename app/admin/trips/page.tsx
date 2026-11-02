// app/admin/trips/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Trip, Tour } from "@/lib/types";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  nowInstant,
  mauritiusToday,
  mauritiusToInstant,
  startOfMauritiusDay,
  instantToMauritiusParts,
  formatMauritius,
  addDaysToMauritiusDate,
} from "@/lib/time";
import { SkeletonTable } from "@/components/shared/SkeletonTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Compass,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCcw,
  Loader2,
  Layers,
} from "lucide-react";

const WEEKDAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

export default function TripsPage() {
  const { user } = useUser();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Single Trip Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form State
  const [tourId, setTourId] = useState<string>("");
  const [tripDate, setTripDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("09:00");
  const [returnTime, setReturnTime] = useState<string>("16:00");
  const [tripStatus, setTripStatus] = useState<Trip["trip_status"]>("Pending");
  const [capacity, setCapacity] = useState<number>(20);
  const [formError, setFormError] = useState<string>("");

  // Bulk Schedule Modal State
  const [isBulkOpen, setIsBulkOpen] = useState<boolean>(false);
  const [bulkTourId, setBulkTourId] = useState<string>("");
  const [bulkStartDate, setBulkStartDate] = useState<string>("");
  const [bulkEndDate, setBulkEndDate] = useState<string>("");
  const [bulkWeekdays, setBulkWeekdays] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri default
  const [bulkStartTime, setBulkStartTime] = useState<string>("09:00");
  const [bulkReturnTime, setBulkReturnTime] = useState<string>("16:00");
  const [bulkCapacity, setBulkCapacity] = useState<number>(20);
  const [bulkSaving, setBulkSaving] = useState<boolean>(false);
  const [bulkError, setBulkError] = useState<string>("");

  // Hotel-initiated Trip Cancellation Modal
  const [isCancelTripOpen, setIsCancelTripOpen] = useState<boolean>(false);
  const [tripToCancel, setTripToCancel] = useState<Trip | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trRes, tRes] = await Promise.all([
        supabase.from("trip").select("*, tour(*)").order("trip_id", { ascending: false }),
        supabase.from("tour").select("*").order("tour_name", { ascending: true }),
      ]);

      if (trRes.data) setTrips(trRes.data);
      if (tRes.data) setTours(tRes.data);
    } catch (err) {
      console.error("Fetch trips error:", err);
    } finally {
      setLoading(false);
    }
  };

  const extractTime = (timeStr: string) => {
    if (!timeStr) return "09:00";
    return instantToMauritiusParts(timeStr).timeStr;
  };

  const formatTimeDisplay = (timeStr: string) => {
    if (!timeStr) return "";
    return formatMauritius(timeStr, "time");
  };

  const handleOpenAdd = () => {
    setSelectedTrip(null);
    setTourId(tours.length > 0 ? String(tours[0].tour_id) : "");
    setTripDate(mauritiusToday());
    setStartTime("09:00");
    setReturnTime("16:00");
    setTripStatus("Pending");
    setCapacity(20);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: Trip) => {
    setSelectedTrip(t);
    setTourId(String(t.tour_tour_id));
    setTripDate(t.trip_date ? instantToMauritiusParts(t.trip_date).dateStr : mauritiusToday());
    setStartTime(extractTime(t.start_time));
    setReturnTime(extractTime(t.return_time));
    setTripStatus(t.trip_status);
    setCapacity(t.capacity || 20);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenBulk = () => {
    const todayStr = mauritiusToday();
    const endStr = addDaysToMauritiusDate(todayStr, 30);
    setBulkTourId(tours.length > 0 ? String(tours[0].tour_id) : "");
    setBulkStartDate(todayStr);
    setBulkEndDate(endStr);
    setBulkWeekdays([1, 3, 5]);
    setBulkStartTime("09:00");
    setBulkReturnTime("16:00");
    setBulkCapacity(20);
    setBulkError("");
    setIsBulkOpen(true);
  };

  const handleToggleWeekday = (dayVal: number) => {
    setBulkWeekdays((prev) =>
      prev.includes(dayVal) ? prev.filter((d) => d !== dayVal) : [...prev, dayVal]
    );
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkError("");

    if (!bulkTourId) {
      setBulkError("Please select a tour.");
      return;
    }
    if (!bulkStartDate || !bulkEndDate || bulkEndDate < bulkStartDate) {
      setBulkError("Please enter a valid date range.");
      return;
    }
    if (bulkWeekdays.length === 0) {
      setBulkError("Please select at least one weekday.");
      return;
    }
    if (bulkReturnTime <= bulkStartTime) {
      setBulkError("Return time must be after start time.");
      return;
    }

    setBulkSaving(true);
    const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";
    const now = nowInstant();

    try {
      // Loop over date range
      const departuresToInsert = [];
      let currentStr = bulkStartDate;
      let count = 0;

      while (currentStr <= bulkEndDate && count < 180) {
        count++;
        // Calculate day of week in UTC representation
        const [y, m, d] = currentStr.split("-").map(Number);
        const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

        if (bulkWeekdays.includes(dayOfWeek)) {
          const tripDateInstant = startOfMauritiusDay(currentStr);
          const startTimeInstant = mauritiusToInstant(currentStr, bulkStartTime);
          const returnTimeInstant = mauritiusToInstant(currentStr, bulkReturnTime);

          departuresToInsert.push({
            tour_tour_id: Number(bulkTourId),
            trip_date: tripDateInstant,
            start_time: startTimeInstant,
            return_time: returnTimeInstant,
            trip_status: "Pending",
            capacity: Number(bulkCapacity) || 20,
            created_by: currentUserEmail,
            date_created: now,
            updated_by_: currentUserEmail,
            date_updated: now,
          });
        }

        currentStr = addDaysToMauritiusDate(currentStr, 1);
      }

      if (departuresToInsert.length === 0) {
        setBulkError("No matching days found in the selected date range for chosen weekdays.");
        return;
      }

      let { error: insErr } = await supabase.from("trip").insert(departuresToInsert);
      if (insErr && (insErr.message?.includes("trip_trip_status_check") || insErr.message?.includes("chk_trip_status") || insErr.message?.includes("trip_status"))) {
        // Fallback to 'Scheduled' if DB check constraint still enforces legacy values
        const legacyDepartures = departuresToInsert.map((d) => ({
          ...d,
          trip_status: "Scheduled",
        }));
        const retryRes = await supabase.from("trip").insert(legacyDepartures);
        insErr = retryRes.error;
      }
      if (insErr) throw insErr;

      setFeedbackMsg({
        type: "success",
        text: `Successfully scheduled ${departuresToInsert.length} departure(s) across selected dates.`,
      });
      setIsBulkOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error("Bulk trip creation error:", err);
      setBulkError(err.message || "Failed to create departures.");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!tourId) {
      setFormError("Please select a tour catalog entry.");
      return;
    }
    if (returnTime <= startTime) {
      setFormError("Return time must be strictly after start time.");
      return;
    }

    setIsSaving(true);
    const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";
    const now = nowInstant();

    const tripDateClean = tripDate.includes("T") ? tripDate.split("T")[0] : tripDate;
    const tripDateInstant = startOfMauritiusDay(tripDateClean);
    const startTimeInstant = mauritiusToInstant(tripDateClean, startTime);
    const returnTimeInstant = mauritiusToInstant(tripDateClean, returnTime);

    const payload = {
      tour_tour_id: Number(tourId),
      trip_date: tripDateInstant,
      start_time: startTimeInstant,
      return_time: returnTimeInstant,
      trip_status: tripStatus,
      capacity: Number(capacity) || 20,
      updated_by_: currentUserEmail,
      date_updated: now,
    };

    try {
      if (selectedTrip) {
        let { error } = await supabase.from("trip").update(payload).eq("trip_id", selectedTrip.trip_id);
        if (error && (error.message?.includes("trip_trip_status_check") || error.message?.includes("chk_trip_status") || error.message?.includes("trip_status"))) {
          const fallbackStatus = payload.trip_status === "Pending" ? "Scheduled" : payload.trip_status === "In Progress" ? "Ongoing" : payload.trip_status;
          const retry = await supabase.from("trip").update({ ...payload, trip_status: fallbackStatus }).eq("trip_id", selectedTrip.trip_id);
          error = retry.error;
        }
        if (error) throw error;
      } else {
        let { error } = await supabase.from("trip").insert([
          {
            ...payload,
            created_by: currentUserEmail,
            date_created: now,
          },
        ]);
        if (error && (error.message?.includes("trip_trip_status_check") || error.message?.includes("chk_trip_status") || error.message?.includes("trip_status"))) {
          const fallbackStatus = payload.trip_status === "Pending" ? "Scheduled" : payload.trip_status === "In Progress" ? "Ongoing" : payload.trip_status;
          const retry = await supabase.from("trip").insert([
            {
              ...payload,
              trip_status: fallbackStatus,
              created_by: currentUserEmail,
              date_created: now,
            },
          ]);
          error = retry.error;
        }
        if (error) throw error;
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Save trip error:", err);
      setFormError(err.message || "Failed to schedule excursion trip.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCancelTrip = (t: Trip) => {
    setTripToCancel(t);
    setCancelReason("Unfavorable weather conditions / resort operational cancellation");
    setIsCancelTripOpen(true);
  };

  const handleConfirmCancelTrip = async () => {
    if (!tripToCancel) return;
    setIsCancelling(true);

    try {
      const res = await fetch("/api/admin/cancel-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: tripToCancel.trip_id,
          reason: cancelReason,
          adminEmail: user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to cancel trip.");
      }

      setFeedbackMsg({
        type: "success",
        text: `Trip #${tripToCancel.trip_id} cancelled. ${data.refundedCount} seat booking(s) refunded 100% (${formatCurrency(data.totalRefunded)}).`,
      });
      setIsCancelTripOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error("Trip cancellation error:", err);
      setFeedbackMsg({
        type: "error",
        text: err.message || "Failed to cancel excursion trip.",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const filtered = trips.filter((t) => {
    const search = searchTerm.toLowerCase();
    const tourName = (t.tour?.tour_name || "").toLowerCase();
    return (
      String(t.trip_id).includes(search) ||
      tourName.includes(search) ||
      (t.trip_status && t.trip_status.toLowerCase().includes(search))
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
      case "Scheduled":
        return <Badge className="bg-blue-600 text-white gap-1"><Clock className="h-3 w-3" /> Scheduled</Badge>;
      case "In Progress":
      case "Ongoing":
        return <Badge className="bg-amber-500 text-white gap-1"><Clock className="h-3 w-3" /> In Progress</Badge>;
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
          <h1 className="text-2xl font-bold text-navy-900">Excursion Departures (Trips)</h1>
          <p className="text-slate-500 text-sm">Schedule specific catamaran departures, manage seat limits, and view bookings.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleOpenBulk} variant="outline" className="gap-2 border-[#A37836] text-[#A37836] hover:bg-[#F4EFE6]">
            <Layers className="h-4 w-4" /> Bulk Schedule Departures
          </Button>
          <Button onClick={handleOpenAdd} variant="gold" className="gap-2">
            <Plus className="h-4 w-4" /> Schedule Departure
          </Button>
        </div>
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
          placeholder="Search by Trip ID, Tour name or status..."
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
                  <th className="px-4 py-3">Trip ID</th>
                  <th className="px-4 py-3">Catalog Tour</th>
                  <th className="px-4 py-3">Departure Date</th>
                  <th className="px-4 py-3">Schedule Window</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No scheduled departures found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => (
                    <tr key={t.trip_id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-navy-900">#{t.trip_id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{t.tour?.tour_name || "Tour Excursion"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(t.trip_date)}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">
                        {formatTimeDisplay(t.start_time)} to {formatTimeDisplay(t.return_time)}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">{t.capacity || 20} seats</td>
                      <td className="px-4 py-3">{getStatusBadge(t.trip_status)}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(t)} title="Edit Departure">
                          <Edit className="h-4 w-4 text-slate-600" />
                        </Button>
                        {t.trip_status !== "Cancelled" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenCancelTrip(t)}
                            title="Cancel Trip (100% Refund to All Passengers)"
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
            {filtered.map((t) => (
              <div key={t.trip_id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-xs text-[#A37836]">Trip #{t.trip_id}</span>
                  {getStatusBadge(t.trip_status)}
                </div>
                <div className="font-bold text-navy-900">{t.tour?.tour_name}</div>
                <div className="text-xs text-slate-600">
                  <div><strong>Date:</strong> {formatDate(t.trip_date)}</div>
                  <div><strong>Time:</strong> {formatTimeDisplay(t.start_time)} to {formatTimeDisplay(t.return_time)}</div>
                  <div><strong>Seats:</strong> {t.capacity || 20}</div>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenEdit(t)}>Edit</Button>
                  {t.trip_status !== "Cancelled" && (
                    <Button variant="destructive" size="sm" onClick={() => handleOpenCancelTrip(t)}>
                      Cancel Trip (100% Refund)
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Single Trip Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle>{selectedTrip ? "Edit Excursion Departure" : "Schedule Excursion Departure"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {formError && <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded">{formError}</p>}

            <div className="space-y-2">
              <Label>Select Tour Product *</Label>
              <Select value={tourId} onValueChange={setTourId}>
                <SelectTrigger><SelectValue placeholder="Choose tour..." /></SelectTrigger>
                <SelectContent>
                  {tours.map((tr) => (
                    <SelectItem key={tr.tour_id} value={String(tr.tour_id)}>
                      {tr.tour_name} ({tr.durations} hrs • Adult: MUR {tr.adult_price})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Departure Date *</Label>
              <Input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Departure Time *</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Return Time *</Label>
                <Input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Departure Status *</Label>
                <Select value={tripStatus} onValueChange={(val: any) => setTripStatus(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending (Scheduled)</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Seat Capacity *</Label>
                <Input
                  type="number"
                  min="1"
                  max="200"
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={isSaving}>
                {isSaving ? "Saving..." : selectedTrip ? "Save Changes" : "Create Departure"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Scheduling Helper Modal (Decision B.5) */}
      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="sm:max-w-lg w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-[#A37836]" /> Bulk Schedule Departures
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBulkSubmit} className="space-y-4 pt-2 text-xs">
            {bulkError && <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded">{bulkError}</p>}

            <div className="space-y-1.5">
              <Label className="font-bold">Tour Product *</Label>
              <Select value={bulkTourId} onValueChange={setBulkTourId}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Choose tour..." /></SelectTrigger>
                <SelectContent>
                  {tours.map((tr) => (
                    <SelectItem key={tr.tour_id} value={String(tr.tour_id)}>
                      {tr.tour_name} ({tr.durations} hrs)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold">Date Range Start *</Label>
                <Input type="date" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold">Date Range End *</Label>
                <Input type="date" value={bulkEndDate} onChange={(e) => setBulkEndDate(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold">Scheduled Weekdays *</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {WEEKDAYS.map((wd) => {
                  const isChecked = bulkWeekdays.includes(wd.value);
                  return (
                    <button
                      key={wd.value}
                      type="button"
                      onClick={() => handleToggleWeekday(wd.value)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                        isChecked
                          ? "bg-[#A37836] text-white border-[#A37836]"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {wd.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold">Departure Time *</Label>
                <Input type="time" value={bulkStartTime} onChange={(e) => setBulkStartTime(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold">Return Time *</Label>
                <Input type="time" value={bulkReturnTime} onChange={(e) => setBulkReturnTime(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold">Seat Capacity *</Label>
                <Input type="number" min="1" max="200" value={bulkCapacity} onChange={(e) => setBulkCapacity(Number(e.target.value))} required />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={bulkSaving} className="gap-2">
                {bulkSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {bulkSaving ? "Creating..." : "Generate Departures"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Hotel-initiated Trip Cancellation Dialog (Decision B.6) */}
      <Dialog open={isCancelTripOpen} onOpenChange={setIsCancelTripOpen}>
        <DialogContent className="sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-red-800 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" /> Cancel Excursion Departure #{tripToCancel?.trip_id}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-red-800 space-y-1">
              <span className="font-bold block">Hotel-Initiated Cancellation Policy:</span>
              <p>
                Cancelling this trip departure will automatically issue a <strong>100% full refund</strong> via Stripe to all currently booked passengers on this trip and mark their seat reservations as Cancelled.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold">Cancellation Reason</Label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Inclement weather conditions"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setIsCancelTripOpen(false)} disabled={isCancelling}>
              Keep Trip
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancelTrip}
              disabled={isCancelling}
              className="gap-2"
            >
              {isCancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCancelling ? "Processing 100% Refunds..." : "Confirm & Refund All (100%)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
