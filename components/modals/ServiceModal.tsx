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
    formState: { errors },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      service_name: "",
      service_desc: "",
      price: 50,
    },
  });

  useEffect(() => {
    setSubmitError(null);
    if (initialData) {
      reset({
        service_name: initialData.service_name,
        service_desc: initialData.service_desc || "",
        price: initialData.price,
      });
    } else {
      reset({
        service_name: "",
        service_desc: "",
        price: 50,
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
      <DialogContent className="sm:max-w-[500px]">
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
              <Label htmlFor="price">Service Rate ($) *</Label>
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
