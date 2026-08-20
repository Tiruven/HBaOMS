// app/customer/layout.tsx
"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Hotel, BedDouble, Calendar, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    async function syncCustomerAndRedirectStaff() {
      if (!isLoaded || !user || !user.primaryEmailAddress?.emailAddress) return;
      const email = user.primaryEmailAddress.emailAddress;

      try {
        // 1. Check if user is staff -> if so, automatically redirect to admin dashboard
        const { data: staffData } = await supabase
          .from("staff")
          .select("staff_id")
          .ilike("email", email.trim())
          .single();

        if (staffData) {
          window.location.href = "/admin/dashboard";
          return;
        }

        // 2. Ensure customer record exists in Supabase customer table
        const { data: custData } = await supabase
          .from("customer")
          .select("cust_id")
          .ilike("email", email.trim())
          .single();

        if (!custData) {
          const fname = user.firstName || "Guest";
          const lname = user.lastName || "Customer";

          await supabase.from("customer").insert([
            {
              cust_fname: fname.substring(0, 20),
              cust_lname: lname.substring(0, 20),
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
      } catch (err) {
        console.error("Error in customer auto-sync:", err);
      }
    }

    syncCustomerAndRedirectStaff();
  }, [user, isLoaded, router]);

  const navLinks = [
    { label: "Dashboard", href: "/customer/dashboard", icon: Calendar },
    { label: "Rooms", href: "/customer/rooms", icon: BedDouble },
    { label: "My Bookings", href: "/customer/bookings", icon: Sparkles },
    { label: "Profile", href: "/customer/profile", icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1A202C] font-sans antialiased flex flex-col">
      {/* Customer Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#E5E2DC] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between py-3">
          {/* Logo */}
          <Link href="/customer/dashboard" className="flex items-center space-x-3 group">
            <div className="p-2 rounded-xl bg-[#A37836] text-white shadow-md group-hover:scale-105 transition-transform">
              <Hotel className="h-5 w-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-[#1A202C] leading-none block">
                Le Paradis Royal
              </span>
              <span className="text-[10px] text-[#A37836] font-semibold tracking-wider uppercase">
                Customer Portal
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((link, i) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={i}
                  href={link.href}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-[#F4EFE6] text-[#8B6327]"
                      : "text-slate-600 hover:text-[#1A202C] hover:bg-slate-100/60"
                  }`}
                >
                  <Icon className="h-4 w-4 text-[#A37836]" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Button */}
          <div className="flex items-center space-x-3">
            <Button asChild size="sm" className="bg-[#A37836] hover:bg-[#8B6327] text-white rounded-xl gap-1">
              <Link href="/customer/booking/new">
                <BedDouble className="h-4 w-4" /> Book Room
              </Link>
            </Button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>

        {/* Mobile Navigation subheader */}
        <div className="md:hidden flex items-center justify-around border-t border-[#E5E2DC] py-2 bg-white px-2">
          {navLinks.map((link, i) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={i}
                href={link.href}
                className={`flex flex-col items-center text-[10px] font-semibold p-1 ${
                  isActive ? "text-[#A37836]" : "text-slate-500"
                }`}
              >
                <Icon className="h-4 w-4 mb-0.5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Customer Footer */}
      <footer className="bg-white border-t border-[#E5E2DC] py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} Le Paradis Royal Resort & Spa. All rights reserved.</span>
          <span className="text-[#A37836] font-medium">Mauritius Island Sanctuary</span>
        </div>
      </footer>
    </div>
  );
}
