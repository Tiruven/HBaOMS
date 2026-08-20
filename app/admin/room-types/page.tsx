"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { RoomTypeModal } from "@/components/modals/RoomTypeModal";
import { RoomType } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";

const initialRoomTypes: RoomType[] = [
  {
    room_type_id: 1,
    type: "Deluxe Suite",
    price: 250.0,
    size: 45.0,
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
  {
    room_type_id: 2,
    type: "Standard Double",
    price: 120.0,
    size: 28.0,
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
  {
    room_type_id: 3,
    type: "Executive Suite",
    price: 320.0,
    size: 55.0,
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
];

export default function RoomTypesPage() {
  const { user } = useUser();
  const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";

  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRoomTypes = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("room_type").select("*").order("room_type_id");
      if (!error && data) {
        setRoomTypes(data);
      }
    } catch {
      // Keep initial client mock data state
    }
  }, []);

  useEffect(() => {
    fetchRoomTypes();
  }, [fetchRoomTypes]);

  const handleOpenAdd = () => {
    setSelectedRoomType(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: RoomType) => {
    setSelectedRoomType(item);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (item: RoomType) => {
    setSelectedRoomType(item);
    setIsDeleteOpen(true);
  };

  const handleSubmitModal = async (values: { type: string; price: number; size: number }) => {
    setIsLoading(true);
    const now = new Date().toISOString();

    if (selectedRoomType) {
      // Update
      try {
        await supabase
          .from("room_type")
          .update({
            type: values.type,
            price: values.price,
            size: values.size,
            updated_by_: currentUserEmail,
            date_updated: now,
          })
          .eq("room_type_id", selectedRoomType.room_type_id);
      } catch (err) {
        console.error("Update room_type error:", err);
      }
    } else {
      // Create
      try {
        await supabase.from("room_type").insert([
          {
            type: values.type,
            price: values.price,
            size: values.size,
            created_by: currentUserEmail,
            date_created: now,
          },
        ]);
      } catch (err) {
        console.error("Insert room_type error:", err);
      }
    }

    await fetchRoomTypes();
    setIsLoading(false);
    setIsModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!selectedRoomType) return;
    setIsLoading(true);

    try {
      await supabase
        .from("room_type")
        .delete()
        .eq("room_type_id", selectedRoomType.room_type_id);
    } catch (err) {
      console.error("Delete room_type error:", err);
    }

    await fetchRoomTypes();
    setIsLoading(false);
    setIsDeleteOpen(false);
  };

  const columns: Column<RoomType>[] = [
    { header: "ID", accessorKey: "room_type_id", className: "w-16 text-center" },
    { header: "Type Name", accessorKey: "type" },
    {
      header: "Price / Night",
      cell: (row) => (
        <span className="font-bold text-navy-900">{formatCurrency(row.price)}</span>
      ),
    },
    {
      header: "Size (m²)",
      cell: (row) => <span>{row.size} m²</span>,
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
            title="Edit Room Type"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleOpenDelete(row)}
            className="h-8 w-8 text-red-600 hover:bg-red-50"
            title="Delete Room Type"
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
        title="Room Types Management"
        description="Configure room categories, nightly base rates, and room dimensions."
        columns={columns}
        data={roomTypes}
        searchKey="type"
        searchPlaceholder="Filter room types..."
        onAddNew={handleOpenAdd}
        addNewLabel="Add Room Type"
      />

      <RoomTypeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitModal}
        initialData={selectedRoomType}
        isLoading={isLoading}
      />

      <DeleteDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Room Type"
        description={`Are you sure you want to delete room type "${selectedRoomType?.type}"? This action cannot be undone.`}
        isLoading={isLoading}
      />
    </div>
  );
}
