// app/admin/layout.tsx
"use client";

import React from "react";
import { Sidebar } from "@/components/admin/Sidebar";
import { Header } from "@/components/admin/Header";
import { StaffRoleProvider, useStaffRole } from "@/lib/roleContext";
import { usePathname, useRouter } from "next/navigation";

function AdminContentGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { canAccess, isLoadingRole } = useStaffRole();

  React.useEffect(() => {
    if (!isLoadingRole && pathname !== "/admin/unauthorized") {
      if (!canAccess(pathname)) {
        router.replace("/admin/unauthorized");
      }
    }
  }, [pathname, isLoadingRole, canAccess, router]);

  if (isLoadingRole) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StaffRoleProvider>
      <div className="flex min-h-screen bg-background text-slate-900 font-sans antialiased">
        {/* Collapsible Left Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col overflow-x-hidden">
          <Header />
          <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
            <AdminContentGuard>{children}</AdminContentGuard>
          </main>
        </div>
      </div>
    </StaffRoleProvider>
  );
}
