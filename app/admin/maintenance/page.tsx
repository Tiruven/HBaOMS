// app/admin/maintenance/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useStaffRole } from "@/lib/roleContext";
import { formatDate } from "@/lib/utils";
import { mauritiusToday, instantToMauritiusParts } from "@/lib/time";
import { SkeletonTable } from "@/components/shared/SkeletonTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Plus,
  Search,
  Edit,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
} from "lucide-react";

export default function MaintenancePage() {
  const { role } = useStaffRole();
  const canWrite = role === "Admin" || role === "Maintenance Supervisor";

  const [requests, setRequests] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [blockedAlerts, setBlockedAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedMR, setSelectedMR] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form
  const [roomId, setRoomId] = useState<string>("");
  const [mrDesc, setMrDesc] = useState<string>("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Urgent">("Medium");
  const [requestStatus, setRequestStatus] = useState<"Pending" | "In Progress" | "Completed" | "Cancelled">("Pending");
  const [requestDate, setRequestDate] = useState<string>("");
  const [formError, setFormError] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/operations/maintenance", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch maintenance requests");
      setRequests(json.requests || []);
      setRooms(json.rooms || []);
      setBlockedAlerts(json.blockedRoomAlerts || []);
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenAdd = () => {
    setSelectedMR(null);
    setRoomId(rooms.length > 0 ? String(rooms[0].room_id) : "");
    setMrDesc("");
    setPriority("Medium");
    setRequestStatus("Pending");
    setRequestDate(mauritiusToday());
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (mr: any) => {
    setSelectedMR(mr);
    setRoomId(String(mr.room_room_id));
    setMrDesc(mr.mr_desc || "");
    setPriority(mr.priority);
    const normalizedStatus =
      mr.request_status === "Open"
        ? "Pending"
        : mr.request_status === "Resolved"
        ? "Completed"
        : mr.request_status;
    setRequestStatus(normalizedStatus);
    setRequestDate(mr.request_date ? instantToMauritiusParts(mr.request_date).dateStr : mauritiusToday());
    setFormError("");
    setIsModalOpen(true);
  };

  const handleInlineUpdate = async (
    maintenanceId: number,
    updates: { status?: string; priority?: string }
  ) => {
    setFeedback(null);
    try {
      const res = await fetch("/api/operations/maintenance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenanceId, ...updates }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setFeedback({
        type: "success",
        text: `Ticket #${maintenanceId} updated. Room status is now "${json.roomStatus}".`,
      });
      await fetchData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!roomId || !mrDesc.trim()) {
      setFormError("Please select a room and enter a description.");
      return;
    }

    setIsSaving(true);
    try {
      if (selectedMR) {
        const res = await fetch("/api/operations/maintenance", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maintenanceId: selectedMR.maintenance_id || selectedMR.mr_id,
            roomId: Number(roomId),
            description: mrDesc.trim(),
            priority,
            status: requestStatus,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to update ticket");
        setFeedback({
          type: "success",
          text: `Ticket updated. Room #${roomId} status is now "${json.roomStatus}".`,
        });
      } else {
        const res = await fetch("/api/operations/maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: Number(roomId),
            description: mrDesc.trim(),
            priority,
            status: requestStatus,
            requestDate,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to create ticket");
        setFeedback({
          type: "success",
          text: `Ticket created and logged under your staff account. Room #${roomId} status: "${json.roomStatus}".`,
        });
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save maintenance ticket.");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = requests.filter((r) => {
    const search = searchTerm.toLowerCase();
    const id = String(r.maintenance_id || r.mr_id || "");
    const roomInfo = `room ${r.room_room_id} ${r.room?.room_desc || ""}`.toLowerCase();
    return id.includes(search) || roomInfo.includes(search) || (r.mr_desc || "").toLowerCase().includes(search);
  });

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "Urgent":
        return <Badge className="bg-red-600 text-white">Urgent (Blocks Room)</Badge>;
      case "High":
        return <Badge className="bg-orange-500 text-white">High (Blocks Room)</Badge>;
      case "Medium":
        return <Badge className="bg-blue-500 text-white">Medium</Badge>;
      case "Low":
        return <Badge className="bg-slate-500 text-white">Low</Badge>;
      default:
        return <Badge variant="outline">{p}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Maintenance Requests</h1>
          <p className="text-slate-500 text-sm">
            High and Urgent open tickets set the room to Maintenance (blocked from sale). Low and Medium do not block rooms.
          </p>
        </div>
        {canWrite && (
          <Button onClick={handleOpenAdd} variant="gold" className="gap-2">
            <Plus className="h-4 w-4" /> Create Ticket
          </Button>
        )}
      </div>

      {blockedAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs space-y-1">
          <div className="font-bold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" /> Active Guest Impact Alert
          </div>
          {blockedAlerts.map((a) => (
            <div key={`${a.roomId}-${a.bookingId}`}>
              Room #{a.roomId} is blocked in Maintenance while Guest {a.guestName} (Booking #{a.bookingId}) is {a.situation}. Reception is alerted.
            </div>
          ))}
        </div>
      )}

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by Ticket ID, Room, description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {loading ? (
        <SkeletonTable rows={5} columns={7} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Room & Description</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Room Availability</th>
                <th className="px-4 py-3">Logged By (Staff)</th>
                {canWrite && <th className="px-4 py-3 text-right">Edit</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No maintenance tickets found.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const ticketId = Number(r.maintenance_id || r.mr_id);
                  const currentStatus =
                    r.request_status === "Open"
                      ? "Pending"
                      : r.request_status === "Resolved"
                      ? "Completed"
                      : r.request_status;
                  const staffLabel = r.staff
                    ? `${r.staff.staff_fname} ${r.staff.staff_lname}`
                    : r.created_by || "System";

                  return (
                    <tr key={ticketId} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-navy-900">#{ticketId}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">
                          Room #{r.room_room_id} {r.room?.room_desc ? `(${r.room.room_desc})` : ""}
                        </div>
                        <div className="text-xs text-slate-500 max-w-xs">{r.mr_desc}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(r.request_date)}</div>
                      </td>
                      <td className="px-4 py-3">
                        {canWrite ? (
                          <Select
                            value={r.priority}
                            onValueChange={(val) => handleInlineUpdate(ticketId, { priority: val })}
                          >
                            <SelectTrigger className="h-8 w-44 text-xs">
                              <SelectValue>{getPriorityBadge(r.priority)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Low">Low (Does Not Block)</SelectItem>
                              <SelectItem value="Medium">Medium (Does Not Block)</SelectItem>
                              <SelectItem value="High">High (Blocks Room)</SelectItem>
                              <SelectItem value="Urgent">Urgent (Blocks Room)</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          getPriorityBadge(r.priority)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canWrite ? (
                          <Select
                            value={currentStatus}
                            onValueChange={(val) => handleInlineUpdate(ticketId, { status: val })}
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
                        ) : (
                          <Badge variant="outline">{currentStatus}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={r.room?.room_status === "Maintenance" ? "destructive" : "success"}
                          className="text-[11px]"
                        >
                          {r.room?.room_status || "Available"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div>{staffLabel}</div>
                        {r.staff?.is_active === "N" && (
                          <Badge variant="outline" className="text-[10px] text-slate-400 mt-0.5">
                            Inactive Staff
                          </Badge>
                        )}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(r)}>
                            <Edit className="h-4 w-4 text-slate-600" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-gold-500" />
              {selectedMR ? "Edit Maintenance Ticket" : "Create Maintenance Ticket"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {formError && <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded">{formError}</p>}

            <div className="space-y-2">
              <Label>Select Room *</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger><SelectValue placeholder="Choose room..." /></SelectTrigger>
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
              <Label>Description of Issue *</Label>
              <Textarea
                rows={3}
                placeholder="e.g. AC compressor leaking water..."
                value={mrDesc}
                onChange={(e) => setMrDesc(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority *</Label>
                <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low (Non-blocking)</SelectItem>
                    <SelectItem value="Medium">Medium (Non-blocking)</SelectItem>
                    <SelectItem value="High">High (Blocks Room)</SelectItem>
                    <SelectItem value="Urgent">Urgent (Blocks Room)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status *</Label>
                <Select value={requestStatus} onValueChange={(val: any) => setRequestStatus(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!selectedMR && (
              <div className="space-y-2">
                <Label>Request Date *</Label>
                <Input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} required />
              </div>
            )}

            <div className="p-2.5 rounded bg-slate-50 border text-[11px] text-slate-500">
              Staff member ID and audit trail are recorded automatically from your active session on the server.
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={isSaving}>
                {isSaving ? "Saving..." : selectedMR ? "Update Ticket" : "Save Ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
