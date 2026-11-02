"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { DataTable, Column } from "@/components/shared/DataTable";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { FeatureModal } from "@/components/modals/FeatureModal";
import { Feature } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Layers } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";

const initialFeatures: Feature[] = [
  {
    feature_id: 1,
    room_features: "Ocean View",
    feature_desc: "Balcony facing the ocean side",
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
  {
    feature_id: 2,
    room_features: "King Bed",
    feature_desc: "Super king size orthopedic bed",
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
  {
    feature_id: 3,
    room_features: "Jacuzzi",
    feature_desc: "In-room whirlpool bath tub",
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
];

export default function FeaturesPage() {
  const { user } = useUser();
  const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";

  const [features, setFeatures] = useState<Feature[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFeatures = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("feature").select("*").order("feature_id");
      if (!error && data) {
        setFeatures(data);
      }
    } catch {
      // Keep initial client mock data state
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const handleOpenAdd = () => {
    setSelectedFeature(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Feature) => {
    setSelectedFeature(item);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (item: Feature) => {
    setSelectedFeature(item);
    setIsDeleteOpen(true);
  };

  const handleSubmitModal = async (values: { room_features: string; feature_desc?: string | null }) => {
    setIsLoading(true);
    const now = new Date().toISOString();
    const trimmedTitle = values.room_features.trim();

    // Duplicate check
    const isDuplicate = features.some(
      (f) =>
        (!selectedFeature || f.feature_id !== selectedFeature.feature_id) &&
        f.room_features?.trim().toLowerCase() === trimmedTitle.toLowerCase()
    );

    if (isDuplicate) {
      setIsLoading(false);
      return {
        success: false,
        error: `A feature named "${trimmedTitle}" already exists in the catalog.`,
      };
    }

    if (selectedFeature) {
      // Update
      try {
        let { error } = await supabase
          .from("feature")
          .update({
            room_features: trimmedTitle,
            feature_desc: values.feature_desc?.trim() || null,
            updated_by_: currentUserEmail,
            date_updated: now,
          })
          .eq("feature_id", selectedFeature.feature_id);

        if (error && (error.message?.includes("updated_by_") || error.message?.includes("schema cache"))) {
          const retry = await supabase
            .from("feature")
            .update({
              room_features: trimmedTitle,
              feature_desc: values.feature_desc?.trim() || null,
            })
            .eq("feature_id", selectedFeature.feature_id);
          error = retry.error;
        }

        if (error) {
          setIsLoading(false);
          return { success: false, error: error.message || "Failed to update feature." };
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || "Failed to update feature." };
      }
    } else {
      // Create
      try {
        let { error } = await supabase.from("feature").insert([
          {
            room_features: trimmedTitle,
            feature_desc: values.feature_desc?.trim() || null,
            created_by: currentUserEmail,
            date_created: now,
          },
        ]);

        if (error && (error.message?.includes("created_by") || error.message?.includes("schema cache"))) {
          const retry = await supabase.from("feature").insert([
            {
              room_features: trimmedTitle,
              feature_desc: values.feature_desc?.trim() || null,
            },
          ]);
          error = retry.error;
        }

        if (error) {
          setIsLoading(false);
          if (error.code === "23505") {
            return { success: false, error: `A feature named "${trimmedTitle}" already exists in the database.` };
          }
          return { success: false, error: error.message || "Failed to create feature." };
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || "Failed to create feature." };
      }
    }

    await fetchFeatures();
    setIsLoading(false);
    return { success: true };
  };

  const handleConfirmDelete = async () => {
    if (!selectedFeature) return;
    setIsLoading(true);

    try {
      await supabase
        .from("feature")
        .delete()
        .eq("feature_id", selectedFeature.feature_id);
    } catch (err) {
      console.error("Delete feature error:", err);
    }

    await fetchFeatures();
    setIsLoading(false);
    setIsDeleteOpen(false);
  };

  const columns: Column<Feature>[] = [
    { header: "ID", accessorKey: "feature_id", className: "w-16 text-center" },
    {
      header: "Feature Title",
      cell: (row) => (
        <span className="font-semibold text-navy-900">{row.room_features}</span>
      ),
    },
    {
      header: "Description",
      cell: (row) => <span>{row.feature_desc || "No description specified"}</span>,
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
            title="Edit Feature"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleOpenDelete(row)}
            className="h-8 w-8 text-red-600 hover:bg-red-50"
            title="Delete Feature"
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
        title="Features Catalog"
        description="Manage amenities, attributes, and special room features."
        columns={columns}
        data={features}
        searchKey="room_features"
        searchPlaceholder="Filter features..."
        onAddNew={handleOpenAdd}
        addNewLabel="Add Feature"
        extraAction={
          <Button asChild variant="outline" className="gap-2">
            <Link href="/admin/room-features">
              <Layers className="h-4 w-4 text-navy-600" />
              Assign to Rooms
            </Link>
          </Button>
        }
      />

      <FeatureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitModal}
        initialData={selectedFeature}
        isLoading={isLoading}
      />

      <DeleteDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Feature"
        description={`Are you sure you want to delete feature "${selectedFeature?.room_features}"? This action cannot be undone.`}
        isLoading={isLoading}
      />
    </div>
  );
}
