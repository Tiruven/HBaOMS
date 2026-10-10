// app/auth-callback/page.tsx
"use client";

import React, { useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    async function routeUserByRole() {
      if (!isAuthLoaded || !isUserLoaded) return;

      if (!isSignedIn || !user) {
        // Wait a tick before giving up to allow session token to stabilize
        const timer = setTimeout(() => {
          router.replace("/sign-in");
        }, 800);
        return () => clearTimeout(timer);
      }

      const email = user.primaryEmailAddress?.emailAddress?.trim();
      if (!email) return;

      try {
        // 1. Check if user is staff (admin, manager, receptionist)
        const { data: staffData } = await supabase
          .from("staff")
          .select("staff_id, role")
          .ilike("email", email)
          .maybeSingle();

        if (staffData) {
          router.replace("/admin/dashboard");
          return;
        }

        // 2. Ensure customer record exists
        const { data: custData } = await supabase
          .from("customer")
          .select("cust_id")
          .ilike("email", email)
          .maybeSingle();

        if (!custData) {
          const fname = user.firstName || "Guest";
          const lname = user.lastName || "Customer";

          await supabase.from("customer").insert([
            {
              cust_fname: fname.substring(0, 100),
              cust_lname: lname.substring(0, 100),
              email: email,
              password_hash: "CLERK_AUTH",
              town: "Grand Baie",
              city: "Grand Baie",
              gender: "M",
              contact_info: user.primaryPhoneNumber?.phoneNumber || "N/A",
              nationality: "Mauritian",
              country: "Mauritius",
              created_by: "Clerk AutoSync",
              date_created: new Date().toISOString(),
            },
          ]);
        }

        router.replace("/customer/dashboard");
      } catch (err) {
        console.error("Auth callback routing error:", err);
        router.replace("/customer/dashboard");
      }
    }

    routeUserByRole();
  }, [isAuthLoaded, isUserLoaded, isSignedIn, user, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F7F4] text-[#1A202C]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#A37836]" />
        <p className="text-sm font-semibold text-slate-600">Verifying credentials and loading workspace...</p>
      </div>
    </div>
  );
}
