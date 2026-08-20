// app/admin/room-features/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Room, Feature } from "@/lib/types";
import { SkeletonTable } from "@/components/shared/SkeletonTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Search, Trash2, Layers, Sparkles } from "lucide-react";

interface RoomFeatureRow {
  room_room_id: number;
  feature_feature_id: number;
  room?: Room;
  feature?: Feature;
}

export default function RoomFeaturesPage() {
  const [links, setLinks] = useState<RoomFeatureRow[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [selectedLink, setSelectedLink] = useState<RoomFeatureRow | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form State
  const [roomId, setRoomId] = useState<string>("");
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<number[]>([]);
  const [formError, setFormError] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rfRes, rRes, fRes] = await Promise.all([
        supabase.from("room_feature").select("*, room(*), feature(*)"),
        supabase.from("room").select("*").order("room_id", { ascending: true }),
        supabase.from("feature").select("*").order("room_features", { ascending: true }),
      ]);

      if (rfRes.data) setLinks(rfRes.data);
      if (rRes.data) setRooms(rRes.data);
      if (fRes.data) setFeatures(fRes.data);
    } catch (err) {
      console.error("Fetch room features error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setSelectedLink(null);
    setRoomId(rooms.length > 0 ? String(rooms[0].room_id) : "");
    setSelectedFeatureIds([]);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleRoomSelectChange = async (newRoomId: string) => {
    setRoomId(newRoomId);
    // Fetch currently linked features for this room
    const { data } = await supabase
      .from("room_feature")
      .select("feature_feature_id")
      .eq("room_room_id", Number(newRoomId));

    if (data) {
      setSelectedFeatureIds(data.map((d) => d.feature_feature_id));
    } else {
      setSelectedFeatureIds([]);
    }
  };

  const handleFeatureToggle = (feature_id: number) => {
    setSelectedFeatureIds((prev) =>
      prev.includes(feature_id) ? prev.filter((id) => id !== feature_id) : [...prev, feature_id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!roomId) {
      setFormError("Please select a room.");
      return;
    }

    setIsSaving(true);
    try {
      // Delete existing links for this room_id then re-insert selected
      await supabase.from("room_feature").delete().eq("room_room_id", Number(roomId));

      if (selectedFeatureIds.length > 0) {
        const rowsToInsert = selectedFeatureIds.map((fId) => ({
          room_room_id: Number(roomId),
          feature_feature_id: fId,
        }));
        const { error } = await supabase.from("room_feature").insert(rowsToInsert);
        if (error) throw error;
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Save room feature link error:", err);
      setFormError(err.message || "Failed to update room feature links.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedLink) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("room_feature")
        .delete()
        .eq("room_room_id", selectedLink.room_room_id)
        .eq("feature_feature_id", selectedLink.feature_feature_id);

      if (error) throw error;
      await fetchData();
      setIsDeleteOpen(false);
    } catch (err) {
      console.error("Delete room feature error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = links.filter((l) => {
    const search = searchTerm.toLowerCase();
    const roomText = `room ${l.room_room_id} ${l.room?.room_desc || ""}`.toLowerCase();
    const featureText = (l.feature?.room_features || "").toLowerCase();
    return roomText.includes(search) || featureText.includes(search);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Room Feature Junction</h1>
          <p className="text-slate-500 text-sm">Link amenities and room features directly to physical rooms.</p>
        </div>
        <Button onClick={handleOpenAdd} variant="gold" className="gap-2">
          <Plus className="h-4 w-4" /> Manage Room Amenities
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by Room ID or Feature name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {loading ? (
        <SkeletonTable rows={5} columns={4} />
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Room Description</th>
                  <th className="px-4 py-3">Linked Feature</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      No room feature links found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((l) => (
                    <tr key={`${l.room_room_id}-${l.feature_feature_id}`} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono text-navy-900 border-navy-300">
                          Room #{l.room_room_id}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{l.room?.room_desc || "N/A"}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-gold-500 text-navy-900 font-semibold gap-1">
                          <Sparkles className="h-3 w-3" /> {l.feature?.room_features || `Feature #${l.feature_feature_id}`}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedLink(l);
                            setIsDeleteOpen(true);
                          }}
                        >
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
            {filtered.map((l) => (
              <div key={`${l.room_room_id}-${l.feature_feature_id}`} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <Badge variant="outline" className="font-mono font-bold">Room #{l.room_room_id}</Badge>
                  <Badge className="bg-gold-500 text-navy-900 font-semibold">
                    {l.feature?.room_features}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600">{l.room?.room_desc}</div>
                <div className="pt-2 border-t border-slate-100 text-right">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setSelectedLink(l);
                      setIsDeleteOpen(true);
                    }}
                  >
                    Unlink Feature
                  </Button>
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
            <DialogTitle>Manage Room Features & Amenities</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {formError && <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded">{formError}</p>}

            <div className="space-y-2">
              <Label>Select Room *</Label>
              <Select value={roomId} onValueChange={handleRoomSelectChange}>
                <SelectTrigger><SelectValue placeholder="Choose room..." /></SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.room_id} value={String(r.room_id)}>
                      Room #{r.room_id} {r.room_desc ? `- ${r.room_desc}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select Amenities / Features Checklist *</Label>
              <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-slate-50">
                {features.map((f) => {
                  const checked = selectedFeatureIds.includes(f.feature_id);
                  return (
                    <div key={f.feature_id} className="flex items-center space-x-2 bg-white p-2 rounded border border-slate-100">
                      <Checkbox
                        id={`feat-${f.feature_id}`}
                        checked={checked}
                        onCheckedChange={() => handleFeatureToggle(f.feature_id)}
                      />
                      <label htmlFor={`feat-${f.feature_id}`} className="text-xs font-medium text-slate-800 cursor-pointer flex-1">
                        {f.room_features} {f.feature_desc ? `(${f.feature_desc})` : ""}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Feature Links"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Unlink Feature</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Remove link between <strong>Room #{selectedLink?.room_room_id}</strong> and feature <strong>{selectedLink?.feature?.room_features}</strong>?
          </p>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving ? "Unlinking..." : "Unlink Feature"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
