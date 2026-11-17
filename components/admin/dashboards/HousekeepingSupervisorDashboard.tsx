// components/admin/dashboards/HousekeepingSupervisorDashboard.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { instantToMauritiusParts } from "@/lib/time";
import { Sparkles, Clock, ClipboardList, RefreshCw } from "lucide-react";

export const HousekeepingSupervisorDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/operations/housekeeping", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load housekeeping dashboard");
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 15_000);
    return () => clearInterval(timer);
  }, [loadData]);

  const cleaningRooms = data?.cleaningRooms || [];
  const openRequests = (data?.requests || []).filter(
    (r: any) => r.request_status === "Pending" || r.request_status === "In Progress"
  );
  const todaysCheckouts = data?.todaysCheckouts || [];

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-navy-900 text-white p-6 rounded-xl border border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-gold-400">Housekeeping Operations</span>
          <h1 className="text-2xl font-bold mt-1">Housekeeping Supervisor Dashboard</h1>
          <p className="text-slate-300 text-xs mt-1">
            Monitor timer-based room turnaround, today&apos;s check-outs, and open cleaning hold requests.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="bg-white/10 text-white border-white/20 hover:bg-white/20 gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button asChild variant="gold" size="sm">
            <Link href="/admin/housekeeping">Manage Cleaning & Requests</Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-slate-500 uppercase">Rooms in Cleaning</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-extrabold text-navy-900">{cleaningRooms.length}</CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-600">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-slate-500 uppercase">Today&apos;s Check-Outs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-extrabold text-navy-900">{todaysCheckouts.length}</CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-slate-500 uppercase">Open Hold Requests</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-extrabold text-navy-900">{openRequests.length}</CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-navy-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" /> Rooms Currently in Cleaning
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-xs text-slate-400">Checking timers...</p>
            ) : cleaningRooms.length === 0 ? (
              <p className="text-xs text-slate-400">All eligible rooms have passed cleaning timers and have no open holds.</p>
            ) : (
              <div className="space-y-3">
                {cleaningRooms.map(({ room, readiness }: any) => (
                  <div key={room.room_id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-navy-900">Room #{room.room_id} ({room.room_type?.type})</div>
                      <div className="text-xs text-slate-600">
                        {readiness.expectedReadyAt
                          ? `Ready at ${instantToMauritiusParts(readiness.expectedReadyAt).timeStr} (${readiness.remainingMinutes} min left)`
                          : "Held by open housekeeping request"}
                      </div>
                    </div>
                    <Badge className="bg-amber-500 text-white gap-1">
                      <Clock className="h-3 w-3" /> {readiness.housekeepingStatus}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-navy-900 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-gold-500" /> Open Housekeeping Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {openRequests.length === 0 ? (
              <p className="text-xs text-slate-400">No open housekeeping requests.</p>
            ) : (
              <div className="space-y-3">
                {openRequests.map((req: any) => (
                  <div key={req.hk_req_id} className="p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-navy-900">
                        Room #{req.room_room_id} - {req.request_type}
                      </div>
                      <div className="text-xs text-slate-500">{req.description || "No description"}</div>
                    </div>
                    <Badge variant="outline">{req.request_status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

