// app/customer/booking/new/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Room, Service, Tour, Customer, PricingRule } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { StepIndicator } from "@/components/customer/StepIndicator";
import { PricingBadge } from "@/components/customer/PricingBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BedDouble,
  Calendar,
  Sparkles,
  ConciergeBell,
  Compass,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";

const WIZARD_STEPS = [
  "Select Room",
  "Dates & Board",
  "Add-ons & Tours",
  "Guest Profile",
  "Review & Pay",
];

function findNextAvailableDates(
  requestedInStr: string,
  durationDays: number,
  stays: { in: string; out: string }[]
) {
  let candidateIn = new Date((requestedInStr || new Date().toISOString().split("T")[0]) + "T00:00:00.000Z");
  let isAvailable = false;
  let loops = 0;

  while (!isAvailable && loops < 100) {
    loops++;
    const candInStr = candidateIn.toISOString().split("T")[0];
    const candOutDate = new Date(candidateIn.getTime() + durationDays * 86400000);
    const candOutStr = candOutDate.toISOString().split("T")[0];

    const overlap = stays.find((s) => candInStr < s.out && candOutStr > s.in);

    if (overlap) {
      candidateIn = new Date(overlap.out + "T00:00:00.000Z");
    } else {
      isAvailable = true;
    }
  }

  const nextInStr = candidateIn.toISOString().split("T")[0];
  const nextOutDate = new Date(candidateIn.getTime() + durationDays * 86400000);
  const nextOutStr = nextOutDate.toISOString().split("T")[0];
  return { checkIn: nextInStr, checkOut: nextOutStr };
}

const RESORT_PACKAGES = [
  {
    id: "honeymoon",
    name: "Honeymoon Escape Package",
    description: "Includes Spa & Wellness session and Island Catamaran Excursion for two at a bundled rate.",
    price: 4500,
    badge: "15% Bundle Savings",
    services: ["Spa & Wellness"],
    tours: ["Island Excursion"]
  },
  {
    id: "family",
    name: "Family Adventure Package",
    description: "Includes Breakfast Buffet for the family and a City Heritage Walk Tour.",
    price: 3500,
    badge: "10% Bundle Savings",
    services: ["Breakfast Buffet"],
    tours: ["City Heritage Walk"]
  }
];

export default function BookingWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRoomId = searchParams.get("roomId");
  const { user } = useUser();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Database Catalog Data
  const [rooms, setRooms] = useState<Room[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);

  // Wizard Selections
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [checkInDate, setCheckInDate] = useState<string>("");
  const [checkOutDate, setCheckOutDate] = useState<string>("");
  const [boardType, setBoardType] = useState<"RO" | "HB" | "FB">("RO");
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [selectedTourIds, setSelectedTourIds] = useState<number[]>([]);

  // Guest Details Form
  const [fname, setFname] = useState<string>("");
  const [lname, setLname] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [contactInfo, setContactInfo] = useState<string>("");
  const [nationality, setNationality] = useState<string>("Mauritian");
  const [passportNumber, setPassportNumber] = useState<string>("");
  const [country, setCountry] = useState<string>("Mauritius");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [suggestedDates, setSuggestedDates] = useState<{ checkIn: string; checkOut: string } | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  // Payment Processing State
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState<boolean>(false);
  const [occupiedStays, setOccupiedStays] = useState<{ in: string; out: string }[]>([]);

  useEffect(() => {
    async function fetchOccupiedStays() {
      if (!selectedRoom) return;
      try {
        const { data } = await supabase
          .from("check_in_out")
          .select("check_in_date, check_out_date, booking!inner(booking_status)")
          .eq("room_room_id", selectedRoom.room_id)
          .eq("booking.booking_status", "Confirmed");

        if (data) {
          setOccupiedStays(
            data.map((d) => ({
              in: d.check_in_date.split("T")[0],
              out: d.check_out_date.split("T")[0],
            }))
          );
        }
      } catch (e) {
        console.error("Error fetching occupied stays:", e);
      }
    }
    fetchOccupiedStays();
  }, [selectedRoom]);

  useEffect(() => {
    async function loadCatalog() {
      setLoadingData(true);
      try {
        const [rRes, sRes, tRes, prRes] = await Promise.all([
          supabase.from("room").select("*, room_type(*), room_feature(feature(*))").eq("room_status", "Available"),
          supabase.from("service").select("*"),
          supabase.from("tour").select("*"),
          supabase.from("pricing_rule").select("*"),
        ]);

        if (rRes.data) {
          setRooms(rRes.data);
          if (preselectedRoomId) {
            const found = rRes.data.find((r) => r.room_id === Number(preselectedRoomId));
            if (found) setSelectedRoom(found);
          } else if (rRes.data.length > 0) {
            setSelectedRoom(rRes.data[0]);
          }
        }
        if (sRes.data) setServices(sRes.data);
        if (tRes.data) setTours(tRes.data);
        if (prRes.data) setPricingRules(prRes.data);

        // Pre-fill dates
        const todayStr = new Date().toISOString().split("T")[0];
        const tomorrowStr = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
        setCheckInDate(todayStr);
        setCheckOutDate(tomorrowStr);

        // Pre-fill user profile
        if (user) {
          setFname(user.firstName || "");
          setLname(user.lastName || "");
          setEmail(user.primaryEmailAddress?.emailAddress || "");
        }
      } catch (err) {
        console.error("Error loading catalog:", err);
      } finally {
        setLoadingData(false);
      }
    }

    loadCatalog();
  }, [user, preselectedRoomId]);

  useEffect(() => {
    if (preselectedRoomId) {
      setCurrentStep(2);
    }
  }, [preselectedRoomId]);

  // Helper to match active pricing rule with room and stay dates
  const getRuleForRoom = (room: Room | null, inDate?: string, outDate?: string) => {
    if (!room || !room.room_type_room_type_id) return null;
    const stayIn = inDate || checkInDate || new Date().toISOString().split("T")[0];
    const stayOut = outDate || checkOutDate || stayIn;
    return pricingRules.find((p) => {
      if (p.room_type_room_type_id !== room.room_type_room_type_id) return false;
      const ruleStart = p.start_date.split("T")[0];
      const ruleEnd = p.end_date.split("T")[0];
      return stayIn <= ruleEnd && stayOut >= ruleStart;
    });
  };

  // Calculations with dynamic Pricing Rules
  const calculateNights = () => {
    if (!checkInDate || !checkOutDate) return 1;
    const d1 = new Date(checkInDate);
    const d2 = new Date(checkOutDate);
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
    return diff > 0 ? diff : 1;
  };

  const nights = calculateNights();
  const roomBasePrice = selectedRoom?.room_type?.price || 5000;
  const activePricingRule = getRuleForRoom(selectedRoom, checkInDate, checkOutDate);
  const rateOverridePercent = activePricingRule ? activePricingRule.rate_override : 0;
  const effectiveRoomRate = activePricingRule
    ? Math.round(roomBasePrice * (1 + rateOverridePercent / 100))
    : roomBasePrice;

  // Board Surcharges per night
  const boardSurchargePerNight = boardType === "HB" ? 1500 : boardType === "FB" ? 3000 : 0;
  const totalRoomCost = (effectiveRoomRate + boardSurchargePerNight) * nights;

  const totalServicesCost = selectedServiceIds.reduce((sum, sId) => {
    const srv = services.find((s) => s.service_id === sId);
    return sum + (srv?.price || 0);
  }, 0);

  const totalToursCost = selectedTourIds.reduce((sum, tId) => {
    const tour = tours.find((t) => t.tour_id === tId);
    return sum + (tour?.adult_price || 0);
  }, 0);

  const packageDiscount = selectedPackage === "honeymoon" ? 1500 : selectedPackage === "family" ? 1000 : 0;
  const subtotal = Math.max(0, totalRoomCost + totalServicesCost + totalToursCost - packageDiscount);
  const vatAmount = subtotal * 0.15; // 15% VAT in Mauritius
  const grandTotal = subtotal + vatAmount;

  // Navigation handlers
  const handleNextStep = async () => {
    setErrorMsg("");
    setSuggestedDates(null);
    if (currentStep === 1 && !selectedRoom) {
      setErrorMsg("Please select a room to proceed.");
      return;
    }
    if (currentStep === 2) {
      if (!checkInDate || !checkOutDate) {
        setErrorMsg("Please select check-in and check-out dates.");
        return;
      }
      if (new Date(checkOutDate) <= new Date(checkInDate)) {
        setErrorMsg("Check-out date must be after check-in date.");
        return;
      }

      if (selectedRoom) {
        const { data: stays, error } = await supabase
          .from("check_in_out")
          .select("check_in_date, check_out_date, booking!inner(booking_status)")
          .eq("room_room_id", selectedRoom.room_id)
          .eq("booking.booking_status", "Confirmed");

        if (error) {
          console.error("Error checking availability:", error);
        } else if (stays) {
          const reqInStr = checkInDate;
          const reqOutStr = checkOutDate;

          const formattedStays = stays.map((s) => ({
            in: s.check_in_date.split("T")[0],
            out: s.check_out_date.split("T")[0],
          }));

          const overlaps = formattedStays.some(
            (stay) => reqInStr < stay.out && reqOutStr > stay.in
          );

          if (overlaps) {
            const reqInDate = new Date(reqInStr + "T00:00:00.000Z");
            const reqOutDate = new Date(reqOutStr + "T00:00:00.000Z");
            const duration = Math.max(1, Math.ceil((reqOutDate.getTime() - reqInDate.getTime()) / (1000 * 3600 * 24)));
            const nextSlot = findNextAvailableDates(reqInStr, duration, formattedStays);

            setSuggestedDates({
              checkIn: nextSlot.checkIn,
              checkOut: nextSlot.checkOut,
            });
            setErrorMsg(`The room is unavailable for the selected dates. Selected room is already reserved.`);
            return;
          }
        }
      }
    }
    if (currentStep === 4) {
      if (!fname || !lname || !email) {
        setErrorMsg("First name, last name, and email are required.");
        return;
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const handlePrevStep = () => {
    setErrorMsg("");
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Stripe Checkout Session Trigger
  const handleProceedToStripe = async () => {
    setIsRedirectingToStripe(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoom?.room_id,
          roomTypeName: selectedRoom?.room_type?.type,
          checkInDate,
          checkOutDate,
          boardType,
          totalAmount: grandTotal,
          guestInfo: {
            fname,
            lname,
            email,
            contactInfo,
            nationality,
            passportNumber,
            country,
          },
          services: selectedServiceIds,
          tours: selectedTourIds,
          pricingRule: activePricingRule
            ? {
                pr_id: activePricingRule.pr_id,
                reason: activePricingRule.reason,
                rate_override: activePricingRule.rate_override,
                basePrice: roomBasePrice,
                effectivePrice: effectiveRoomRate,
              }
            : null,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.sessionId) {
        // Fallback or demo confirmation
        router.push(`/customer/bookings`);
      } else {
        throw new Error(data.error || "Failed to initialize Stripe Checkout session.");
      }
    } catch (err: any) {
      console.error("Stripe Checkout Error:", err);
      setErrorMsg(err.message || "Checkout connection issue. Redirecting to bookings demo confirmation...");
      setTimeout(() => {
        router.push("/customer/bookings");
      }, 2000);
    } finally {
      setIsRedirectingToStripe(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#A37836]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Step Indicator Header */}
      <div className="bg-white p-6 rounded-3xl border border-[#E5E2DC] shadow-sm">
        <h1 className="text-2xl font-extrabold text-[#1A202C] text-center mb-2">Reservation Wizard</h1>
        <StepIndicator currentStep={currentStep} steps={WIZARD_STEPS} />
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex flex-col gap-2 text-sm font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          {suggestedDates && (
            <div className="mt-2 pl-7 space-y-2">
              <p className="text-xs text-slate-600 font-medium">
                Suggested Next Available Dates: <strong>{formatDate(suggestedDates.checkIn)}</strong> to <strong>{formatDate(suggestedDates.checkOut)}</strong>
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCheckInDate(suggestedDates.checkIn);
                  setCheckOutDate(suggestedDates.checkOut);
                  setSuggestedDates(null);
                  setErrorMsg("");
                }}
                className="text-xs border-[#A37836] text-[#A37836] hover:bg-[#F4EFE6] px-3 py-1.5 h-auto rounded-lg font-bold"
              >
                Use Suggested Dates
              </Button>
            </div>
          )}
        </div>
      )}

      {/* STEP 1: Select Room */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-[#1A202C]">Step 1: Choose Your Room</h2>
            <span className="text-xs text-slate-500">{rooms.length} available rooms</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rooms.map((room) => {
              const isSelected = selectedRoom?.room_id === room.room_id;
              const typeName = room.room_type?.type || "Suite";
              const price = room.room_type?.price || 5000;
              const rule = getRuleForRoom(room);

              return (
                <div
                  key={room.room_id}
                  onClick={() => setSelectedRoom(room)}
                  className={`bg-white p-5 rounded-2xl border cursor-pointer transition-all duration-300 flex flex-col justify-between shadow-sm ${
                    isSelected
                      ? "border-[#A37836] ring-2 ring-[#A37836] bg-[#F4EFE6]/30"
                      : "border-[#E5E2DC] hover:border-[#A37836]/60"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge className="bg-[#A37836] text-white text-[10px]">
                          {typeName}
                        </Badge>
                        <h3 className="font-bold text-lg text-[#1A202C] mt-1">Room #{room.room_id}</h3>
                      </div>
                      <div className="text-right">
                        <PricingBadge
                          basePrice={price}
                          rateOverride={rule?.rate_override}
                          reason={rule?.reason}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {room.room_desc || "Luxurious suite with private ocean terrace and king bed."}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#A37836]">
                      {isSelected ? "✓ Currently Selected" : "Click to Select"}
                    </span>
                    <input
                      type="radio"
                      name="selectedRoom"
                      checked={isSelected}
                      onChange={() => setSelectedRoom(room)}
                      className="accent-[#A37836] h-4 w-4"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: Dates & Board Basis */}
      {currentStep === 2 && (
        <div className="bg-white p-8 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-[#1A202C]">Step 2: Dates & Board Plan</h2>
            <span className="text-xs text-slate-500 font-medium">
              Selected Room #{selectedRoom?.room_id} ({selectedRoom?.room_type?.type})
            </span>
          </div>

          {/* Elevated Availability Calendar / Occupied Dates List */}
          {occupiedStays.length > 0 ? (
            <div className="bg-red-50 border border-red-200 p-4 rounded-2xl space-y-2">
              <div className="text-xs font-bold text-red-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-red-600" /> Currently Reserved Date Ranges for Room #{selectedRoom?.room_id}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {occupiedStays.map((stay, idx) => (
                  <Badge key={idx} className="bg-red-600 text-white text-xs font-semibold px-2.5 py-1 rounded-lg">
                    Occupied: {formatDate(stay.in)} to {formatDate(stay.out)}
                  </Badge>
                ))}
              </div>
              <p className="text-[11px] text-red-700">
                Please pick check-in/out dates outside of these red reserved ranges.
              </p>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              Room #{selectedRoom?.room_id} has no existing reservations for upcoming dates!
            </div>
          )}

          {/* Active Pricing Rule Callout */}
          {activePricingRule && (
            <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-2xl flex items-center justify-between text-xs gap-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <span>{activePricingRule.reason || "Special Rate Applied"}</span>
                    <Badge className="bg-amber-600 text-white text-[10px] font-bold py-0">
                      {activePricingRule.rate_override > 0 ? `+${activePricingRule.rate_override}% Surcharge` : `${activePricingRule.rate_override}% Discount`}
                    </Badge>
                  </div>
                  <span className="text-amber-800 text-[11px] block mt-0.5">
                    Seasonal rate override applies for your stay window: <strong>{formatCurrency(effectiveRoomRate)}</strong> / night (Standard: <span className="line-through">{formatCurrency(roomBasePrice)}</span>).
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Check-In Date *</Label>
              <Input
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                className="bg-[#F8F7F4] border-[#E5E2DC]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Check-Out Date *</Label>
              <Input
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="bg-[#F8F7F4] border-[#E5E2DC]"
                required
              />
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <Label className="font-bold text-slate-700">Select Board Basis *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                onClick={() => setBoardType("RO")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  boardType === "RO"
                    ? "border-[#A37836] bg-[#F4EFE6] ring-1 ring-[#A37836]"
                    : "border-[#E5E2DC] bg-[#F8F7F4]"
                }`}
              >
                <div className="font-bold text-sm text-[#1A202C]">RO (Room Only)</div>
                <div className="text-xs text-slate-500 mt-1">Standard night rate</div>
                <div className="text-xs font-semibold text-[#A37836] mt-2">+ MUR 0.00 / night</div>
              </div>

              <div
                onClick={() => setBoardType("HB")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  boardType === "HB"
                    ? "border-[#A37836] bg-[#F4EFE6] ring-1 ring-[#A37836]"
                    : "border-[#E5E2DC] bg-[#F8F7F4]"
                }`}
              >
                <div className="font-bold text-sm text-[#1A202C]">HB (Half Board)</div>
                <div className="text-xs text-slate-500 mt-1">Breakfast & Dinner included</div>
                <div className="text-xs font-semibold text-[#A37836] mt-2">+ MUR 1,500.00 / night</div>
              </div>

              <div
                onClick={() => setBoardType("FB")}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  boardType === "FB"
                    ? "border-[#A37836] bg-[#F4EFE6] ring-1 ring-[#A37836]"
                    : "border-[#E5E2DC] bg-[#F8F7F4]"
                }`}
              >
                <div className="font-bold text-sm text-[#1A202C]">FB (Full Board)</div>
                <div className="text-xs text-slate-500 mt-1">Breakfast, Lunch & Dinner</div>
                <div className="text-xs font-semibold text-[#A37836] mt-2">+ MUR 3,000.00 / night</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Add-on Services & Excursions */}
      {currentStep === 3 && (
        <div className="bg-white p-8 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-[#1A202C]">Step 3: Enhance Your Stay (Optional)</h2>

          {/* Exclusive Packages */}
          <div className="space-y-3 pb-6 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#A37836]" /> Exclusive Resort Packages
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {RESORT_PACKAGES.map((pkg) => {
                const isSelected = selectedPackage === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedPackage(null);
                        setSelectedServiceIds((prev) => {
                          const pkgServiceIds = services
                            .filter((s) => pkg.services.includes(s.service_name))
                            .map((s) => s.service_id);
                          return prev.filter((id) => !pkgServiceIds.includes(id));
                        });
                        setSelectedTourIds((prev) => {
                          const pkgTourIds = tours
                            .filter((t) => pkg.tours.includes(t.tour_name))
                            .map((t) => t.tour_id);
                          return prev.filter((id) => !pkgTourIds.includes(id));
                        });
                      } else {
                        setSelectedPackage(pkg.id);
                        setSelectedServiceIds((prev) => {
                          const pkgServiceIds = services
                            .filter((s) => pkg.services.includes(s.service_name))
                            .map((s) => s.service_id);
                          return Array.from(new Set([...prev, ...pkgServiceIds]));
                        });
                        setSelectedTourIds((prev) => {
                          const pkgTourIds = tours
                            .filter((t) => pkg.tours.includes(t.tour_name))
                            .map((t) => t.tour_id);
                          return Array.from(new Set([...prev, ...pkgTourIds]));
                        });
                      }
                    }}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? "border-[#A37836] bg-[#F4EFE6] ring-1 ring-[#A37836]"
                        : "border-[#E5E2DC] hover:border-[#A37836]/60 bg-white"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <Badge className="bg-[#A37836] text-white text-[9px] uppercase tracking-wider font-bold">
                          {pkg.badge}
                        </Badge>
                        <span className="font-extrabold text-[#1A202C] text-sm">{formatCurrency(pkg.price)}</span>
                      </div>
                      <h4 className="font-bold text-sm text-[#1A202C] mt-2">{pkg.name}</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{pkg.description}</p>
                    </div>
                    <div className="text-[10px] font-bold text-[#A37836] mt-4 flex items-center gap-1">
                      {isSelected ? "✓ PACKAGE APPLIED" : "+ APPLY PACKAGE"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Spa & Services */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2">
              <ConciergeBell className="h-4 w-4 text-[#A37836]" /> Resort & Spa Services
            </h3>
            <div className="space-y-2">
              {services.map((s) => {
                const isChecked = selectedServiceIds.includes(s.service_id);
                return (
                  <div
                    key={s.service_id}
                    onClick={() =>
                      setSelectedServiceIds((prev) =>
                        isChecked ? prev.filter((id) => id !== s.service_id) : [...prev, s.service_id]
                      )
                    }
                    className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                      isChecked ? "border-[#A37836] bg-[#F4EFE6]" : "border-[#E5E2DC]"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox checked={isChecked} />
                      <div>
                        <div className="font-bold text-sm text-[#1A202C]">{s.service_name}</div>
                        <div className="text-xs text-slate-500">{s.service_desc}</div>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-[#A37836]">{formatCurrency(s.price)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tours Excursions */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="font-bold text-sm text-slate-700 flex items-center gap-2">
              <Compass className="h-4 w-4 text-[#A37836]" /> Island Excursions & Catamaran Trips
            </h3>
            <div className="space-y-2">
              {tours.map((t) => {
                const isChecked = selectedTourIds.includes(t.tour_id);
                return (
                  <div
                    key={t.tour_id}
                    onClick={() =>
                      setSelectedTourIds((prev) =>
                        isChecked ? prev.filter((id) => id !== t.tour_id) : [...prev, t.tour_id]
                      )
                    }
                    className={`p-4 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                      isChecked ? "border-[#A37836] bg-[#F4EFE6]" : "border-[#E5E2DC]"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox checked={isChecked} />
                      <div>
                        <div className="font-bold text-sm text-[#1A202C]">{t.tour_name}</div>
                        <div className="text-xs text-slate-500">{t.tour_desc} ({t.durations} Hours)</div>
                      </div>
                    </div>
                    <span className="font-bold text-sm text-[#A37836]">{formatCurrency(t.adult_price)} / adult</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Guest Details */}
      {currentStep === 4 && (
        <div className="bg-white p-8 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-[#1A202C]">Step 4: Guest Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">First Name *</Label>
              <Input
                value={fname}
                onChange={(e) => setFname(e.target.value)}
                className="bg-[#F8F7F4] border-[#E5E2DC]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Last Name *</Label>
              <Input
                value={lname}
                onChange={(e) => setLname(e.target.value)}
                className="bg-[#F8F7F4] border-[#E5E2DC]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Email Address *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#F8F7F4] border-[#E5E2DC]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Phone Contact</Label>
              <Input
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="+230 5700 0000"
                className="bg-[#F8F7F4] border-[#E5E2DC]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Nationality</Label>
              <Input
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                className="bg-[#F8F7F4] border-[#E5E2DC]"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Passport Number</Label>
              <Input
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value)}
                className="bg-[#F8F7F4] border-[#E5E2DC]"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Country of Residence</Label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="bg-[#F8F7F4] border-[#E5E2DC]"
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: Review & Checkout */}
      {currentStep === 5 && (
        <div className="bg-white p-8 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-[#1A202C]">Step 5: Review & Stripe Checkout</h2>

          {/* Itemized Receipt */}
          <div className="space-y-4 bg-[#F8F7F4] p-6 rounded-2xl border border-[#E5E2DC]">
            <h3 className="font-extrabold text-sm text-[#1A202C] uppercase tracking-wider">
              Reservation Summary
            </h3>

            <div className="space-y-2 text-sm border-b border-slate-200 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-slate-600 block">
                    {selectedRoom?.room_type?.type} Room #{selectedRoom?.room_id} ({nights} {nights === 1 ? "night" : "nights"} @ {formatCurrency(effectiveRoomRate)}/nt)
                  </span>
                  {activePricingRule && (
                    <span className="text-[11px] text-amber-700 font-semibold block">
                      Seasonal {activePricingRule.rate_override > 0 ? `+${activePricingRule.rate_override}%` : `${activePricingRule.rate_override}%`} ({activePricingRule.reason || "Pricing Rule"}) applied to base rate ({formatCurrency(roomBasePrice)}/nt)
                    </span>
                  )}
                </div>
                <span className="font-bold text-[#1A202C]">
                  {formatCurrency(effectiveRoomRate * nights)}
                </span>
              </div>

              {boardSurchargePerNight > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Board Supplement ({boardType})</span>
                  <span className="font-bold text-[#1A202C]">
                    {formatCurrency(boardSurchargePerNight * nights)}
                  </span>
                </div>
              )}

              {selectedServiceIds.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Selected Resort Services ({selectedServiceIds.length})</span>
                  <span className="font-bold text-[#1A202C]">{formatCurrency(totalServicesCost)}</span>
                </div>
              )}

              {selectedTourIds.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Excursion Tours ({selectedTourIds.length})</span>
                  <span className="font-bold text-[#1A202C]">{formatCurrency(totalToursCost)}</span>
                </div>
              )}

              {packageDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Bundle Package Discount</span>
                  <span>-{formatCurrency(packageDiscount)}</span>
                </div>
              )}
            </div>

            <div className="space-y-1 text-sm pt-2">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>VAT (15% Mauritius)</span>
                <span>{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-extrabold text-[#1A202C] pt-2 border-t border-slate-300">
                <span>Total Amount Due (MUR)</span>
                <span className="text-[#A37836]">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs text-emerald-800">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>
              Transactions processed via encrypted Stripe Payment Gateway. Instant confirmation will be dispatched upon payment completion.
            </span>
          </div>

          <Button
            onClick={handleProceedToStripe}
            disabled={isRedirectingToStripe}
            className="w-full bg-[#A37836] hover:bg-[#8B6327] text-white py-6 rounded-2xl text-base font-bold shadow-xl gap-2"
          >
            <CreditCard className="h-5 w-5" />
            {isRedirectingToStripe ? "Connecting to Stripe..." : `Pay ${formatCurrency(grandTotal)} with Stripe`}
          </Button>
        </div>
      )}

      {/* Wizard Footer Navigation Buttons */}
      <div className="flex items-center justify-between pt-4">
        {currentStep > 1 ? (
          <Button variant="outline" onClick={handlePrevStep} className="border-[#E5E2DC] text-slate-600 gap-1">
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
        ) : (
          <div />
        )}

        {currentStep < 5 && (
          <Button onClick={handleNextStep} className="bg-[#A37836] hover:bg-[#8B6327] text-white rounded-xl gap-1">
            Next Step <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
