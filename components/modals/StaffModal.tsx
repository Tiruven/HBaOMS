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
import { Staff, StaffRole } from "@/lib/types";
import { AuditFieldsView } from "@/components/shared/AuditFields";
import { Loader2 } from "lucide-react";

const roles: StaffRole[] = [
  "Admin",
  "Receptnst",
  "Housekpr",
  "Technician",
  "Plumber",
  "Electric",
  "Chef",
];

const staffSchema = z.object({
  staff_fname: z.string().min(1, "First name is required").max(100, "Max 100 characters"),
  staff_lname: z.string().min(1, "Last name is required").max(100, "Max 100 characters"),
  role: z.enum([
    "Admin",
    "Receptnst",
    "Housekpr",
    "Technician",
    "Plumber",
    "Electric",
    "Chef",
  ] as const, {
    required_error: "Please select a staff role",
  }),
  email: z.string().email("Invalid email address").max(254, "Max 254 characters"),
  contact_info: z.string().min(7, "Min 7 characters").max(30, "Max 30 characters"),
  is_active: z.enum(["Y", "N"]),
});

type StaffFormValues = z.infer<typeof staffSchema>;

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: StaffFormValues) => Promise<void>;
  initialData?: Staff | null;
  isLoading?: boolean;
}

export const StaffModal: React.FC<StaffModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}) => {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      staff_fname: "",
      staff_lname: "",
      role: "Receptnst",
      email: "",
      contact_info: "",
      is_active: "Y",
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        staff_fname: initialData.staff_fname,
        staff_lname: initialData.staff_lname,
        role: initialData.role,
        email: initialData.email,
        contact_info: initialData.contact_info,
        is_active: initialData.is_active,
      });
    } else {
      reset({
        staff_fname: "",
        staff_lname: "",
        role: "Receptnst",
        email: "",
        contact_info: "",
        is_active: "Y",
      });
    }
  }, [initialData, reset, isOpen]);

  const handleFormSubmit = async (data: StaffFormValues) => {
    await onSubmit(data);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Staff Account" : "Register New Staff Member"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="staff_fname">First Name *</Label>
              <Input
                id="staff_fname"
                placeholder="e.g. Sarah"
                {...register("staff_fname")}
              />
              {errors.staff_fname && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.staff_fname.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff_lname">Last Name *</Label>
              <Input
                id="staff_lname"
                placeholder="e.g. Jenkins"
                {...register("staff_lname")}
              />
              {errors.staff_lname && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.staff_lname.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="s.jenkins@hotel.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_info">Contact Phone *</Label>
              <Input
                id="contact_info"
                placeholder="+15550192834"
                {...register("contact_info")}
              />
              {errors.contact_info && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.contact_info.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Role Select Dropdown */}
            <div className="space-y-2">
              <Label>Designated Role *</Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.role.message}
                </p>
              )}
            </div>

            {/* Account Activation Dropdown */}
            <div className="space-y-2">
              <Label>Active Status *</Label>
              <Controller
                name="is_active"
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
                      <SelectItem value="Y">Active (Y)</SelectItem>
                      <SelectItem value="N">Inactive (N)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.is_active && (
                <p className="text-xs text-red-600 font-medium">
                  {errors.is_active.message}
                </p>
              )}
            </div>
          </div>

          {/* Password Note */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-500">
            <span className="font-semibold text-navy-900">Security Note:</span> Password hashes are handled securely by backend auth systems and are never stored or exposed through the admin interface.
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
              {initialData ? "Update Staff" : "Save Staff Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
