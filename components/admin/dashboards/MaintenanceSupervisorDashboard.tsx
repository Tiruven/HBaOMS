// components/admin/dashboards/MaintenanceSupervisorDashboard.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, AlertTriangle, RefreshCw } from "lucide-react";

export const MaintenanceSupervisorDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/operations/maintenance", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load maintenance dashboard");
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const requests = data?.requests || [];
  const openRequests = requests.filter(
    (r: any) => r.request_status === "Pending" || r.request_status === "In Progress" || r.request_status === "Open"
  );
  const highUrgentCount = openRequests.filter(
    (r: any) => r.priority === "High" || r.priority === "Urgent"
  ).length;
  const blockedRooms = (data?.rooms || []).filter((r: any) => r.room_status === "Maintenance");

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-navy-900 text-white p-6 rounded-xl border border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-gold-400">Facilities & Repairs</span>
          <h1 className="text-2xl font-bold mt-1">Maintenance Supervisor Dashboard</h1>
          <p className="text-slate-300 text-xs mt-1">
            Track repair tickets and control room availability (High and Urgent tickets block rooms from sale).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="bg-white/10 text-white border-white/20 hover:bg-white/20 gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button asChild variant="gold" size="sm">
            <Link href="/admin/maintenance">Manage Maintenance Tickets</Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {data?.blockedRoomAlerts && data.blockedRoomAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-2 text-xs text-red-800">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <strong>Guest Impact Warning:</strong> {data.blockedRoomAlerts.length} Maintenance-blocked room(s) currently have checked-in or today-arriving guests (alert is also shown at Reception).
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-slate-500 uppercase">Open Tickets</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-extrabold text-navy-900">{openRequests.length}</CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-600">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-slate-500 uppercase">High / Urgent Open</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-extrabold text-navy-900">{highUrgentCount}</CardContent>
        </Card>
        <Card className="border-l-4 border-l-navy-900">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-slate-500 uppercase">Rooms Blocked in Maintenance</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-extrabold text-navy-900">{blockedRooms.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-navy-900 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-gold-500" /> Active Repair Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-slate-400">Loading tickets...</p>
          ) : openRequests.length === 0 ? (
            <p className="text-xs text-slate-400">No open maintenance tickets.</p>
          ) : (
            <div className="space-y-3">
              {openRequests.slice(0, 10).map((t: any) => (
                <div key={t.maintenance_id} className="p-3 rounded-lg border border-slate-200 flex justify-between items-center gap-3">
                  <div>
                    <div className="font-bold text-sm text-navy-900">
                      Ticket #{t.maintenance_id} - Room #{t.room_room_id}
                    </div>
                    <div className="text-xs text-slate-600">{t.mr_desc}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={t.priority === "Urgent" || t.priority === "High" ? "bg-red-600 text-white" : "bg-blue-500 text-white"}>
                      {t.priority}
                    </Badge>
                    <Badge variant="outline">{t.request_status}</Badge>
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

