"use client";

import React from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { Bell, Shield } from "lucide-react";
import { Breadcrumbs } from "@/components/admin/Breadcrumbs";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export const Header: React.FC = () => {
  const { user } = useUser();

  useEffect(() => {
    const syncUserToSupabase = async () => {
      if (!user) return;
      const email = user.primaryEmailAddress?.emailAddress;
      if (!email) return;

      try {
        // Check if staff member already exists
        const { data, error } = await supabase
          .from("staff")
          .select("staff_id")
          .eq("email", email)
          .maybeSingle();

        if (error) {
          console.error("Supabase connection / sync check error:", error);
          return;
        }

        if (!data) {
          // Sync Clerk user to staff table
          const fname = user.firstName || "New";
          const lname = user.lastName || "Staff";
          
          await supabase.from("staff").insert({
            staff_fname: fname.slice(0, 20),
            staff_lname: lname.slice(0, 20),
            role: "Admin",
            email: email,
            password_hash: "$2b$10$clerkauthenticatedusersyncplaceholder",
            contact_info: "N/A",
            is_active: "Y",
            created_by: "Clerk Sync"
          });
        }
      } catch (err) {
        console.error("Clerk-Supabase sync failed:", err);
      }
    };

    syncUserToSupabase();
  }, [user]);

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
      <div className="flex items-center space-x-4">
        <Breadcrumbs />
      </div>

      <div className="flex items-center space-x-5">
        {/* Quick System Badge */}
        <div className="hidden sm:flex items-center space-x-2 bg-navy-50 text-navy-900 px-3 py-1.5 rounded-full border border-navy-100 text-xs font-semibold">
          <Shield className="h-3.5 w-3.5 text-gold-500" />
          <span>Admin Access Verified</span>
        </div>

        {/* Notifications Icon (Decorative) */}
        <button
          type="button"
          className="relative p-2 text-slate-500 hover:text-navy-900 rounded-full hover:bg-slate-100 transition-colors"
          title="System Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-gold-500 ring-2 ring-white" />
        </button>

        {/* User Info & Clerk UserButton with Sign Out */}
        <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-bold text-navy-900">
              {user?.fullName || user?.primaryEmailAddress?.emailAddress || "Administrator"}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              {user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com"}
            </span>
          </div>

          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{
              elements: {
                avatarBox: "h-9 w-9 ring-2 ring-gold-500/50 hover:ring-gold-500 transition-all",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
};
