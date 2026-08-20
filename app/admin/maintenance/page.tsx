// app/admin/maintenance/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { MaintenanceRequest, Room } from "@/lib/types";
import { formatDate } from "@/lib/utils";
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
import { Plus, Search, Trash2, Edit, Wrench, AlertTriangle, CheckCircle, Clock } from "lucide-react";

export default function MaintenancePage() {
  const { user } = useUser();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [selectedMR, setSelectedMR] = useState<MaintenanceRequest | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form
  const [roomId, setRoomId] = useState<string>("");
  const [mrDesc, setMrDesc] = useState<string>("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Urgent">("Medium");
  const [requestStatus, setRequestStatus] = useState<"Open" | "In Progress" | "Resolved">("Open");
  const [requestDate, setRequestDate] = useState<string>("");
  const [formError, setFormError] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, rRes] = await Promise.all([
        supabase.from("maintenance_request").select("*, room(*)").order("mr_id", { ascending: false }),
        supabase.from("room").select("*").order("room_id", { ascending: true }),
      ]);

      if (mRes.data) setRequests(mRes.data);
      if (rRes.data) setRooms(rRes.data);
    } catch (err) {
      console.error("Fetch maintenance error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setSelectedMR(null);
    setRoomId(rooms.length > 0 ? String(rooms[0].room_id) : "");
    setMrDesc("");
    setPriority("Medium");
    setRequestStatus("Open");
    setRequestDate(new Date().toISOString().split("T")[0]);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (mr: MaintenanceRequest) => {
    setSelectedMR(mr);
    setRoomId(String(mr.room_room_id));
    setMrDesc(mr.mr_desc || "");
    setPriority(mr.priority);
    setRequestStatus(mr.request_status);
    setRequestDate(mr.request_date.split("T")[0]);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenDelete = (mr: MaintenanceRequest) => {
    setSelectedMR(mr);
    setIsDeleteOpen(true);
  };

  const handleInlineStatusChange = async (mr_id: number, newStatus: "Open" | "In Progress" | "Resolved") => {
    try {
      const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";
      const { error } = await supabase
        .from("maintenance_request")
        .update({
          request_status: newStatus,
          updated_by_: currentUserEmail,
          date_updated: new Date().toISOString(),
        })
        .eq("mr_id", mr_id);

      if (error) throw error;
      await fetchData();
    } catch (err) {
      console.error("Inline status update error:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!roomId || !mrDesc) {
      setFormError("Please select a room and enter description.");
      return;
    }

    setIsSaving(true);
    const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";
    const now = new Date().toISOString();

    try {
      if (selectedMR) {
        const { error } = await supabase
          .from("maintenance_request")
          .update({
            room_room_id: Number(roomId),
            mr_desc: mrDesc,
            priority,
            request_status: requestStatus,
            request_date: requestDate,
            updated_by_: currentUserEmail,
            date_updated: now,
          })
          .eq("mr_id", selectedMR.mr_id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("maintenance_request").insert([
          {
            room_room_id: Number(roomId),
            mr_desc: mrDesc,
            priority,
            request_status: requestStatus,
            request_date: requestDate,
            created_by: currentUserEmail,
            date_created: now,
            updated_by_: currentUserEmail,
            date_updated: now,
          },
        ]);

        if (error) throw error;
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Save MR error:", err);
      setFormError(err.message || "Failed to save maintenance request.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMR) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("maintenance_request").delete().eq("mr_id", selectedMR.mr_id);
      if (error) throw error;
      await fetchData();
      setIsDeleteOpen(false);
    } catch (err) {
      console.error("Delete MR error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = requests.filter((r) => {
    const search = searchTerm.toLowerCase();
    const roomInfo = `room ${r.room_room_id} ${r.room?.room_desc || ""}`.toLowerCase();
    return String(r.mr_id).includes(search) || roomInfo.includes(search) || (r.mr_desc || "").toLowerCase().includes(search);
  });

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "Urgent":
        return <Badge className="bg-red-600 hover:bg-red-700 text-white">Urgent</Badge>;
      case "High":
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">High</Badge>;
      case "Medium":
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Medium</Badge>;
      case "Low":
        return <Badge className="bg-slate-400 hover:bg-slate-500 text-white">Low</Badge>;
      default:
        return <Badge variant="outline">{p}</Badge>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "Resolved":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1"><CheckCircle className="h-3 w-3" /> Resolved</Badge>;
      case "In Progress":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1"><Clock className="h-3 w-3" /> In Progress</Badge>;
      case "Open":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white gap-1"><AlertTriangle className="h-3 w-3" /> Open</Badge>;
      default:
        return <Badge variant="outline">{s}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Maintenance Requests</h1>
          <p className="text-slate-500 text-sm">Property repair tickets, urgent issues, and resolution status updates.</p>
        </div>
        <Button onClick={handleOpenAdd} variant="gold" className="gap-2">
          <Plus className="h-4 w-4" /> Create Ticket
        </Button>
      </div>

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
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Room & Description</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Request Date</th>
                  <th className="px-4 py-3">Logged By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
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
                  filtered.map((r) => (
                    <tr key={r.mr_id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-navy-900">#{r.mr_id}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">
                          Room #{r.room_room_id} {r.room?.room_desc ? `(${r.room.room_desc})` : ""}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">{r.mr_desc}</div>
                      </td>
                      <td className="px-4 py-3">{getPriorityBadge(r.priority)}</td>
                      <td className="px-4 py-3">
                        <Select
                          value={r.request_status}
                          onValueChange={(val: any) => handleInlineStatusChange(r.mr_id, val)}
                        >
                          <SelectTrigger className="h-8 w-36 border-none p-0 bg-transparent">
                            <SelectValue>{getStatusBadge(r.request_status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Open">Open</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(r.request_date)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.created_by || "System"}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(r)}>
                          <Edit className="h-4 w-4 text-slate-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(r)}>
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
            {filtered.map((r) => (
              <div key={r.mr_id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-xs text-gold-600">Ticket #{r.mr_id}</span>
                  {getPriorityBadge(r.priority)}
                </div>
                <div className="font-bold text-navy-900">Room #{r.room_room_id}</div>
                <p className="text-xs text-slate-600">{r.mr_desc}</p>
                <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                  {getStatusBadge(r.request_status)}
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => handleOpenEdit(r)}>Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleOpenDelete(r)}>Delete</Button>
                  </div>
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
            <DialogTitle>{selectedMR ? "Edit Maintenance Ticket" : "Log Maintenance Request"}</DialogTitle>
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
                placeholder="e.g. AC unit leaking in bedroom..."
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
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status *</Label>
                <Select value={requestStatus} onValueChange={(val: any) => setRequestStatus(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Request Date *</Label>
              <Input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} required />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={isSaving}>
                {isSaving ? "Saving..." : selectedMR ? "Update Ticket" : "Save Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete Ticket</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Are you sure you want to delete maintenance ticket <strong>#{selectedMR?.mr_id}</strong>?
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
