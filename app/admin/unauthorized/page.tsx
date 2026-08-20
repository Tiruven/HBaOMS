// app/admin/unauthorized/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, LayoutDashboard } from "lucide-react";
import { useStaffRole } from "@/lib/roleContext";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  const { role } = useStaffRole();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="p-4 rounded-full bg-red-100 text-red-600 mb-4 animate-bounce">
        <ShieldAlert className="h-12 w-12" />
      </div>
      <h1 className="text-3xl font-bold text-navy-900 mb-2">Access Restricted</h1>
      <p className="text-slate-600 max-w-md mb-4">
        You do not have permission to view this panel or perform operations on this page.
      </p>
      
      <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 mb-6">
        <span className="text-xs text-slate-500 uppercase tracking-wider block">Your Current Role</span>
        <span className="text-sm font-bold text-navy-900">{role || "Staff"}</span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="gold" className="gap-2">
          <Link href="/admin/dashboard">
            <LayoutDashboard className="h-4 w-4" /> Return to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
