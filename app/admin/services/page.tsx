"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { ServiceModal } from "@/components/modals/ServiceModal";
import { Service } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";

const initialServices: Service[] = [
  {
    service_id: 1,
    service_name: "Spa & Wellness",
    service_desc: "Full body aromatherapy massage & sauna access",
    price: 85.0,
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
  {
    service_id: 2,
    service_name: "Airport Shuttle",
    service_desc: "Private luxury SUV airport transfer",
    price: 45.0,
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
  {
    service_id: 3,
    service_name: "Breakfast Buffet",
    service_desc: "International gourmet morning buffet per guest",
    price: 25.0,
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
];

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
    } catch {
      // Keep initial client mock data
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
        const { error } = await supabase
          .from("service")
          .update({
            service_name: trimmedName,
            service_desc: values.service_desc,
            price: values.price,
            updated_by_: currentUserEmail,
            date_updated: now,
          })
          .eq("service_id", selectedService.service_id);

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
        const { error } = await supabase.from("service").insert([
          {
            service_name: trimmedName,
            service_desc: values.service_desc,
            price: values.price,
            created_by: currentUserEmail,
            date_created: now,
          },
        ]);

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
      await supabase.from("service").delete().eq("service_id", selectedService.service_id);
    } catch (err) {
      console.error("Delete service error:", err);
    }

    await fetchServices();
    setIsLoading(false);
    setIsDeleteOpen(false);
  };

  const columns: Column<Service>[] = [
    { header: "ID", accessorKey: "service_id", className: "w-16 text-center" },
    {
      header: "Service Name",
      cell: (row) => (
        <span className="font-semibold text-navy-900">{row.service_name}</span>
      ),
    },
    {
      header: "Description",
      cell: (row) => <span>{row.service_desc || "No description"}</span>,
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
        title="Services Catalog"
        description="Manage additional hotel guest services, wellness offerings, and pricing."
        columns={columns}
        data={services}
        searchKey="service_name"
        searchPlaceholder="Filter services..."
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
        title="Delete Service"
        description={`Are you sure you want to delete service "${selectedService?.service_name}"? This action cannot be undone.`}
        isLoading={isLoading}
      />
    </div>
  );
}
