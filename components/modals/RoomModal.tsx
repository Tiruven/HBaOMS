"use client";

import React, { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Room, RoomType, Feature } from "@/lib/types";
import { AuditFieldsView } from "@/components/shared/AuditFields";
import { Loader2 } from "lucide-react";

const roomSchema = z.object({
  room_desc: z.string().min(1, "Room description/number is required").max(100, "Max 100 characters"),
  room_status: z.enum(["Available", "Maintenance"], {
    required_error: "Please select a room status",
  }),
  room_type_room_type_id: z.coerce.number().min(1, "Please select a room type"),
  feature_ids: z.array(z.number()).optional(),
});

type RoomFormValues = z.infer<typeof roomSchema>;

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: RoomFormValues) => Promise<void>;
  initialData?: Room | null;
  roomTypes: RoomType[];
  features: Feature[];
  isLoading?: boolean;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  roomTypes,
  features,
  isLoading = false,
}) => {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      room_desc: "",
      room_status: "Available",
      room_type_room_type_id: roomTypes[0]?.room_type_id || 1,
      feature_ids: [],
    },
  });

  useEffect(() => {
    if (initialData) {
      const selectedFids =
        initialData.room_feature
          ?.map((rf) => rf.feature?.feature_id)
          .filter(Boolean) as number[] || [];
      reset({
        room_desc: initialData.room_desc || "",
        room_status: initialData.room_status,
        room_type_room_type_id: initialData.room_type_room_type_id,
        feature_ids: selectedFids,
      });
    } else {
      reset({
        room_desc: "",
        room_status: "Available",
        room_type_room_type_id: roomTypes[0]?.room_type_id || 1,
        feature_ids: [],
      });
    }
  }, [initialData, roomTypes, reset, isOpen]);

  const handleFormSubmit = async (data: RoomFormValues) => {
    await onSubmit(data);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Room Details" : "Add New Guest Room"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="room_desc">Room Title / Description *</Label>
            <Input
              id="room_desc"
              placeholder="e.g. Room 101 - Floor 1 Ocean Side"
              {...register("room_desc")}
            />
            {errors.room_desc && (
              <p className="text-xs text-red-600 font-medium">
                {errors.room_desc.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Room Type Select Dropdown */}
            <div className="space-y-2">
              <Label>Room Type *</Label>
              <Controller
                name="room_type_room_type_id"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(val) => field.onChange(Number(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roomTypes.map((rt) => (
                        <SelectItem key={rt.room_type_id} value={String(rt.room_type_id)}>
                          {rt.type} (${rt.price})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.room_type_room_type_id && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.room_type_room_type_id.message}
                </p>
              )}
            </div>

            {/* Room Status Select Dropdown */}
            <div className="space-y-2">
              <Label>Status *</Label>
              <Controller
                name="room_status"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Available">Available</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.room_status && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.room_status.message}
                </p>
              )}
            </div>
          </div>

          {/* Features Checklist */}
          <div className="space-y-2">
            <Label>Room Features</Label>
            <Controller
              name="feature_ids"
              control={control}
              render={({ field }) => {
                const checkedIds = field.value || [];
                const handleToggle = (fid: number) => {
                  const newChecked = checkedIds.includes(fid)
                    ? checkedIds.filter((id) => id !== fid)
                    : [...checkedIds, fid];
                  field.onChange(newChecked);
                };

                if (features.length === 0) {
                  return (
                    <p className="text-xs text-slate-400 italic">No features available. Add some in features page.</p>
                  );
                }

                return (
                  <div className="grid grid-cols-2 gap-2 border border-slate-200 rounded-md p-3 max-h-[140px] overflow-y-auto bg-slate-50/50">
                    {features.map((f) => {
                      const isChecked = checkedIds.includes(f.feature_id);
                      return (
                        <label
                          key={f.feature_id}
                          className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer select-none hover:text-navy-900 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggle(f.feature_id)}
                            className="rounded border-slate-300 text-gold-500 focus:ring-gold-500 h-4 w-4"
                          />
                          <span className="font-medium">{f.room_features}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              }}
            />
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
              {initialData ? "Update Room" : "Save Room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
