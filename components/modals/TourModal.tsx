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
import { Tour } from "@/lib/types";
import { AuditFieldsView } from "@/components/shared/AuditFields";
import { Loader2, AlertCircle } from "lucide-react";

const tourSchema = z.object({
  tour_name: z.string().trim().min(1, "Tour name is required").max(100, "Max 100 characters"),
  tour_desc: z.string().max(500, "Max 500 characters").optional().nullable(),
  adult_price: z.coerce.number().positive("Adult price must be greater than 0"),
  child_price: z.coerce.number().positive("Child price must be greater than 0"),
  durations: z.coerce.number().int("Hours must be a whole number").positive("Duration must be at least 1 hour"),
});

type TourFormValues = z.infer<typeof tourSchema>;

interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: TourFormValues) => Promise<{ success: boolean; error?: string } | void>;
  initialData?: Tour | null;
  isLoading?: boolean;
}

export const TourModal: React.FC<TourModalProps> = ({
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
  } = useForm<TourFormValues>({
    resolver: zodResolver(tourSchema),
    defaultValues: {
      tour_name: "",
      tour_desc: "",
      adult_price: 100,
      child_price: 50,
      durations: 4,
    },
  });

  useEffect(() => {
    setSubmitError(null);
    if (initialData) {
      reset({
        tour_name: initialData.tour_name,
        tour_desc: initialData.tour_desc || "",
        adult_price: initialData.adult_price,
        child_price: initialData.child_price,
        durations: initialData.durations,
      });
    } else {
      reset({
        tour_name: "",
        tour_desc: "",
        adult_price: 100,
        child_price: 50,
        durations: 4,
      });
    }
  }, [initialData, reset, isOpen]);

  const handleFormSubmit = async (data: TourFormValues) => {
    setSubmitError(null);
    try {
      const result = await onSubmit(data);
      if (result && !result.success) {
        setSubmitError(result.error || "Failed to save tour.");
        return;
      }
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to save tour.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Excursion Tour" : "Add New Excursion Tour"}
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
              <Label htmlFor="tour_name">Tour Name *</Label>
              <Input
                id="tour_name"
                placeholder="e.g. Island Excursion"
                {...register("tour_name")}
              />
              {errors.tour_name && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.tour_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="durations">Duration (Hours) *</Label>
              <Input
                id="durations"
                type="number"
                placeholder="4"
                {...register("durations")}
              />
              {errors.durations && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.durations.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="adult_price">Adult Rate ($) *</Label>
              <Input
                id="adult_price"
                type="number"
                step="0.01"
                placeholder="120.00"
                {...register("adult_price")}
              />
              {errors.adult_price && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.adult_price.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="child_price">Child Rate ($) *</Label>
              <Input
                id="child_price"
                type="number"
                step="0.01"
                placeholder="60.00"
                {...register("child_price")}
              />
              {errors.child_price && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.child_price.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tour_desc">Tour Description (Optional)</Label>
            <Input
              id="tour_desc"
              placeholder="e.g. Catamaran boat tour with snorkeling and lunch"
              {...register("tour_desc")}
            />
            {errors.tour_desc && (
              <p className="text-xs text-red-600 font-medium">
                {errors.tour_desc.message}
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
              {initialData ? "Update Tour" : "Save Tour"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
