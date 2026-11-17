// app/auth-callback/page.tsx
"use client";

import React, { useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { nowInstant } from "@/lib/time";

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
        // 1. Check if user is an active staff member via server endpoint (matches clerk_user_id or email + is_active='Y')
        const staffRes = await fetch("/api/staff?me=1", { cache: "no-store" });
        if (staffRes.ok) {
          const staffJson = await staffRes.json();
          if (staffJson?.staff && staffJson.staff.is_active === "Y") {
            router.replace("/admin/dashboard");
            return;
          }
        }

        // 2. Ensure customer record exists and stores clerk_user_id
        const { data: custData } = await supabase
          .from("customer")
          .select("cust_id, clerk_user_id")
          .ilike("email", email)
          .maybeSingle();

        if (!custData) {
          const fname = user.firstName || "Guest";
          const lname = user.lastName || "Customer";

          const insertPayload: Record<string, any> = {
            cust_fname: fname.substring(0, 100),
            cust_lname: lname.substring(0, 100),
            email: email,
            clerk_user_id: user.id,
            password_hash: "CLERK_AUTH",
            town: "Grand Baie",
            city: "Grand Baie",
            gender: "M",
            contact_info: user.primaryPhoneNumber?.phoneNumber || "N/A",
            nationality: "Mauritian",
            country: "Mauritius",
            created_by: "Clerk AutoSync",
            date_created: nowInstant(),
          };

          const { error: custInsertErr } = await supabase.from("customer").insert([insertPayload]);
          if (custInsertErr && custInsertErr.message?.includes("clerk_user_id")) {
            delete insertPayload.clerk_user_id;
            await supabase.from("customer").insert([insertPayload]);
          }
        } else if (!custData.clerk_user_id) {
          await supabase
            .from("customer")
            .update({ clerk_user_id: user.id })
            .eq("cust_id", custData.cust_id);
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
