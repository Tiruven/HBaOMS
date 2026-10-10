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
import { RoomType } from "@/lib/types";
import { AuditFieldsView } from "@/components/shared/AuditFields";
import { Loader2, AlertCircle } from "lucide-react";

const roomTypeSchema = z.object({
  type: z.string().trim().min(1, "Room type is required").max(100, "Max 100 characters"),
  price: z.coerce.number().positive("Price must be greater than 0"),
  size: z.coerce.number().positive("Size must be greater than 0"),
});

type RoomTypeFormValues = z.infer<typeof roomTypeSchema>;

interface RoomTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: RoomTypeFormValues) => Promise<{ success: boolean; error?: string } | void>;
  initialData?: RoomType | null;
  isLoading?: boolean;
}

export const RoomTypeModal: React.FC<RoomTypeModalProps> = ({
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
  } = useForm<RoomTypeFormValues>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: {
      type: "",
      price: 100,
      size: 30,
    },
  });

  useEffect(() => {
    setSubmitError(null);
    if (initialData) {
      reset({
        type: initialData.type,
        price: initialData.price,
        size: initialData.size,
      });
    } else {
      reset({
        type: "",
        price: 100,
        size: 30,
      });
    }
  }, [initialData, reset, isOpen]);

  const handleFormSubmit = async (data: RoomTypeFormValues) => {
    setSubmitError(null);
    try {
      const result = await onSubmit(data);
      if (result && !result.success) {
        setSubmitError(result.error || "Failed to save room type.");
        return;
      }
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to save room type.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Room Type" : "Add New Room Type"}
          </DialogTitle>
        </DialogHeader>

        {submitError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-semibold">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="type">Room Type Title *</Label>
            <Input
              id="type"
              placeholder="e.g. Deluxe Suite"
              {...register("type")}
            />
            {errors.type && (
              <p className="text-xs text-red-600 font-medium">{errors.type.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price per Night ($) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="150.00"
                {...register("price")}
              />
              {errors.price && (
                <p className="text-xs text-red-600 font-medium">{errors.price.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">Room Size (m²) *</Label>
              <Input
                id="size"
                type="number"
                step="0.1"
                placeholder="35.0"
                {...register("size")}
              />
              {errors.size && (
                <p className="text-xs text-red-600 font-medium">{errors.size.message}</p>
              )}
            </div>
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
              {initialData ? "Update Room Type" : "Save Room Type"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
