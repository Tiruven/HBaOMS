"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { RoomModal } from "@/components/modals/RoomModal";
import { Room, RoomType, Feature } from "@/lib/types";
import { formatDate, formatCurrency } from "@/lib/utils";
import { getImageUrl } from "@/lib/imageUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";

export default function RoomsPage() {
  const { user } = useUser();
  const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [rRes, rtRes, fRes] = await Promise.all([
        supabase
          .from("room")
          .select("*, room_type(*), room_feature(feature(*))")
          .order("room_id"),
        supabase.from("room_type").select("*").order("room_type_id"),
        supabase.from("feature").select("*").order("feature_id"),
      ]);

      if (!rRes.error && rRes.data) {
        setRooms(rRes.data as Room[]);
      }
      if (!rtRes.error && rtRes.data) {
        setRoomTypes(rtRes.data);
      }
      if (!fRes.error && fRes.data) {
        setFeatures(fRes.data);
      }
    } catch (err) {
      console.error("Error fetching rooms data:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenAdd = () => {
    setSelectedRoom(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Room) => {
    setSelectedRoom(item);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (item: Room) => {
    setSelectedRoom(item);
    setIsDeleteOpen(true);
  };

  const handleSubmitModal = async (values: {
    room_desc: string;
    room_status: "Available" | "Maintenance";
    room_type_room_type_id: number;
    feature_ids?: number[];
    image_path?: string | null;
  }) => {
    setIsLoading(true);
    const now = new Date().toISOString();
    const trimmedDesc = values.room_desc.trim();

    // 1. Client-side duplicate check (case-insensitive & trimmed)
    const isDuplicate = rooms.some((r) => {
      if (selectedRoom && r.room_id === selectedRoom.room_id) return false;
      return r.room_desc?.trim().toLowerCase() === trimmedDesc.toLowerCase();
    });

    if (isDuplicate) {
      setIsLoading(false);
      return {
        success: false,
        error: `A room with the name or description "${trimmedDesc}" already exists. Please provide a unique room name/number.`,
      };
    }

    if (selectedRoom) {
      // Update
      try {
        let { error } = await supabase
          .from("room")
          .update({
            room_desc: trimmedDesc,
            room_status: values.room_status,
            room_type_room_type_id: values.room_type_room_type_id,
            image_path: values.image_path || null,
            updated_by_: currentUserEmail,
            date_updated: now,
          })
          .eq("room_id", selectedRoom.room_id);

        if (error && error.message?.includes("image_path")) {
          const retry = await supabase
            .from("room")
            .update({
              room_desc: trimmedDesc,
              room_status: values.room_status,
              room_type_room_type_id: values.room_type_room_type_id,
              updated_by_: currentUserEmail,
              date_updated: now,
            })
            .eq("room_id", selectedRoom.room_id);
          error = retry.error;
        }

        if (error) {
          setIsLoading(false);
          if (error.code === "23505") {
            return {
              success: false,
              error: `A room with the name "${trimmedDesc}" already exists in the database.`,
            };
          }
          return { success: false, error: error.message || "Failed to update room." };
        }

        // Delete existing room_feature entries
        await supabase
          .from("room_feature")
          .delete()
          .eq("room_room_id", selectedRoom.room_id);

        // Insert new room_feature entries
        if (values.feature_ids && values.feature_ids.length > 0) {
          const featureInserts = values.feature_ids.map((fid) => ({
            room_room_id: selectedRoom.room_id,
            feature_feature_id: fid,
          }));
          await supabase.from("room_feature").insert(featureInserts);
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || "Failed to update room." };
      }
    } else {
      // Create
      try {
        let { data, error } = await supabase
          .from("room")
          .insert([
            {
              room_desc: trimmedDesc,
              room_status: values.room_status,
              room_type_room_type_id: values.room_type_room_type_id,
              image_path: values.image_path || null,
              created_by: currentUserEmail,
              date_created: now,
            },
          ])
          .select();

        if (error && error.message?.includes("image_path")) {
          const retry = await supabase
            .from("room")
            .insert([
              {
                room_desc: trimmedDesc,
                room_status: values.room_status,
                room_type_room_type_id: values.room_type_room_type_id,
                created_by: currentUserEmail,
                date_created: now,
              },
            ])
            .select();
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          setIsLoading(false);
          if (error.code === "23505") {
            return {
              success: false,
              error: `A room with the name "${trimmedDesc}" already exists in the database.`,
            };
          }
          return { success: false, error: error.message || "Failed to create room." };
        }

        if (data && data[0] && values.feature_ids && values.feature_ids.length > 0) {
          const newRoomId = data[0].room_id;
          const featureInserts = values.feature_ids.map((fid) => ({
            room_room_id: newRoomId,
            feature_feature_id: fid,
          }));
          await supabase.from("room_feature").insert(featureInserts);
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || "Failed to create room." };
      }
    }

    await fetchData();
    setIsLoading(false);
    setIsModalOpen(false);
    return { success: true };
  };

  const handleConfirmDelete = async () => {
    if (!selectedRoom) return;
    setIsLoading(true);

    try {
      if (selectedRoom.image_path && !selectedRoom.image_path.startsWith("http")) {
        fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_path: selectedRoom.image_path }),
        }).catch((e) => console.warn("Failed to delete storage image on room delete:", e));
      }

      await supabase.from("room").delete().eq("room_id", selectedRoom.room_id);
    } catch (err) {
      console.error("Delete room error:", err);
    }

    await fetchData();
    setIsLoading(false);
    setIsDeleteOpen(false);
  };

  const getRoomTypeName = (typeId: number) => {
    const matched = roomTypes.find((rt) => rt.room_type_id === typeId);
    return matched ? `${matched.type} (${formatCurrency(matched.price)})` : `Type #${typeId}`;
  };

  const columns: Column<Room>[] = [
    { header: "Room #", accessorKey: "room_id", className: "w-16 text-center" },
    {
      header: "Photo",
      className: "w-20",
      cell: (row) => {
        const previewUrl = getImageUrl(row.image_path || row.room_type?.image_path, "room");
        return (
          <div className="h-10 w-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
            <img
              src={previewUrl}
              alt={row.room_desc || `Room #${row.room_id}`}
              className="h-full w-full object-cover"
            />
          </div>
        );
      },
    },
    {
      header: "Description / Location",
      cell: (row) => (
        <span className="font-semibold text-navy-900">{row.room_desc}</span>
      ),
    },
    {
      header: "Category & Rate",
      cell: (row) => <span>{getRoomTypeName(row.room_type_room_type_id)}</span>,
    },
    {
      header: "Status",
      cell: (row) => (
        <Badge
          variant={row.room_status === "Available" ? "success" : "destructive"}
          className="uppercase tracking-wider font-bold"
        >
          {row.room_status}
        </Badge>
      ),
    },
    {
      header: "Features",
      cell: (row) => {
        const linked = row.room_feature?.map((rf) => rf.feature).filter(Boolean) || [];
        if (linked.length === 0) return <span className="text-slate-400 text-xs">No features</span>;
        return (
          <div className="flex flex-wrap gap-1 max-w-[220px]">
            {linked.map((f) => (
              <Badge key={f.feature_id} variant="outline" className="text-[10px] bg-slate-50 text-slate-700 border-slate-200 font-medium">
                {f.room_features}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      header: "Date Created",
      cell: (row) => (
        <span className="text-xs text-slate-500">{formatDate(row.date_created)}</span>
      ),
    },
    {
      header: "Actions",
      className: "w-28 text-right",
      cell: (row) => (
        <div className="flex items-center justify-end space-x-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleOpenEdit(row)}
            className="h-8 w-8 text-navy-900 hover:bg-navy-50"
            title="Edit Room"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleOpenDelete(row)}
            className="h-8 w-8 text-red-600 hover:bg-red-50"
            title="Delete Room"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <DataTable
        title="Physical Rooms Directory"
        description="Oversee individual guest room numbers, statuses, amenities, and room photography."
        data={rooms}
        columns={columns}
        isLoading={isLoading}
        searchKey="room_desc"
        searchPlaceholder="Filter rooms by name/number..."
        onAddNew={handleOpenAdd}
        addNewLabel="Add Room"
      />

      <RoomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitModal}
        initialData={selectedRoom}
        roomTypes={roomTypes}
        features={features}
        isLoading={isLoading}
      />

      <DeleteDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Physical Room"
        description={`Are you sure you want to remove "${selectedRoom?.room_desc}" (Room #${selectedRoom?.room_id}) from inventory?`}
        isLoading={isLoading}
      />
    </div>
  );
}
