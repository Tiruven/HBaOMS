// app/admin/housekeeping/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { SkeletonTable } from "@/components/shared/SkeletonTable";
import { formatDate } from "@/lib/utils";
import { instantToMauritiusParts } from "@/lib/time";
import {
  Sparkles,
  Plus,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  ClipboardList,
} from "lucide-react";

export default function HousekeepingPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<string>("");

  // Create Request Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [requestType, setRequestType] = useState<
    "Special cleaning" | "Excessive mess" | "Extra cleaning"
  >("Excessive mess");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/operations/housekeeping", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load housekeeping data");
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleOpenAdd = () => {
    const eligible = data?.eligibleRoomsForRequest || [];
    setRoomId(eligible.length > 0 ? String(eligible[0].room_id) : "");
    setRequestType("Excessive mess");
    setDescription("");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!roomId) {
      setFormError("Please select a room.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/operations/housekeeping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: Number(roomId),
          requestType,
          description: description.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create request");
      setIsModalOpen(false);
      setFeedback(`Logged "${requestType}" request for Room #${roomId}. Room will remain in Cleaning until closed.`);
      await loadData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (hkReqId: number, status: string) => {
    setError("");
    setFeedback("");
    try {
      const res = await fetch("/api/operations/housekeeping", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hkReqId, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update request status");
      setFeedback(`Request #${hkReqId} updated to ${status}. Room readiness recalculated automatically.`);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const cleaningRooms = data?.cleaningRooms || [];
  const todaysCheckouts = data?.todaysCheckouts || [];
  const requests = data?.requests || [];
  const eligibleRooms = data?.eligibleRoomsForRequest || [];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Housekeeping & Room Turnaround</h1>
          <p className="text-slate-500 text-sm">
            Derived timer-based cleaning status, today&apos;s check-outs, and non-routine cleaning hold requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh Timers
          </Button>
          <Button onClick={handleOpenAdd} variant="gold" className="gap-2">
            <Plus className="h-4 w-4" /> Log Housekeeping Request
          </Button>
        </div>
      </div>

      {data && !data.housekeepingTableReady && (
        <div className="p-4 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Database table <code>housekeeping_request</code> is not created yet. Run{" "}
            <code>database/v7_operations_supervisor_staff.sql</code> in Supabase SQL Editor to enable creating requests.
          </span>
        </div>
      )}

      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Rooms currently in Cleaning */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> Rooms Currently in Cleaning ({cleaningRooms.length})
          </h2>
          <span className="text-xs text-slate-400">Auto-refreshes every 15s (timers complete automatically)</span>
        </div>

        {loading && !data ? (
          <SkeletonTable rows={3} columns={4} />
        ) : cleaningRooms.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">
            No rooms are currently in Cleaning status.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cleaningRooms.map(({ room, readiness }: any) => {
              const readyTime = readiness.expectedReadyAt
                ? instantToMauritiusParts(readiness.expectedReadyAt).timeStr
                : null;
              return (
                <div
                  key={room.room_id}
                  className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-navy-900">
                      Room #{room.room_id} ({room.room_type?.type || "Room"})
                    </span>
                    <Badge className="bg-amber-500 text-white text-[11px]">
                      {readiness.housekeepingStatus}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-600">{room.room_desc}</div>
                  <div className="text-xs space-y-1 pt-1 border-t border-amber-200/70">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cleaning Duration:</span>
                      <strong>{readiness.cleaningMinutes} mins</strong>
                    </div>
                    {readyTime && (
                      <div className="flex justify-between text-amber-800">
                        <span>Expected Ready:</span>
                        <strong>
                          {readyTime} ({readiness.remainingMinutes} min left)
                        </strong>
                      </div>
                    )}
                    {readiness.openHousekeepingCount > 0 && (
                      <div className="text-red-700 font-semibold flex items-center gap-1 pt-1">
                        <Clock className="h-3.5 w-3.5" /> Held by {readiness.openHousekeepingCount} open request(s)
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Today's Check-Outs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gold-500" /> Today&apos;s Check-Outs ({todaysCheckouts.length})
        </h2>
        {todaysCheckouts.length === 0 ? (
          <p className="text-xs text-slate-400">No rooms have checked out today.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b">
                <tr>
                  <th className="px-4 py-2">Room</th>
                  <th className="px-4 py-2">Booking Ref</th>
                  <th className="px-4 py-2">Check-Out Time</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Current Room Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {todaysCheckouts.map((c: any) => (
                  <tr key={`${c.roomId}-${c.bookingId}`}>
                    <td className="px-4 py-2.5 font-bold text-navy-900">
                      Room #{c.roomId} ({c.roomDesc})
                    </td>
                    <td className="px-4 py-2.5 font-mono">#{c.bookingId}</td>
                    <td className="px-4 py-2.5">
                      {instantToMauritiusParts(c.checkoutTime).dateStr}{" "}
                      {instantToMauritiusParts(c.checkoutTime).timeStr}
                    </td>
                    <td className="px-4 py-2.5">{c.checkoutType}</td>
                    <td className="px-4 py-2.5">
                      <Badge
                        className={
                          c.derivedStatus === "Available"
                            ? "bg-emerald-500 text-white"
                            : c.derivedStatus === "Cleaning"
                            ? "bg-amber-500 text-white"
                            : "bg-red-600 text-white"
                        }
                      >
                        {c.derivedStatus}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Housekeeping Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-gold-500" /> Housekeeping Hold Requests ({requests.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Request Type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No housekeeping requests recorded.
                  </td>
                </tr>
              ) : (
                requests.map((r: any) => (
                  <tr key={r.hk_req_id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono font-bold text-navy-900">#{r.hk_req_id}</td>
                    <td className="px-4 py-3 font-semibold text-navy-900">
                      Room #{r.room_room_id}
                      {r.room?.room_desc ? ` (${r.room.room_desc})` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs font-semibold">
                        {r.request_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">{r.description || "-"}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={r.request_status}
                        onValueChange={(val) => handleStatusChange(r.hk_req_id, val)}
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
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div>{formatDate(r.created_at)}</div>
                      <div className="text-[10px]">{r.created_by || "Supervisor"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {r.completed_at ? formatDate(r.completed_at) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Housekeeping Request Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Log Housekeeping Request</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRequest} className="space-y-4 pt-2">
            <p className="text-xs text-slate-500">
              Logging a request holds the room in Cleaning status until completed or cancelled. Only rooms without a checked-in guest are listed.
            </p>

            {formError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs font-semibold">
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <Label>Select Unoccupied Room *</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose room..." />
                </SelectTrigger>
                <SelectContent>
                  {eligibleRooms.map((rm: any) => (
                    <SelectItem key={rm.room_id} value={String(rm.room_id)}>
                      Room #{rm.room_id} - {rm.room_desc || rm.room_type?.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Request Type *</Label>
              <Select value={requestType} onValueChange={(v: any) => setRequestType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Special cleaning">Special cleaning</SelectItem>
                  <SelectItem value="Excessive mess">Excessive mess</SelectItem>
                  <SelectItem value="Extra cleaning">Extra cleaning</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes / Worker Report Details (Optional)</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Carpet deep steam cleaning requested after checkout..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" disabled={isSaving}>
                {isSaving ? "Saving..." : "Log Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

