"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { TourModal } from "@/components/modals/TourModal";
import { Tour } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getImageUrl } from "@/lib/imageUtils";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Clock } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";

export default function ToursPage() {
  const { user } = useUser();
  const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";

  const [tours, setTours] = useState<Tour[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTours = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("tour").select("*").order("tour_id");
      if (!error && data) {
        setTours(data);
      }
    } catch (err) {
      console.error("Error loading tours:", err);
    }
  }, []);

  useEffect(() => {
    fetchTours();
  }, [fetchTours]);

  const handleOpenAdd = () => {
    setSelectedTour(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Tour) => {
    setSelectedTour(item);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (item: Tour) => {
    setSelectedTour(item);
    setIsDeleteOpen(true);
  };

  const handleSubmitModal = async (values: {
    tour_name: string;
    tour_desc?: string | null;
    adult_price: number;
    child_price: number;
    durations: number;
    image_path?: string | null;
  }) => {
    setIsLoading(true);
    const now = new Date().toISOString();
    const trimmedName = values.tour_name.trim();

    // 1. Client-side duplicate check (case-insensitive & trimmed)
    const isDuplicate = tours.some((t) => {
      if (selectedTour && t.tour_id === selectedTour.tour_id) return false;
      return t.tour_name.trim().toLowerCase() === trimmedName.toLowerCase();
    });

    if (isDuplicate) {
      setIsLoading(false);
      return {
        success: false,
        error: `A tour with the name "${trimmedName}" already exists. Please choose a unique name.`,
      };
    }

    if (selectedTour) {
      // Update
      try {
        let { error } = await supabase
          .from("tour")
          .update({
            tour_name: trimmedName,
            tour_desc: values.tour_desc,
            adult_price: values.adult_price,
            child_price: values.child_price,
            durations: values.durations,
            image_path: values.image_path || null,
            updated_by_: currentUserEmail,
            date_updated: now,
          })
          .eq("tour_id", selectedTour.tour_id);

        if (error && error.message?.includes("image_path")) {
          const retry = await supabase
            .from("tour")
            .update({
              tour_name: trimmedName,
              tour_desc: values.tour_desc,
              adult_price: values.adult_price,
              child_price: values.child_price,
              durations: values.durations,
              updated_by_: currentUserEmail,
              date_updated: now,
            })
            .eq("tour_id", selectedTour.tour_id);
          error = retry.error;
        }

        if (error) {
          setIsLoading(false);
          if (error.code === "23505") {
            return {
              success: false,
              error: `A tour with the name "${trimmedName}" already exists in the database.`,
            };
          }
          return { success: false, error: error.message || "Failed to update tour." };
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || "Failed to update tour." };
      }
    } else {
      // Create
      try {
        let { error } = await supabase.from("tour").insert([
          {
            tour_name: trimmedName,
            tour_desc: values.tour_desc,
            adult_price: values.adult_price,
            child_price: values.child_price,
            durations: values.durations,
            image_path: values.image_path || null,
            created_by: currentUserEmail,
            date_created: now,
          },
        ]);

        if (error && error.message?.includes("image_path")) {
          const retry = await supabase.from("tour").insert([
            {
              tour_name: trimmedName,
              tour_desc: values.tour_desc,
              adult_price: values.adult_price,
              child_price: values.child_price,
              durations: values.durations,
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
              error: `A tour with the name "${trimmedName}" already exists in the database.`,
            };
          }
          return { success: false, error: error.message || "Failed to create tour." };
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || "Failed to create tour." };
      }
    }

    await fetchTours();
    setIsLoading(false);
    setIsModalOpen(false);
    return { success: true };
  };

  const handleConfirmDelete = async () => {
    if (!selectedTour) return;
    setIsLoading(true);

    try {
      if (selectedTour.image_path && !selectedTour.image_path.startsWith("http")) {
        fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_path: selectedTour.image_path }),
        }).catch((e) => console.warn("Failed to delete storage image on tour delete:", e));
      }

      await supabase.from("tour").delete().eq("tour_id", selectedTour.tour_id);
    } catch (err) {
      console.error("Delete tour error:", err);
    }

    await fetchTours();
    setIsLoading(false);
    setIsDeleteOpen(false);
  };

  const columns: Column<Tour>[] = [
    { header: "ID", accessorKey: "tour_id", className: "w-14 text-center" },
    {
      header: "Photo",
      className: "w-20",
      cell: (row) => {
        const previewUrl = getImageUrl(row.image_path, "tour");
        return (
          <div className="h-10 w-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
            <img
              src={previewUrl}
              alt={row.tour_name}
              className="h-full w-full object-cover"
            />
          </div>
        );
      },
    },
    {
      header: "Tour Name",
      cell: (row) => (
        <span className="font-semibold text-navy-900">{row.tour_name}</span>
      ),
    },
    {
      header: "Duration",
      cell: (row) => (
        <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs font-medium">
          <Clock className="h-3 w-3 text-gold-500" />
          {row.durations} {row.durations === 1 ? "hour" : "hours"}
        </span>
      ),
    },
    {
      header: "Adult Rate",
      cell: (row) => (
        <span className="font-bold text-navy-900">{formatCurrency(row.adult_price)}</span>
      ),
    },
    {
      header: "Child Rate",
      cell: (row) => (
        <span className="font-bold text-slate-700">{formatCurrency(row.child_price)}</span>
      ),
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
            title="Edit Tour"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleOpenDelete(row)}
            className="h-8 w-8 text-red-600 hover:bg-red-50"
            title="Delete Tour"
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
        title="Island Excursions & Tours"
        description="Configure guided island excursions, catamaran trips, activity durations, and promotional imagery."
        data={tours}
        columns={columns}
        isLoading={isLoading}
        searchKey="tour_name"
        searchPlaceholder="Filter tours by title..."
        onAddNew={handleOpenAdd}
        addNewLabel="Add Tour"
      />

      <TourModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitModal}
        initialData={selectedTour}
        isLoading={isLoading}
      />

      <DeleteDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Excursion Tour"
        description={`Are you sure you want to delete "${selectedTour?.tour_name}"? Scheduled departures for this tour will also be removed.`}
        isLoading={isLoading}
      />
    </div>
  );
}
