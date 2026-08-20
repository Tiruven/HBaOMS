// lib/roleContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { StaffRole, Staff } from "@/lib/types";

export type AdminModulePath =
  | "/admin/dashboard"
  | "/admin/room-types"
  | "/admin/rooms"
  | "/admin/features"
  | "/admin/services"
  | "/admin/tours"
  | "/admin/staff"
  | "/admin/bookings"
  | "/admin/check-in-out"
  | "/admin/customers"
  | "/admin/payments"
  | "/admin/notifications"
  | "/admin/maintenance"
  | "/admin/pricing-rules"
  | "/admin/room-features"
  | "/admin/service-bookings"
  | "/admin/trips"
  | "/admin/trip-bookings";

export const ROLE_PERMISSIONS: Record<StaffRole, AdminModulePath[]> = {
  Admin: [
    "/admin/dashboard",
    "/admin/room-types",
    "/admin/rooms",
    "/admin/features",
    "/admin/services",
    "/admin/tours",
    "/admin/staff",
    "/admin/bookings",
    "/admin/check-in-out",
    "/admin/customers",
    "/admin/payments",
    "/admin/notifications",
    "/admin/maintenance",
    "/admin/pricing-rules",
    "/admin/room-features",
    "/admin/service-bookings",
    "/admin/trips",
    "/admin/trip-bookings",
  ],
  Receptnst: [
    "/admin/dashboard",
    "/admin/bookings",
    "/admin/customers",
    "/admin/check-in-out",
    "/admin/service-bookings",
    "/admin/trip-bookings",
    "/admin/notifications",
    "/admin/payments",
  ],
  Housekpr: ["/admin/dashboard", "/admin/rooms", "/admin/maintenance"],
  Technician: ["/admin/dashboard", "/admin/maintenance"],
  Plumber: ["/admin/dashboard", "/admin/maintenance"],
  Electric: ["/admin/dashboard", "/admin/maintenance"],
  Chef: ["/admin/dashboard", "/admin/service-bookings"],
};

interface StaffRoleContextType {
  role: StaffRole | null;
  staffData: Staff | null;
  isLoadingRole: boolean;
  canAccess: (path: string) => boolean;
}

const StaffRoleContext = createContext<StaffRoleContextType>({
  role: null,
  staffData: null,
  isLoadingRole: true,
  canAccess: () => false,
});

export const StaffRoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoaded: isUserLoaded } = useUser();
  const [role, setRole] = useState<StaffRole | null>(null);
  const [staffData, setStaffData] = useState<Staff | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState<boolean>(true);

  useEffect(() => {
    async function fetchStaffRole() {
      if (!isUserLoaded) return;
      if (!user) {
        setIsLoadingRole(false);
        return;
      }

      const email = user.primaryEmailAddress?.emailAddress;
      if (!email) {
        setIsLoadingRole(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("staff")
          .select("*")
          .ilike("email", email.trim())
          .single();

        if (!error && data) {
          setRole(data.role as StaffRole);
          setStaffData(data);
        } else {
          setRole(null);
        }
      } catch (err) {
        console.error("Error fetching staff role:", err);
        setRole(null);
      } finally {
        setIsLoadingRole(false);
      }
    }

    fetchStaffRole();
  }, [user, isUserLoaded]);

  const canAccess = (path: string): boolean => {
    if (!role) return false;
    const allowed = ROLE_PERMISSIONS[role] || [];
    return allowed.some((allowedPath) => path.startsWith(allowedPath));
  };

  return (
    <StaffRoleContext.Provider value={{ role, staffData, isLoadingRole, canAccess }}>
      {children}
    </StaffRoleContext.Provider>
  );
};

export const useStaffRole = () => useContext(StaffRoleContext);
