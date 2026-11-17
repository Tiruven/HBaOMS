// app/admin/trip-bookings/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useStaffRole } from "@/lib/roleContext";
import { formatDate } from "@/lib/utils";
import { formatMauritius } from "@/lib/time";
import { SkeletonTable } from "@/components/shared/SkeletonTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Compass, Users, RefreshCw, CheckCircle } from "lucide-react";

export default function TripBookingsManifestPage() {
  const { role } = useStaffRole();
  const [manifests, setManifests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [error, setError] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/operations/activities", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load activity manifests");
      setManifests(json.manifests || []);
    } catch (err: any) {
      setError(err.message || "Error loading trip manifests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateTripStatus = async (tripId: number, status: string) => {
    setError("");
    setFeedback("");
    try {
      const res = await fetch("/api/operations/activities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "trip", tripId, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update trip status");
      setFeedback(`Trip #${tripId} status updated to ${status}.`);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateBookingStatus = async (
    tb: any,
    status: string
  ) => {
    setError("");
    setFeedback("");
    try {
      const res = await fetch("/api/operations/activities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "booking",
          tbId: tb.tb_id,
          tripId: tb.trip_trip_id,
          bookingId: tb.booking_booking_id,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update booking status");
      setFeedback(`Excursion booking status updated to ${status}.`);
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredManifests = manifests.filter((trip) => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    const tourName = (trip.tour?.tour_name || "").toLowerCase();
    const hasMatchingBooking = (trip.bookings || []).some((tb: any) => {
      const guestName = `${tb.booking?.customer?.cust_fname || ""} ${tb.booking?.customer?.cust_lname || ""}`.toLowerCase();
      return (
        String(tb.tb_id || "").includes(q) ||
        String(tb.booking_booking_id || "").includes(q) ||
        guestName.includes(q)
      );
    });
    return tourName.includes(q) || String(trip.trip_id).includes(q) || hasMatchingBooking;
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Excursion Trip Manifests</h1>
          <p className="text-slate-500 text-sm">
            Tour departures grouped by trip with passenger manifests ({role || "Activities"}).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh Manifests
        </Button>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600" /> {feedback}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by Tour name, Trip #, Booking #, or Guest..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {loading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : filteredManifests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
          No excursion trips found.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredManifests.map((trip) => {
            const normalizedTripStatus =
              trip.trip_status === "Scheduled"
                ? "Pending"
                : trip.trip_status === "Ongoing"
                ? "In Progress"
                : trip.trip_status;

            return (
              <div
                key={trip.trip_id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Trip Manifest Header */}
                <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Compass className="h-5 w-5 text-gold-500" />
                      <h2 className="text-lg font-bold text-navy-900">
                        Trip #{trip.trip_id}: {trip.tour?.tour_name || "Island Excursion"}
                      </h2>
                    </div>
                    <div className="text-xs text-slate-600">
                      Date: <strong>{formatDate(trip.trip_date)}</strong> | Departure:{" "}
                      <strong>{formatMauritius(trip.start_time, "time")}</strong> - Return:{" "}
                      <strong>{formatMauritius(trip.return_time, "time")}</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="outline" className="gap-1.5 py-1 px-3 bg-white">
                      <Users className="h-3.5 w-3.5 text-gold-600" />
                      <span>
                        {trip.totalAdults} Adults, {trip.totalChildren} Children ({trip.totalPassengers} / {trip.capacity || 20} seats)
                      </span>
                    </Badge>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Trip Status:</span>
                      <Select
                        value={normalizedTripStatus}
                        onValueChange={(val) => handleUpdateTripStatus(trip.trip_id, val)}
                      >
                        <SelectTrigger className="h-8 w-36 bg-white text-xs font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Manifest Passenger Table */}
                {trip.bookings.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No passenger bookings registered on this trip yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white text-slate-500 uppercase font-bold border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-2.5">TB ID</th>
                          <th className="px-4 py-2.5">Booking Ref</th>
                          <th className="px-4 py-2.5">Guest Name</th>
                          <th className="px-4 py-2.5">Adults</th>
                          <th className="px-4 py-2.5">Children</th>
                          <th className="px-4 py-2.5">Booking Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {trip.bookings.map((tb: any) => (
                          <tr key={tb.tb_id || `${tb.trip_trip_id}-${tb.booking_booking_id}`} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-mono font-bold text-navy-900">
                              {tb.tb_id ? `#${tb.tb_id}` : "-"}
                            </td>
                            <td className="px-4 py-3 font-mono">Booking #{tb.booking_booking_id}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {tb.booking?.customer
                                ? `${tb.booking.customer.cust_fname} ${tb.booking.customer.cust_lname}`
                                : "Guest"}
                            </td>
                            <td className="px-4 py-3 font-bold">{tb.num_adult}</td>
                            <td className="px-4 py-3 font-bold">{tb.num_child}</td>
                            <td className="px-4 py-3">
                              <Select
                                value={tb.tb_status || "Pending"}
                                onValueChange={(val) => handleUpdateBookingStatus(tb, val)}
                              >
                                <SelectTrigger className="h-8 w-36 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Pending">Pending</SelectItem>
                                  <SelectItem value="In Progress">In Progress</SelectItem>
                                  <SelectItem value="Completed">Completed</SelectItem>
                                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
