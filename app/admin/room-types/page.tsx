"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { RoomTypeModal } from "@/components/modals/RoomTypeModal";
import { RoomType } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getImageUrl } from "@/lib/imageUtils";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";

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
    } catch (err) {
      console.error("Error fetching room types:", err);
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

  const handleSubmitModal = async (values: {
    type: string;
    price: number;
    size: number;
    max_adults: number;
    max_children: number;
    image_path?: string | null;
  }) => {
    setIsLoading(true);
    const now = new Date().toISOString();
    const trimmedType = values.type.trim();

    // 1. Client-side duplicate name check (case-insensitive)
    const isDuplicate = roomTypes.some((rt) => {
      if (selectedRoomType && rt.room_type_id === selectedRoomType.room_type_id) return false;
      return rt.type.trim().toLowerCase() === trimmedType.toLowerCase();
    });

    if (isDuplicate) {
      setIsLoading(false);
      return {
        success: false,
        error: `A room type with the name "${trimmedType}" already exists. Please choose a unique name.`,
      };
    }

    if (selectedRoomType) {
      // Update
      try {
        let { error } = await supabase
          .from("room_type")
          .update({
            type: trimmedType,
            price: values.price,
            size: values.size,
            max_adults: values.max_adults,
            max_children: values.max_children,
            image_path: values.image_path || null,
            updated_by_: currentUserEmail,
            date_updated: now,
          })
          .eq("room_type_id", selectedRoomType.room_type_id);

        // Fallback retry if schema cache doesn't have image_path yet
        if (error && error.message?.includes("image_path")) {
          const retry = await supabase
            .from("room_type")
            .update({
              type: trimmedType,
              price: values.price,
              size: values.size,
              max_adults: values.max_adults,
              max_children: values.max_children,
              updated_by_: currentUserEmail,
              date_updated: now,
            })
            .eq("room_type_id", selectedRoomType.room_type_id);
          error = retry.error;
        }

        if (error) {
          setIsLoading(false);
          if (error.code === "23505") {
            return {
              success: false,
              error: `A room type with the name "${trimmedType}" already exists in the database.`,
            };
          }
          return { success: false, error: error.message || "Failed to update room type." };
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || "Failed to update room type." };
      }
    } else {
      // Create
      try {
        let { error } = await supabase.from("room_type").insert([
          {
            type: trimmedType,
            price: values.price,
            size: values.size,
            max_adults: values.max_adults,
            max_children: values.max_children,
            image_path: values.image_path || null,
            created_by: currentUserEmail,
            date_created: now,
          },
        ]);

        if (error && error.message?.includes("image_path")) {
          const retry = await supabase.from("room_type").insert([
            {
              type: trimmedType,
              price: values.price,
              size: values.size,
              max_adults: values.max_adults,
              max_children: values.max_children,
              created_by: currentUserEmail,
              date_created: now,
            },
          ]);
          error = retry.error;
        }

        if (error) {
          setIsLoading(false);
          if (error.code === "23505") {
            return {
              success: false,
              error: `A room type with the name "${trimmedType}" already exists in the database.`,
            };
          }
          return { success: false, error: error.message || "Failed to create room type." };
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || "Failed to create room type." };
      }
    }

    await fetchRoomTypes();
    setIsLoading(false);
    setIsModalOpen(false);
    return { success: true };
  };

  const handleConfirmDelete = async () => {
    if (!selectedRoomType) return;
    setIsLoading(true);

    try {
      // If room type had an uploaded image, clean up from storage
      if (selectedRoomType.image_path && !selectedRoomType.image_path.startsWith("http")) {
        fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_path: selectedRoomType.image_path }),
        }).catch((e) => console.warn("Failed to delete storage image on room type delete:", e));
      }

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
    { header: "ID", accessorKey: "room_type_id", className: "w-14 text-center" },
    {
      header: "Photo",
      className: "w-20",
      cell: (row) => {
        const previewUrl = getImageUrl(row.image_path, "room");
        return (
          <div className="h-10 w-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
            <img
              src={previewUrl}
              alt={row.type}
              className="h-full w-full object-cover"
            />
          </div>
        );
      },
    },
    { header: "Type Name", accessorKey: "type", className: "font-semibold text-navy-900" },
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
      header: "Capacity",
      cell: (row) => (
        <span className="text-xs font-medium text-slate-700">
          Max {row.max_adults || 2} Adults, {row.max_children ?? 2} Children
        </span>
      ),
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
        description="Configure room categories, nightly base rates, room dimensions, and showcase catalog photography."
        data={roomTypes}
        columns={columns}
        isLoading={isLoading}
        searchKey="type"
        searchPlaceholder="Filter by room type..."
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
        description={`Are you sure you want to delete "${selectedRoomType?.type}"? This may impact active rooms and reservations linked to this category.`}
        isLoading={isLoading}
      />
    </div>
  );
}
