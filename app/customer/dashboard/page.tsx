// app/customer/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Booking, CheckInOut } from "@/lib/types";
import { BookingCard } from "@/components/customer/BookingCard";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { Button } from "@/components/ui/button";
import { BedDouble, Calendar, Sparkles, ConciergeBell, Compass, ChevronRight } from "lucide-react";

export default function CustomerDashboardPage() {
  const { user } = useUser();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staysMap, setStaysMap] = useState<Record<number, CheckInOut>>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchGuestBookings() {
      if (!user) return;
      const email = user.primaryEmailAddress?.emailAddress;
      if (!email) return;

      try {
        // Find customer row
        const { data: cust } = await supabase.from("customer").select("cust_id").eq("email", email).single();

        if (cust) {
          const { data: bData } = await supabase
            .from("booking")
            .select("*, customer(*)")
            .eq("customer_cust_id", cust.cust_id)
            .order("booking_id", { ascending: false });

          if (bData) {
            setBookings(bData);

            // Fetch check_in_out for these bookings
            const bIds = bData.map((b) => b.booking_id);
            if (bIds.length > 0) {
              const { data: cioData } = await supabase
                .from("check_in_out")
                .select("*, room(*, room_type(*))")
                .in("booking_booking_id", bIds);

              if (cioData) {
                const map: Record<number, CheckInOut> = {};
                cioData.forEach((s) => {
                  map[s.booking_booking_id] = s;
                });
                setStaysMap(map);
              }
            }
          }
        }
      } catch (err) {
        console.error("Fetch guest bookings error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchGuestBookings();
  }, [user]);

  const firstName = user?.firstName || "Valued Guest";

  return (
    <div className="space-y-8 pb-12">
      {/* Guest Welcome Banner */}
      <div className="bg-[#1A202C] text-white p-8 rounded-3xl shadow-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 text-[#A37836]">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Le Paradis Royal Resort</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Welcome Back, {firstName}!
          </h1>
          <p className="text-slate-300 text-sm max-w-xl">
            We are delighted to host your tropical stay in Mauritius. Manage your active reservations or discover resort amenities.
          </p>
        </div>

        <div className="relative z-10">
          <Button asChild size="lg" className="bg-[#A37836] hover:bg-[#8B6327] text-white rounded-2xl shadow-xl font-bold gap-2">
            <Link href="/customer/booking/new">
              <BedDouble className="h-5 w-5" /> Book New Stay
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Action Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Link href="/customer/rooms" className="bg-white p-6 rounded-2xl border border-[#E5E2DC] shadow-sm hover:shadow-md transition-all hover:border-[#A37836] group">
          <div className="p-3 w-12 h-12 rounded-xl bg-[#F4EFE6] text-[#A37836] mb-4 group-hover:scale-110 transition-transform">
            <BedDouble className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-lg text-[#1A202C]">Luxury Accommodations</h3>
          <p className="text-xs text-slate-500 mt-1">Explore beach villas, deluxe ocean suites, and private terraces.</p>
        </Link>

        <div className="bg-white p-6 rounded-2xl border border-[#E5E2DC] shadow-sm hover:shadow-md transition-all border-[#E5E2DC]">
          <div className="p-3 w-12 h-12 rounded-xl bg-[#F4EFE6] text-[#A37836] mb-4">
            <ConciergeBell className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-lg text-[#1A202C]">Resort & Spa Dining</h3>
          <p className="text-xs text-slate-500 mt-1">Signature dining, private beach cabana setups, and holistic massages.</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#E5E2DC] shadow-sm hover:shadow-md transition-all border-[#E5E2DC]">
          <div className="p-3 w-12 h-12 rounded-xl bg-[#F4EFE6] text-[#A37836] mb-4">
            <Compass className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-lg text-[#1A202C]">Island Excursions</h3>
          <p className="text-xs text-slate-500 mt-1">Catamaran lagoon tours, dolphin swimming, and botanical gardens.</p>
        </div>
      </div>

      {/* Guest Stays & Reservations List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-[#1A202C]">Your Reservations</h2>
          <Button asChild variant="ghost" size="sm" className="text-[#A37836] hover:bg-[#F4EFE6]">
            <Link href="/customer/bookings">View All Bookings <ChevronRight className="h-4 w-4" /></Link>
          </Button>
        </div>

        {loading ? (
          <SkeletonCard count={2} />
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E2DC] p-12 text-center space-y-4">
            <div className="p-4 rounded-full bg-[#F4EFE6] text-[#A37836] w-16 h-16 mx-auto flex items-center justify-center">
              <Calendar className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-[#1A202C]">No Active Reservations</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              You haven't booked any resort stays yet. Explore our luxury ocean rooms and plan your Mauritius getaway today.
            </p>
            <Button asChild className="bg-[#A37836] hover:bg-[#8B6327] text-white rounded-xl">
              <Link href="/customer/booking/new">Start Reservation Wizard</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bookings.map((b) => (
              <BookingCard key={b.booking_id} booking={b} stay={staysMap[b.booking_id]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
