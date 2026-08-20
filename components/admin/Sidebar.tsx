"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Hotel,
  BedDouble,
  Sparkles,
  ConciergeBell,
  Compass,
  Users,
  CalendarCheck,
  UserCheck,
  Wrench,
  DollarSign,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface NavGroup {
  group: string;
  items: {
    title: string;
    href: string;
    icon: React.ElementType;
    isPlaceholder?: boolean;
  }[];
}

const navGroups: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    group: "Rooms & Properties",
    items: [
      { title: "Room Types", href: "/admin/room-types", icon: Hotel },
      { title: "Rooms", href: "/admin/rooms", icon: BedDouble },
      { title: "Features", href: "/admin/features", icon: Sparkles },
    ],
  },
  {
    group: "Services & Tours",
    items: [
      { title: "Services", href: "/admin/services", icon: ConciergeBell },
      { title: "Tours", href: "/admin/tours", icon: Compass },
    ],
  },
  {
    group: "Human Resources",
    items: [{ title: "Staff Directory", href: "/admin/staff", icon: Users }],
  },

];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex flex-col bg-navy-900 text-white transition-all duration-300 min-h-screen border-r border-navy-800 shadow-xl",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-navy-800 bg-navy-900/90">
        {!collapsed && (
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-gold-500 text-navy-900 font-bold">
              <Hotel className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-base text-white tracking-wide leading-none">
                HBaOMS
              </h1>
              <span className="text-[10px] text-gold-300 font-medium tracking-wider uppercase">
                Hotel Admin Panel
              </span>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="mx-auto p-2 rounded-lg bg-gold-500 text-navy-900">
            <Hotel className="h-5 w-5" />
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center p-1.5 rounded-md hover:bg-navy-800 text-slate-300 hover:text-white transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-gold-500" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-gold-500" />
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            {!collapsed && (
              <h3 className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {group.group}
              </h3>
            )}

            {group.items.map((item, itemIdx) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={itemIdx}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative",
                    isActive
                      ? "bg-gold-500 text-navy-900 font-bold shadow-md"
                      : "text-slate-300 hover:bg-navy-800 hover:text-white"
                  )}
                  title={collapsed ? item.title : undefined}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-colors",
                      isActive ? "text-navy-900" : "text-gold-500 group-hover:text-gold-300"
                    )}
                  />
                  {!collapsed && (
                    <span className="flex-1 truncate">{item.title}</span>
                  )}
                  {!collapsed && item.isPlaceholder && (
                    <span className="text-[10px] bg-navy-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                      Soon
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer Role Badge */}
      <div className="p-3 border-t border-navy-800 bg-navy-800/40">
        {!collapsed ? (
          <div className="flex items-center space-x-2 text-xs text-slate-300 px-2 py-1 bg-navy-900/80 rounded border border-navy-700">
            <ShieldCheck className="h-4 w-4 text-gold-500" />
            <span className="truncate">Role: <strong className="text-gold-300 font-medium">Administrator</strong></span>
          </div>
        ) : (
          <div className="flex justify-center" title="Administrator Role Verified">
            <ShieldCheck className="h-5 w-5 text-gold-500" />
          </div>
        )}
      </div>
    </aside>
  );
};
