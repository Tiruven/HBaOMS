"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { RoomModal } from "@/components/modals/RoomModal";
import { Room, RoomType, Feature } from "@/lib/types";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";

const mockRoomTypes: RoomType[] = [
  { room_type_id: 1, type: "Deluxe Suite", price: 250.0, size: 45.0 },
  { room_type_id: 2, type: "Standard Double", price: 120.0, size: 28.0 },
  { room_type_id: 3, type: "Executive Suite", price: 320.0, size: 55.0 },
];

const initialRooms: Room[] = [
  {
    room_id: 101,
    room_desc: "Room 101 - Floor 1 Ocean Side",
    room_status: "Available",
    room_type_room_type_id: 1,
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
  {
    room_id: 102,
    room_desc: "Room 102 - Floor 1 Ocean Side",
    room_status: "Maintenance",
    room_type_room_type_id: 1,
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
  {
    room_id: 201,
    room_desc: "Room 201 - Floor 2 Garden View",
    room_status: "Available",
    room_type_room_type_id: 2,
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
];

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
      const [rtRes, roomsRes, featuresRes] = await Promise.all([
        supabase.from("room_type").select("*").order("room_type_id"),
        supabase.from("room").select("*, room_type(*), room_feature(feature(*))").order("room_id"),
        supabase.from("feature").select("*").order("feature_id"),
      ]);

      if (!rtRes.error && rtRes.data) {
        setRoomTypes(rtRes.data);
      }
      if (!roomsRes.error && roomsRes.data) {
        setRooms(roomsRes.data);
      }
      if (!featuresRes.error && featuresRes.data) {
        setFeatures(featuresRes.data);
      }
    } catch (err) {
      console.error("fetchData error:", err);
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
  }) => {
    setIsLoading(true);
    const now = new Date().toISOString();

    if (selectedRoom) {
      // Update
      try {
        await supabase
          .from("room")
          .update({
            room_desc: values.room_desc,
            room_status: values.room_status,
            room_type_room_type_id: values.room_type_room_type_id,
            updated_by_: currentUserEmail,
            date_updated: now,
          })
          .eq("room_id", selectedRoom.room_id);

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
      } catch (err) {
        console.error("Update room error:", err);
      }
    } else {
      // Create
      try {
        const { data, error } = await supabase
          .from("room")
          .insert([
            {
              room_desc: values.room_desc,
              room_status: values.room_status,
              room_type_room_type_id: values.room_type_room_type_id,
              created_by: currentUserEmail,
              date_created: now,
            },
          ])
          .select();

        if (error) throw error;

        if (data && data[0] && values.feature_ids && values.feature_ids.length > 0) {
          const newRoomId = data[0].room_id;
          const featureInserts = values.feature_ids.map((fid) => ({
            room_room_id: newRoomId,
            feature_feature_id: fid,
          }));
          await supabase.from("room_feature").insert(featureInserts);
        }
      } catch (err) {
        console.error("Insert room error:", err);
      }
    }

    await fetchData();
    setIsLoading(false);
    setIsModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!selectedRoom) return;
    setIsLoading(true);

    try {
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
    { header: "Room #", accessorKey: "room_id", className: "w-20 text-center" },
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
      header: "Created By",
      cell: (row) => <span className="text-xs text-slate-500">{row.created_by || "System"}</span>,
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
        title="Rooms Inventory Management"
        description="Manage guest room allocations, type categorization, and operational availability status."
        columns={columns}
        data={rooms}
        searchKey="room_desc"
        searchPlaceholder="Filter rooms..."
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
        title="Delete Guest Room"
        description={`Are you sure you want to delete room "${selectedRoom?.room_desc}"? This action cannot be undone.`}
        isLoading={isLoading}
      />
    </div>
  );
}
