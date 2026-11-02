"use client";

import React, { useEffect, useState } from "react";
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
import { Feature } from "@/lib/types";
import { AuditFieldsView } from "@/components/shared/AuditFields";
import { Loader2, AlertCircle } from "lucide-react";

const featureSchema = z.object({
  room_features: z.string().min(1, "Feature name is required").max(100, "Max 100 characters"),
  feature_desc: z.string().max(500, "Max 500 characters").optional().nullable(),
});

type FeatureFormValues = z.infer<typeof featureSchema>;

interface FeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: FeatureFormValues) => Promise<{ success: boolean; error?: string } | void>;
  initialData?: Feature | null;
  isLoading?: boolean;
}

export const FeatureModal: React.FC<FeatureModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}) => {
  const [serverError, setServerError] = useState<string>("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeatureFormValues>({
    resolver: zodResolver(featureSchema),
    defaultValues: {
      room_features: "",
      feature_desc: "",
    },
  });

  useEffect(() => {
    setServerError("");
    if (initialData) {
      reset({
        room_features: initialData.room_features,
        feature_desc: initialData.feature_desc || "",
      });
    } else {
      reset({
        room_features: "",
        feature_desc: "",
      });
    }
  }, [initialData, reset, isOpen]);

  const handleFormSubmit = async (data: FeatureFormValues) => {
    setServerError("");
    const result = await onSubmit(data);
    if (result && !result.success) {
      setServerError(result.error || "Failed to save feature.");
      return;
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Room Feature" : "Add New Room Feature"}
          </DialogTitle>
        </DialogHeader>

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-md flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="room_features">Feature Name *</Label>
            <Input
              id="room_features"
              placeholder="e.g. Ocean View"
              {...register("room_features")}
            />
            {errors.room_features && (
              <p className="text-xs text-red-600 font-medium">
                {errors.room_features.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feature_desc">Description (Optional)</Label>
            <Input
              id="feature_desc"
              placeholder="e.g. Balcony facing the sea"
              {...register("feature_desc")}
            />
            {errors.feature_desc && (
              <p className="text-xs text-red-600 font-medium">
                {errors.feature_desc.message}
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
              {initialData ? "Update Feature" : "Save Feature"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
