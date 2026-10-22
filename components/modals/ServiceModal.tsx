"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Service } from "@/lib/types";
import { AuditFieldsView } from "@/components/shared/AuditFields";
import { Loader2, AlertCircle } from "lucide-react";

const serviceSchema = z.object({
  service_name: z.string().trim().min(1, "Service name is required").max(100, "Max 100 characters"),
  service_desc: z.string().max(500, "Max 500 characters").optional().nullable(),
  price: z.coerce.number().positive("Price must be greater than 0"),
  service_type: z.enum(["scheduled", "on_demand"]),
  duration_min: z.coerce.number().int().min(15, "Minimum duration is 15 minutes"),
  daily_open_time: z.string().min(1, "Opening time required"),
  daily_close_time: z.string().min(1, "Closing time required"),
  capacity: z.coerce.number().int().min(1, "Minimum capacity is 1"),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ServiceFormValues) => Promise<{ success: boolean; error?: string } | void>;
  initialData?: Service | null;
  isLoading?: boolean;
}

export const ServiceModal: React.FC<ServiceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}) => {
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      service_name: "",
      service_desc: "",
      price: 50,
      service_type: "scheduled",
      duration_min: 60,
      daily_open_time: "09:00",
      daily_close_time: "18:00",
      capacity: 5,
    },
  });

  const currentServiceType = watch("service_type");

  useEffect(() => {
    setSubmitError(null);
    if (initialData) {
      reset({
        service_name: initialData.service_name,
        service_desc: initialData.service_desc || "",
        price: initialData.price,
        service_type: (initialData.service_type as "scheduled" | "on_demand") || "scheduled",
        duration_min: initialData.duration_min || 60,
        daily_open_time: initialData.daily_open_time ? initialData.daily_open_time.substring(0, 5) : "09:00",
        daily_close_time: initialData.daily_close_time ? initialData.daily_close_time.substring(0, 5) : "18:00",
        capacity: initialData.capacity || 5,
      });
    } else {
      reset({
        service_name: "",
        service_desc: "",
        price: 50,
        service_type: "scheduled",
        duration_min: 60,
        daily_open_time: "09:00",
        daily_close_time: "18:00",
        capacity: 5,
      });
    }
  }, [initialData, reset, isOpen]);

  const handleFormSubmit = async (data: ServiceFormValues) => {
    setSubmitError(null);
    try {
      const result = await onSubmit(data);
      if (result && !result.success) {
        setSubmitError(result.error || "Failed to save service.");
        return;
      }
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to save service.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Hotel Service" : "Add New Hotel Service"}
          </DialogTitle>
        </DialogHeader>

        {submitError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-semibold">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service_name">Service Name *</Label>
              <Input
                id="service_name"
                placeholder="e.g. Spa & Wellness"
                {...register("service_name")}
              />
              {errors.service_name && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.service_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Service Rate (MUR) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="85.00"
                {...register("price")}
              />
              {errors.price && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.price.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service_desc">Service Description (Optional)</Label>
            <Input
              id="service_desc"
              placeholder="e.g. Full body aromatherapy session"
              {...register("service_desc")}
            />
            {errors.service_desc && (
              <p className="text-xs text-red-600 font-medium">
                {errors.service_desc.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service_type">Service Type *</Label>
              <select
                id="service_type"
                {...register("service_type")}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="scheduled">Scheduled (Timed Slot)</option>
                <option value="on_demand">On-Demand (Flexible)</option>
              </select>
              {errors.service_type && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.service_type.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity">Concurrent Slot Capacity *</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                placeholder="5"
                {...register("capacity")}
              />
              {errors.capacity && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.capacity.message}
                </p>
              )}
            </div>
          </div>

          {currentServiceType === "scheduled" && (
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <Label htmlFor="duration_min" className="text-xs">Duration (mins)</Label>
                <Input
                  id="duration_min"
                  type="number"
                  step="15"
                  min="15"
                  {...register("duration_min")}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="daily_open_time" className="text-xs">Daily Opens</Label>
                <Input
                  id="daily_open_time"
                  type="time"
                  {...register("daily_open_time")}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="daily_close_time" className="text-xs">Daily Closes</Label>
                <Input
                  id="daily_close_time"
                  type="time"
                  {...register("daily_close_time")}
                />
              </div>
            </div>
          )}

          {initialData && <AuditFieldsView data={initialData} />}

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={isLoading} className="gap-2">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {initialData ? "Update Service" : "Save Service"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
