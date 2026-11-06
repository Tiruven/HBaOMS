"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { ServiceModal } from "@/components/modals/ServiceModal";
import { Service } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getImageUrl } from "@/lib/imageUtils";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";

export default function ServicesPage() {
  const { user } = useUser();
  const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";

  const [services, setServices] = useState<Service[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchServices = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("service").select("*").order("service_id");
      if (!error && data) {
        setServices(data);
      }
    } catch (err) {
      console.error("Error loading services:", err);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleOpenAdd = () => {
    setSelectedService(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Service) => {
    setSelectedService(item);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (item: Service) => {
    setSelectedService(item);
    setIsDeleteOpen(true);
  };

  const handleSubmitModal = async (values: {
    service_name: string;
    service_desc?: string | null;
    price: number;
    service_type: "scheduled" | "on_demand";
    duration_min: number;
    daily_open_time: string;
    daily_close_time: string;
    capacity: number;
    image_path?: string | null;
  }) => {
    setIsLoading(true);
    const now = new Date().toISOString();
    const trimmedName = values.service_name.trim();

    // 1. Client-side duplicate check (case-insensitive & trimmed)
    const isDuplicate = services.some((s) => {
      if (selectedService && s.service_id === selectedService.service_id) return false;
      return s.service_name.trim().toLowerCase() === trimmedName.toLowerCase();
    });

    if (isDuplicate) {
      setIsLoading(false);
      return {
        success: false,
        error: `A service with the name "${trimmedName}" already exists. Please choose a unique name.`,
      };
    }

    if (selectedService) {
      // Update
      try {
        let { error } = await supabase
          .from("service")
          .update({
            service_name: trimmedName,
            service_desc: values.service_desc,
            price: values.price,
            service_type: values.service_type,
            duration_min: values.duration_min,
            daily_open_time: values.daily_open_time,
            daily_close_time: values.daily_close_time,
            capacity: values.capacity,
            image_path: values.image_path || null,
            updated_by_: currentUserEmail,
            date_updated: now,
          })
          .eq("service_id", selectedService.service_id);

        if (error && error.message?.includes("image_path")) {
          const retry = await supabase
            .from("service")
            .update({
              service_name: trimmedName,
              service_desc: values.service_desc,
              price: values.price,
              service_type: values.service_type,
              duration_min: values.duration_min,
              daily_open_time: values.daily_open_time,
              daily_close_time: values.daily_close_time,
              capacity: values.capacity,
              updated_by_: currentUserEmail,
              date_updated: now,
            })
            .eq("service_id", selectedService.service_id);
          error = retry.error;
        }

        if (error) {
          setIsLoading(false);
          if (error.code === "23505") {
            return {
              success: false,
              error: `A service with the name "${trimmedName}" already exists in the database.`,
            };
          }
          return { success: false, error: error.message || "Failed to update service." };
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || "Failed to update service." };
      }
    } else {
      // Create
      try {
        let { error } = await supabase.from("service").insert([
          {
            service_name: trimmedName,
            service_desc: values.service_desc,
            price: values.price,
            service_type: values.service_type,
            duration_min: values.duration_min,
            daily_open_time: values.daily_open_time,
            daily_close_time: values.daily_close_time,
            capacity: values.capacity,
            image_path: values.image_path || null,
            created_by: currentUserEmail,
            date_created: now,
          },
        ]);

        if (error && error.message?.includes("image_path")) {
          const retry = await supabase.from("service").insert([
            {
              service_name: trimmedName,
              service_desc: values.service_desc,
              price: values.price,
              service_type: values.service_type,
              duration_min: values.duration_min,
              daily_open_time: values.daily_open_time,
              daily_close_time: values.daily_close_time,
              capacity: values.capacity,
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
              error: `A service with the name "${trimmedName}" already exists in the database.`,
            };
          }
          return { success: false, error: error.message || "Failed to create service." };
        }
      } catch (err: any) {
        setIsLoading(false);
        return { success: false, error: err.message || "Failed to create service." };
      }
    }

    await fetchServices();
    setIsLoading(false);
    setIsModalOpen(false);
    return { success: true };
  };

  const handleConfirmDelete = async () => {
    if (!selectedService) return;
    setIsLoading(true);

    try {
      if (selectedService.image_path && !selectedService.image_path.startsWith("http")) {
        fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_path: selectedService.image_path }),
        }).catch((e) => console.warn("Failed to delete storage image on service delete:", e));
      }

      await supabase.from("service").delete().eq("service_id", selectedService.service_id);
    } catch (err) {
      console.error("Delete service error:", err);
    }

    await fetchServices();
    setIsLoading(false);
    setIsDeleteOpen(false);
  };

  const columns: Column<Service>[] = [
    { header: "ID", accessorKey: "service_id", className: "w-14 text-center" },
    {
      header: "Photo",
      className: "w-20",
      cell: (row) => {
        const previewUrl = getImageUrl(row.image_path, "service");
        return (
          <div className="h-10 w-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
            <img
              src={previewUrl}
              alt={row.service_name}
              className="h-full w-full object-cover"
            />
          </div>
        );
      },
    },
    {
      header: "Service Name",
      cell: (row) => (
        <span className="font-semibold text-navy-900">{row.service_name}</span>
      ),
    },
    {
      header: "Type & Capacity",
      cell: (row) => (
        <span className="text-xs text-slate-600 capitalize">
          {row.service_type || "scheduled"} • Cap: {row.capacity || 5}
          {row.service_type !== "on_demand" && ` • ${row.duration_min || 60}m`}
        </span>
      ),
    },
    {
      header: "Price Rate",
      cell: (row) => (
        <span className="font-bold text-navy-900">{formatCurrency(row.price)}</span>
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
            title="Edit Service"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleOpenDelete(row)}
            className="h-8 w-8 text-red-600 hover:bg-red-50"
            title="Delete Service"
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
        title="Resort Services Catalog"
        description="Administer spa wellness, recreational activities, concierge experiences, and dining amenities."
        data={services}
        columns={columns}
        isLoading={isLoading}
        searchKey="service_name"
        searchPlaceholder="Filter services by name..."
        onAddNew={handleOpenAdd}
        addNewLabel="Add Service"
      />

      <ServiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitModal}
        initialData={selectedService}
        isLoading={isLoading}
      />

      <DeleteDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Resort Service"
        description={`Are you sure you want to delete "${selectedService?.service_name}"? Existing bookings for this service may be affected.`}
        isLoading={isLoading}
      />
    </div>
  );
}
