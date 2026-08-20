"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { TourModal } from "@/components/modals/TourModal";
import { Tour } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Clock } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";

const initialTours: Tour[] = [
  {
    tour_id: 1,
    tour_name: "Island Excursion",
    tour_desc: "Full day catamaran boat tour with snorkeling & beach lunch",
    adult_price: 120.0,
    child_price: 60.0,
    durations: 8,
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
  {
    tour_id: 2,
    tour_name: "City Heritage Walk",
    tour_desc: "Guided historical walking tour around old city landmarks",
    adult_price: 40.0,
    child_price: 20.0,
    durations: 3,
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
];

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
    } catch {
      // Keep initial client mock data
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
  }) => {
    setIsLoading(true);
    const now = new Date().toISOString();

    if (selectedTour) {
      // Update
      try {
        await supabase
          .from("tour")
          .update({
            tour_name: values.tour_name,
            tour_desc: values.tour_desc,
            adult_price: values.adult_price,
            child_price: values.child_price,
            durations: values.durations,
            updated_by_: currentUserEmail,
            date_updated: now,
          })
          .eq("tour_id", selectedTour.tour_id);
      } catch (err) {
        console.error("Update tour error:", err);
      }
    } else {
      // Create
      try {
        await supabase.from("tour").insert([
          {
            tour_name: values.tour_name,
            tour_desc: values.tour_desc,
            adult_price: values.adult_price,
            child_price: values.child_price,
            durations: values.durations,
            created_by: currentUserEmail,
            date_created: now,
          },
        ]);
      } catch (err) {
        console.error("Insert tour error:", err);
      }
    }

    await fetchTours();
    setIsLoading(false);
    setIsModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!selectedTour) return;
    setIsLoading(true);

    try {
      await supabase.from("tour").delete().eq("tour_id", selectedTour.tour_id);
    } catch (err) {
      console.error("Delete tour error:", err);
    }

    await fetchTours();
    setIsLoading(false);
    setIsDeleteOpen(false);
  };

  const columns: Column<Tour>[] = [
    { header: "ID", accessorKey: "tour_id", className: "w-16 text-center" },
    {
      header: "Tour Name",
      cell: (row) => (
        <span className="font-semibold text-navy-900">{row.tour_name}</span>
      ),
    },
    {
      header: "Duration",
      cell: (row) => (
        <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">
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
        title="Tours & Excursions Catalog"
        description="Configure guest trips, durations in whole hours, adult rates, and child pricing."
        columns={columns}
        data={tours}
        searchKey="tour_name"
        searchPlaceholder="Filter tours..."
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
        title="Delete Tour Excursion"
        description={`Are you sure you want to delete tour "${selectedTour?.tour_name}"? This action cannot be undone.`}
        isLoading={isLoading}
      />
    </div>
  );
}
