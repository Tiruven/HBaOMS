"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const labelMap: Record<string, string> = {
  admin: "Admin",
  dashboard: "Dashboard",
  "room-types": "Room Types",
  features: "Room Features",
  rooms: "Rooms",
  services: "Services",
  tours: "Tours",
  staff: "Staff Directory",
  bookings: "Bookings",
  customers: "Customers",
  maintenance: "Maintenance",
  pricing: "Pricing Rules",
  reports: "Reports",
};

export const Breadcrumbs: React.FC = () => {
  const pathname = usePathname();
  const pathSegments = pathname.split("/").filter(Boolean);

  return (
    <nav className="flex items-center space-x-2 text-xs font-medium text-slate-500">
      <Link
        href="/admin/dashboard"
        className="flex items-center gap-1 hover:text-navy-900 transition-colors"
      >
        <Home className="h-3.5 w-3.5 text-gold-500" />
        <span>System Admin</span>
      </Link>

      {pathSegments.map((segment, idx) => {
        const isLast = idx === pathSegments.length - 1;
        const href = "/" + pathSegments.slice(0, idx + 1).join("/");
        const label = labelMap[segment] || segment.replace(/-/g, " ");

        if (segment === "admin" && idx === 0) return null;

        return (
          <React.Fragment key={href}>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            {isLast ? (
              <span className="font-semibold text-navy-900 capitalize">
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="hover:text-navy-900 transition-colors capitalize"
              >
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
