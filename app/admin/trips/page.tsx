// app/admin/trips/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Trip, Tour } from "@/lib/types";
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
import { Plus, Search, Trash2, Edit, Compass, MapPin, CheckCircle, Clock, XCircle } from "lucide-react";

export default function TripsPage() {
  const { user } = useUser();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form
  const [tourId, setTourId] = useState<string>("");
  const [tripDate, setTripDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("09:00");
  const [returnTime, setReturnTime] = useState<string>("16:00");
  const [tripStatus, setTripStatus] = useState<"Scheduled" | "Ongoing" | "Completed" | "Cancelled">("Scheduled");
  const [formError, setFormError] = useState<string>("");

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

  const handleOpenAdd = () => {
    setSelectedTrip(null);
    setTourId(tours.length > 0 ? String(tours[0].tour_id) : "");
    setTripDate(new Date().toISOString().split("T")[0]);
    setStartTime("09:00");
    setReturnTime("16:00");
    setTripStatus("Scheduled");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: Trip) => {
    setSelectedTrip(t);
    setTourId(String(t.tour_tour_id));
    setTripDate(t.trip_date.split("T")[0]);
    setStartTime(t.start_time);
    setReturnTime(t.return_time);
    setTripStatus(t.trip_status);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenDelete = (t: Trip) => {
    setSelectedTrip(t);
    setIsDeleteOpen(true);
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
    const now = new Date().toISOString();

    const payload = {
      tour_tour_id: Number(tourId),
      trip_date: tripDate,
      start_time: startTime,
      return_time: returnTime,
      trip_status: tripStatus,
      updated_by_: currentUserEmail,
      date_updated: now,
    };

    try {
      if (selectedTrip) {
        const { error } = await supabase.from("trip").update(payload).eq("trip_id", selectedTrip.trip_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trip").insert([
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
      console.error("Save trip error:", err);
      setFormError(err.message || "Failed to schedule excursion trip.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTrip) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("trip").delete().eq("trip_id", selectedTrip.trip_id);
      if (error) throw error;
      await fetchData();
      setIsDeleteOpen(false);
    } catch (err) {
      console.error("Delete trip error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = trips.filter((t) => {
    const search = searchTerm.toLowerCase();
    const tourName = (t.tour?.tour_name || "").toLowerCase();
    return String(t.trip_id).includes(search) || tourName.includes(search) || t.trip_status.toLowerCase().includes(search);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Scheduled":
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white gap-1"><Clock className="h-3 w-3" /> Scheduled</Badge>;
      case "Ongoing":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1"><Clock className="h-3 w-3" /> Ongoing</Badge>;
      case "Completed":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1"><CheckCircle className="h-3 w-3" /> Completed</Badge>;
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
          <h1 className="text-2xl font-bold text-navy-900">Excursion Trip Schedule</h1>
          <p className="text-slate-500 text-sm">Island tours, catamaran departures, and scheduled group trips.</p>
        </div>
        <Button onClick={handleOpenAdd} variant="gold" className="gap-2">
          <Plus className="h-4 w-4" /> Schedule Departure
        </Button>
      </div>

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
        <SkeletonTable rows={5} columns={6} />
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Trip ID</th>
                  <th className="px-4 py-3">Tour Name</th>
                  <th className="px-4 py-3">Trip Date</th>
                  <th className="px-4 py-3">Departure & Return</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No scheduled trips found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => (
                    <tr key={t.trip_id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-navy-900">#{t.trip_id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{t.tour?.tour_name || "Tour Excursion"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(t.trip_date)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {t.start_time} - {t.return_time}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(t.trip_status)}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(t)}>
                          <Edit className="h-4 w-4 text-slate-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(t)}>
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
            {filtered.map((t) => (
              <div key={t.trip_id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-xs text-gold-600">Trip #{t.trip_id}</span>
                  {getStatusBadge(t.trip_status)}
                </div>
                <div className="font-bold text-navy-900">{t.tour?.tour_name}</div>
                <div className="text-xs text-slate-600">
                  <div><strong>Date:</strong> {formatDate(t.trip_date)}</div>
                  <div><strong>Time:</strong> {t.start_time} - {t.return_time}</div>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenEdit(t)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleOpenDelete(t)}>Delete</Button>
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
            <DialogTitle>{selectedTrip ? "Edit Excursion Trip" : "Schedule Excursion Departure"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {formError && <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded">{formError}</p>}

            <div className="space-y-2">
              <Label>Select Tour *</Label>
              <Select value={tourId} onValueChange={setTourId}>
                <SelectTrigger><SelectValue placeholder="Choose tour..." /></SelectTrigger>
                <SelectContent>
                  {tours.map((tr) => (
                    <SelectItem key={tr.tour_id} value={String(tr.tour_id)}>
                      {tr.tour_name} (Adult: MUR {tr.adult_price})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Trip Date *</Label>
              <Input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Return Time *</Label>
                <Input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Trip Status *</Label>
              <Select value={tripStatus} onValueChange={(val: any) => setTripStatus(val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Ongoing">Ongoing</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={isSaving}>
                {isSaving ? "Saving..." : selectedTrip ? "Update Trip" : "Schedule Departure"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete Trip</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Delete scheduled trip <strong>#{selectedTrip?.trip_id}</strong> for {selectedTrip?.tour?.tour_name}?
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
