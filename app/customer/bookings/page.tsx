// app/customer/bookings/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Booking, CheckInOut } from "@/lib/types";
import { BookingCard } from "@/components/customer/BookingCard";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { Button } from "@/components/ui/button";
import { BedDouble, Calendar, CheckCircle, AlertCircle, Loader } from "lucide-react";

export default function CustomerBookingsListPage() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staysMap, setStaysMap] = useState<Record<number, CheckInOut>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [verifyMessage, setVerifyMessage] = useState<string>("");

  const fetchBookings = useCallback(async () => {
    if (!user?.primaryEmailAddress?.emailAddress) return;
    setLoading(true);

    try {
      const email = user.primaryEmailAddress.emailAddress;
      const { data: cust } = await supabase
        .from("customer")
        .select("cust_id")
        .ilike("email", email.trim())
        .single();

      if (cust) {
        const { data: bData } = await supabase
          .from("booking")
          .select("*, customer(*)")
          .eq("customer_cust_id", cust.cust_id)
          .order("booking_id", { ascending: false });

        if (bData) {
          setBookings(bData);
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
      console.error("Fetch bookings error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const executedSessionRef = React.useRef<string | null>(null);

  // On mount: check if redirected from Stripe success
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const success = searchParams.get("success");

    if (sessionId && success === "true") {
      if (executedSessionRef.current === sessionId) return;
      executedSessionRef.current = sessionId;

      router.replace("/customer/bookings", { scroll: false });

      async function verifyAndCreate() {
        setVerifyStatus("verifying");
        setVerifyMessage("Confirming your payment and creating your reservation...");

        try {
          const res = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });

          const data = await res.json();

          if (res.ok && data.success) {
            setVerifyStatus("success");
            setVerifyMessage(
              data.alreadyProcessed
                ? "Your booking was already confirmed!"
                : `Booking #${data.bookingId} confirmed! Your resort stay is reserved.`
            );
            await fetchBookings();
          } else {
            setVerifyStatus("error");
            setVerifyMessage(data.error || "Payment verification failed. Contact support.");
          }
        } catch (err: any) {
          setVerifyStatus("error");
          setVerifyMessage("Network error during verification. Please refresh the page.");
        }
      }

      verifyAndCreate();
    } else {
      fetchBookings();
    }

    // Lightweight Realtime subscription for customer's reservations
    const channel = supabase
      .channel("customer-bookings-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking" },
        () => fetchBookings()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "check_in_out" },
        () => fetchBookings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [searchParams, router, fetchBookings]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-8 rounded-3xl border border-[#E5E2DC] shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold text-[#1A202C]">My Reservations</h1>
          <p className="text-slate-500 text-sm">View stay receipts, room assignments, and booking status.</p>
        </div>
        <Button asChild className="bg-[#A37836] hover:bg-[#8B6327] text-white rounded-xl gap-2">
          <Link href="/customer/booking/new">
            <BedDouble className="h-4 w-4" /> Book Another Stay
          </Link>
        </Button>
      </div>

      {/* Stripe Payment Verification Banner */}
      {verifyStatus === "verifying" && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-5 rounded-2xl flex items-center gap-3 text-sm font-semibold">
          <Loader className="h-5 w-5 text-blue-600 shrink-0 animate-spin" />
          <span>{verifyMessage}</span>
        </div>
      )}
      {verifyStatus === "success" && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-5 rounded-2xl flex items-center gap-3 text-sm font-semibold">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{verifyMessage}</span>
        </div>
      )}
      {verifyStatus === "error" && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-5 rounded-2xl flex items-center gap-3 text-sm font-semibold">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{verifyMessage}</span>
        </div>
      )}

      {/* Bookings Grid */}
      {loading || verifyStatus === "verifying" ? (
        <SkeletonCard count={3} />
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E2DC] p-12 text-center space-y-4">
          <Calendar className="h-10 w-10 text-[#A37836] mx-auto" />
          <h3 className="text-lg font-bold text-[#1A202C]">No Stay Reservations Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You haven't completed any resort stay bookings yet. Start your reservation in a few easy steps.
          </p>
          <Button asChild className="bg-[#A37836] hover:bg-[#8B6327] text-white rounded-xl">
            <Link href="/customer/booking/new">Book Room Now</Link>
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
  );
}
