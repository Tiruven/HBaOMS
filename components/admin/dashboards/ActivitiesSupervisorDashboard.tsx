// components/admin/dashboards/ActivitiesSupervisorDashboard.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { formatMauritius } from "@/lib/time";
import { Compass, Users, RefreshCw } from "lucide-react";

export const ActivitiesSupervisorDashboard: React.FC = () => {
  const [manifests, setManifests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/operations/activities", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load activity manifests");
      setManifests(json.manifests || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeManifests = manifests.filter((m) => m.bookings && m.bookings.length > 0);
  const totalBookedPassengers = activeManifests.reduce((sum, m) => sum + (m.totalPassengers || 0), 0);

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-navy-900 text-white p-6 rounded-xl border border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-gold-400">Excursions & Tours</span>
          <h1 className="text-2xl font-bold mt-1">Activities Supervisor Dashboard</h1>
          <p className="text-slate-300 text-xs mt-1">
            Review scheduled excursion manifests, passenger counts, and trip execution status.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="bg-white/10 text-white border-white/20 hover:bg-white/20 gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button asChild variant="gold" size="sm">
            <Link href="/admin/trip-bookings">Open Trip Manifests</Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-gold-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-slate-500 uppercase">Scheduled Trips with Bookings</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-extrabold text-navy-900">{activeManifests.length}</CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-600">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-slate-500 uppercase">Total Active Travelers</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-extrabold text-navy-900">{totalBookedPassengers}</CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-slate-500 uppercase">Total Trips Cataloged</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-extrabold text-navy-900">{manifests.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-navy-900 flex items-center gap-2">
            <Compass className="h-4 w-4 text-gold-500" /> Trip Passenger Manifests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-slate-400">Loading trip manifests...</p>
          ) : activeManifests.length === 0 ? (
            <p className="text-xs text-slate-400">No trips currently have passenger bookings.</p>
          ) : (
            <div className="space-y-4">
              {activeManifests.slice(0, 6).map((trip) => (
                <div key={trip.trip_id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-navy-900">
                        Trip #{trip.trip_id} - {trip.tour?.tour_name || "Island Tour"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDate(trip.trip_date)} | {formatMauritius(trip.start_time, "time")} to {formatMauritius(trip.return_time, "time")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        <Users className="h-3 w-3" /> {trip.totalAdults} Adults, {trip.totalChildren} Children
                      </Badge>
                      <Badge className="bg-navy-900 text-white">{trip.trip_status}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

