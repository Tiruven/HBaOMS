// lib/roleContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { StaffRole, Staff, normalizeStaffRole } from "@/lib/types";

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
  | "/admin/housekeeping"
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
    "/admin/housekeeping",
    "/admin/pricing-rules",
    "/admin/room-features",
    "/admin/service-bookings",
    "/admin/trips",
    "/admin/trip-bookings",
  ],
  Receptionist: [
    "/admin/dashboard",
    "/admin/bookings",
    "/admin/check-in-out",
    "/admin/customers",
    "/admin/rooms",
  ],
  "Service Supervisor": [
    "/admin/dashboard",
    "/admin/service-bookings",
  ],
  "Activities Supervisor": [
    "/admin/dashboard",
    "/admin/trip-bookings",
    "/admin/trips",
  ],
  "Housekeeping Supervisor": [
    "/admin/dashboard",
    "/admin/housekeeping",
    "/admin/rooms",
  ],
  "Maintenance Supervisor": [
    "/admin/dashboard",
    "/admin/maintenance",
    "/admin/rooms",
  ],
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
        // Read active role directly from DB-backed server route on every load
        const res = await fetch("/api/staff?me=1", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (json?.staff && json.staff.is_active === "Y") {
            setRole(normalizeStaffRole(json.staff.role));
            setStaffData(json.staff);
            return;
          }
        }
        setRole(null);
        setStaffData(null);
      } catch (err) {
        console.error("Error fetching staff role:", err);
        setRole(null);
        setStaffData(null);
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
