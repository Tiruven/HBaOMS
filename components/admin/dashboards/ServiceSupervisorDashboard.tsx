// components/admin/dashboards/ServiceSupervisorDashboard.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { formatMauritius } from "@/lib/time";
import { ConciergeBell, Utensils, RefreshCw } from "lucide-react";

export const ServiceSupervisorDashboard: React.FC = () => {
  const [serviceBookings, setServiceBookings] = useState<any[]>([]);
  const [mealPlanRooms, setMealPlanRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/operations/services", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load service data");
      setServiceBookings(json.serviceBookings || []);
      setMealPlanRooms(json.mealPlanRooms || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (sbId: number, status: string) => {
    try {
      const res = await fetch("/api/operations/services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sbId, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update status");
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const pendingCount = serviceBookings.filter((s) => s.sb_status === "Pending").length;
  const inProgressCount = serviceBookings.filter((s) => s.sb_status === "In Progress").length;
  const completedCount = serviceBookings.filter((s) => s.sb_status === "Completed").length;

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-navy-900 text-white p-6 rounded-xl border border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-gold-400">Hospitality & Dining Operations</span>
          <h1 className="text-2xl font-bold mt-1">Service Supervisor Dashboard</h1>
          <p className="text-slate-300 text-xs mt-1">
            Manage guest service orders and track Half Board (HB) and Full Board (FB) room meal plans.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="bg-white/10 text-white border-white/20 hover:bg-white/20 gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button asChild variant="gold" size="sm">
            <Link href="/admin/service-bookings">Full Service Queue</Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-slate-500 uppercase">Pending Services</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-extrabold text-navy-900">{pendingCount}</CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-600">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-slate-500 uppercase">In Progress</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-extrabold text-navy-900">{inProgressCount}</CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-slate-500 uppercase">Completed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-extrabold text-navy-900">{completedCount}</CardContent>
        </Card>
        <Card className="border-l-4 border-l-gold-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-slate-500 uppercase">HB / FB Meal Plan Rooms</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-extrabold text-navy-900">{mealPlanRooms.length}</CardContent>
        </Card>
      </div>

      {/* Half Board & Full Board Room Stays (for Dining / Chef Planning) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-navy-900 flex items-center gap-2">
            <Utensils className="h-4 w-4 text-gold-500" /> Half Board (HB) & Full Board (FB) Guest Rooms
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-slate-400">Loading meal plan rooms...</p>
          ) : mealPlanRooms.length === 0 ? (
            <p className="text-xs text-slate-400">No active or upcoming Half Board or Full Board stays.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b">
                  <tr>
                    <th className="px-3 py-2">Room</th>
                    <th className="px-3 py-2">Booking Ref</th>
                    <th className="px-3 py-2">Meal Plan</th>
                    <th className="px-3 py-2">Guests</th>
                    <th className="px-3 py-2">Stay Window</th>
                    <th className="px-3 py-2">Stay Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mealPlanRooms.map((m) => (
                    <tr key={`${m.roomId}-${m.bookingId}`}>
                      <td className="px-3 py-2 font-bold text-navy-900">Room #{m.roomId} ({m.roomType})</td>
                      <td className="px-3 py-2 font-mono">#{m.bookingId}</td>
                      <td className="px-3 py-2">
                        <Badge className={m.boardType === "FB" ? "bg-purple-600 text-white" : "bg-amber-500 text-white"}>
                          {m.boardType === "FB" ? "Full Board (FB)" : "Half Board (HB)"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{m.numAdults} Adults, {m.numChildren} Children</td>
                      <td className="px-3 py-2">{formatDate(m.checkInDate)} to {formatDate(m.checkOutDate)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{m.stayStatus}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Service Queue */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-navy-900 flex items-center gap-2">
            <ConciergeBell className="h-4 w-4 text-gold-500" /> Recent Service Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b">
                <tr>
                  <th className="px-3 py-2">SB ID</th>
                  <th className="px-3 py-2">Booking Ref</th>
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2">Date & Time</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {serviceBookings.slice(0, 12).map((sb) => (
                  <tr key={sb.sb_id}>
                    <td className="px-3 py-2 font-mono font-bold">#{sb.sb_id}</td>
                    <td className="px-3 py-2 font-mono">Booking #{sb.booking_booking_id}</td>
                    <td className="px-3 py-2 font-semibold text-navy-900">{sb.service?.service_name || "Service"}</td>
                    <td className="px-3 py-2">
                      {formatDate(sb.service_date)} ({formatMauritius(sb.time_in, "time")} - {formatMauritius(sb.time_out, "time")})
                    </td>
                    <td className="px-3 py-2">
                      <Select value={sb.sb_status} onValueChange={(val) => handleStatusChange(sb.sb_id, val)}>
                        <SelectTrigger className="h-7 w-32 text-xs">
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
        </CardContent>
      </Card>
    </div>
  );
};

