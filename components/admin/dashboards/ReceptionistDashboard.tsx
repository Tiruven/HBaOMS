// components/admin/dashboards/ReceptionistDashboard.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { instantToMauritiusParts } from "@/lib/time";
import type { RoomReadinessResult, BlockedRoomGuestAlert } from "@/lib/roomReadiness";
import {
  LogIn,
  LogOut,
  Users,
  BedDouble,
  Sparkles,
  Wrench,
  AlertTriangle,
  CalendarCheck,
  RefreshCw,
} from "lucide-react";

interface ReceptionDashboardResponse {
  metrics: {
    todaysArrivals: number;
    todaysDepartures: number;
    currentGuests: number;
    availableRooms: number;
    cleaningRooms: number;
    maintenanceRooms: number;
    bookingStatusCounts: Record<string, number>;
  };
  blockedRoomAlerts: BlockedRoomGuestAlert[];
  rooms: any[];
  readinessByRoomId: Record<number, RoomReadinessResult>;
}

export const ReceptionistDashboard: React.FC = () => {
  const [data, setData] = useState<ReceptionDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/operations/reception", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load reception dashboard");
      setData(json);
    } catch (err: any) {
      setError(err.message || "Error loading data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const metrics = data?.metrics;

  const kpis = [
    { label: "Today's Arrivals", value: metrics?.todaysArrivals ?? 0, icon: LogIn, color: "text-blue-600" },
    { label: "Today's Departures", value: metrics?.todaysDepartures ?? 0, icon: LogOut, color: "text-amber-600" },
    { label: "Current Guests", value: metrics?.currentGuests ?? 0, icon: Users, color: "text-emerald-600" },
    { label: "Available Rooms", value: metrics?.availableRooms ?? 0, icon: BedDouble, color: "text-emerald-600" },
    { label: "Rooms Being Cleaned", value: metrics?.cleaningRooms ?? 0, icon: Sparkles, color: "text-amber-600" },
    { label: "Maintenance Rooms", value: metrics?.maintenanceRooms ?? 0, icon: Wrench, color: "text-red-600" },
  ];

  const getDerivedBadge = (status?: string) => {
    switch (status) {
      case "Available":
        return <Badge className="bg-emerald-500 text-white text-[10px]">Available</Badge>;
      case "Occupied":
        return <Badge className="bg-blue-600 text-white text-[10px]">Occupied</Badge>;
      case "Cleaning":
        return <Badge className="bg-amber-500 text-white text-[10px]">Cleaning</Badge>;
      case "Maintenance":
        return <Badge className="bg-red-600 text-white text-[10px]">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-navy-900 text-white p-6 rounded-xl border border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-gold-400">Front Desk Operations</span>
          <h1 className="text-2xl font-bold mt-1">Receptionist Dashboard</h1>
          <p className="text-slate-300 text-xs mt-1">
            Live arrivals, departures, room readiness status, and booking counts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="bg-white/10 text-white border-white/20 hover:bg-white/20 gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button asChild variant="gold" size="sm">
            <Link href="/admin/check-in-out">Manage Check-In / Out</Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Urgent Alert for Maintenance Blocked Rooms with Checked-In or Arriving Guests */}
      {data?.blockedRoomAlerts && data.blockedRoomAlerts.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <span>Reception Alert: Maintenance-Blocked Room Has Active or Arriving Guest</span>
          </div>
          <div className="space-y-1 pl-7">
            {data.blockedRoomAlerts.map((alert) => (
              <div key={`${alert.roomId}-${alert.bookingId}`} className="text-xs text-red-700">
                <strong>Room #{alert.roomId} ({alert.roomDesc})</strong> is in Maintenance while guest{" "}
                <strong>{alert.guestName}</strong> (Booking #{alert.bookingId}) is{" "}
                <Badge className="bg-red-600 text-white text-[10px] ml-1">{alert.situation}</Badge>
                {alert.ticketDescriptions.length > 0 && (
                  <span className="ml-2 text-red-600">Issue: {alert.ticketDescriptions.join("; ")}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="border-l-4 border-l-gold-500 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
                <CardTitle className="text-[11px] font-semibold uppercase text-slate-500">
                  {item.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <div className="text-2xl font-extrabold text-navy-900">{item.value}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Booking Counts by Status */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-navy-900 flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-gold-500" /> Booking Counts by Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {["Confirmed", "Checked In", "Checked Out", "Cancelled", "No Show"].map((st) => (
              <div key={st} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
                <div className="text-xs font-semibold text-slate-500">{st}</div>
                <div className="text-xl font-extrabold text-navy-900 mt-1">
                  {loading ? "-" : metrics?.bookingStatusCounts?.[st] ?? 0}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Live Room Readiness Overview */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-bold text-navy-900 flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-gold-500" /> Live Room Readiness Overview
          </CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/rooms">Full Room Grid</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(data?.rooms || []).map((room) => {
                const readiness = data?.readinessByRoomId?.[room.room_id];
                const readyTime = readiness?.expectedReadyAt
                  ? instantToMauritiusParts(readiness.expectedReadyAt).timeStr
                  : null;
                return (
                  <div
                    key={room.room_id}
                    className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-navy-900 truncate">
                        Room #{room.room_id} - {room.room_type?.type || "Room"}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{room.room_desc}</div>
                      {readiness?.derivedStatus === "Cleaning" && (
                        <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                          {readyTime ? `Expected ready: ${readyTime} (${readiness.remainingMinutes}m)` : "Held by HK request"}
                        </div>
                      )}
                    </div>
                    {getDerivedBadge(readiness?.derivedStatus)}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

