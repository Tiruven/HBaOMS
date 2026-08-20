"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { StaffModal } from "@/components/modals/StaffModal";
import { Staff, StaffRole } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Power, UserCheck, UserX } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";

const initialStaff: Staff[] = [
  {
    staff_id: 1,
    staff_fname: "Sarah",
    staff_lname: "Jenkins",
    role: "Admin",
    email: "admin@hbaoms.com",
    contact_info: "+15550192834",
    is_active: "Y",
    created_by: "system",
    date_created: new Date().toISOString(),
    updated_by_: "system",
    date_updated: new Date().toISOString(),
  },
  {
    staff_id: 2,
    staff_fname: "Michael",
    staff_lname: "Chang",
    role: "Receptnst",
    email: "m.chang@hbaoms.com",
    contact_info: "+15550192835",
    is_active: "Y",
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
  {
    staff_id: 3,
    staff_fname: "Elena",
    staff_lname: "Rostova",
    role: "Housekpr",
    email: "e.rostova@hbaoms.com",
    contact_info: "+15550192836",
    is_active: "N",
    created_by: "admin@hbaoms.com",
    date_created: new Date().toISOString(),
    updated_by_: "admin@hbaoms.com",
    date_updated: new Date().toISOString(),
  },
];

export default function StaffPage() {
  const { user } = useUser();
  const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStaff = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("staff").select("*").order("staff_id");
      if (!error && data) {
        setStaffList(data);
      }
    } catch {
      // Keep initial client mock data
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleOpenAdd = () => {
    setSelectedStaff(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Staff) => {
    setSelectedStaff(item);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (item: Staff) => {
    setSelectedStaff(item);
    setIsDeleteOpen(true);
  };

  // Toggle Activation Y <-> N without deleting
  const handleToggleActiveStatus = async (item: Staff) => {
    setIsLoading(true);
    const newStatus = item.is_active === "Y" ? "N" : "Y";
    const now = new Date().toISOString();

    try {
      await supabase
        .from("staff")
        .update({
          is_active: newStatus,
          updated_by_: currentUserEmail,
          date_updated: now,
        })
        .eq("staff_id", item.staff_id);
    } catch (err) {
      console.error("Toggle active status error:", err);
    }

    await fetchStaff();
    setIsLoading(false);
  };

  const handleSubmitModal = async (values: {
    staff_fname: string;
    staff_lname: string;
    role: StaffRole;
    email: string;
    contact_info: string;
    is_active: "Y" | "N";
  }) => {
    setIsLoading(true);
    const now = new Date().toISOString();

    if (selectedStaff) {
      // Update
      try {
        await supabase
          .from("staff")
          .update({
            staff_fname: values.staff_fname,
            staff_lname: values.staff_lname,
            role: values.role,
            email: values.email,
            contact_info: values.contact_info,
            is_active: values.is_active,
            updated_by_: currentUserEmail,
            date_updated: now,
          })
          .eq("staff_id", selectedStaff.staff_id);
      } catch (err) {
        console.error("Update staff error:", err);
      }
    } else {
      // Create
      try {
        await supabase.from("staff").insert([
          {
            staff_fname: values.staff_fname,
            staff_lname: values.staff_lname,
            role: values.role,
            email: values.email,
            password_hash: "$2b$10$defaultsecurehashfornewstaff",
            contact_info: values.contact_info,
            is_active: values.is_active,
            created_by: currentUserEmail,
            date_created: now,
          },
        ]);
      } catch (err) {
        console.error("Insert staff error:", err);
      }
    }

    await fetchStaff();
    setIsLoading(false);
    setIsModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!selectedStaff) return;
    setIsLoading(true);

    try {
      await supabase.from("staff").delete().eq("staff_id", selectedStaff.staff_id);
    } catch (err) {
      console.error("Delete staff error:", err);
    }

    await fetchStaff();
    setIsLoading(false);
    setIsDeleteOpen(false);
  };

  const columns: Column<Staff>[] = [
    { header: "ID", accessorKey: "staff_id", className: "w-16 text-center" },
    {
      header: "Staff Name",
      cell: (row) => (
        <span className="font-semibold text-navy-900">
          {row.staff_fname} {row.staff_lname}
        </span>
      ),
    },
    {
      header: "Role",
      cell: (row) => (
        <Badge variant="gold" className="uppercase text-[10px] font-bold">
          {row.role}
        </Badge>
      ),
    },
    { header: "Email Address", accessorKey: "email" },
    { header: "Contact Phone", accessorKey: "contact_info" },
    {
      header: "Status",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Badge
            variant={row.is_active === "Y" ? "success" : "destructive"}
            className="uppercase tracking-wider font-bold"
          >
            {row.is_active === "Y" ? "Active" : "Inactive"}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleToggleActiveStatus(row)}
            className="h-7 px-2 text-[11px] gap-1 hover:bg-slate-100"
            title={`Click to ${row.is_active === "Y" ? "deactivate" : "activate"}`}
          >
            {row.is_active === "Y" ? (
              <>
                <UserX className="h-3 w-3 text-red-600" /> Deactivate
              </>
            ) : (
              <>
                <UserCheck className="h-3 w-3 text-emerald-600" /> Activate
              </>
            )}
          </Button>
        </div>
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
            title="Edit Staff Member"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => handleOpenDelete(row)}
            className="h-8 w-8 text-red-600 hover:bg-red-50"
            title="Delete Staff Account"
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
        title="Staff Directory & Human Resources"
        description="Manage hotel staff accounts, designated roles, contact info, and account activation toggles."
        columns={columns}
        data={staffList}
        searchKey="email"
        searchPlaceholder="Filter staff by email or name..."
        onAddNew={handleOpenAdd}
        addNewLabel="Add Staff Member"
      />

      <StaffModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitModal}
        initialData={selectedStaff}
        isLoading={isLoading}
      />

      <DeleteDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Staff Account"
        description={`Are you sure you want to permanently delete staff member "${selectedStaff?.staff_fname} ${selectedStaff?.staff_lname}" (${selectedStaff?.email})?`}
        isLoading={isLoading}
      />
    </div>
  );
}
