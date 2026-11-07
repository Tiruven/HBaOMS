// app/customer/booking/new/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Room, PricingRule } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getImageUrl } from "@/lib/imageUtils";
import { calculateVat } from "@/lib/pricing";
import { StepIndicator } from "@/components/customer/StepIndicator";
import { PricingBadge } from "@/components/customer/PricingBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  BedDouble,
  Calendar,
  Sparkles,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Users,
  Compass,
} from "lucide-react";

import { mauritiusToday, addDaysToMauritiusDate } from "@/lib/time";

const WIZARD_STEPS = [
  "Select Room",
  "Dates & Board",
  "Resort Packages",
  "Guest Profile",
  "Review & Pay",
];

function findNextAvailableDates(
  requestedInStr: string,
  durationDays: number,
  stays: { in: string; out: string }[]
) {
  let candInStr = requestedInStr || mauritiusToday();
  let isAvailable = false;
  let loops = 0;

  while (!isAvailable && loops < 100) {
    loops++;
    const candOutStr = addDaysToMauritiusDate(candInStr, durationDays);
    const overlap = stays.find((s) => candInStr < s.out && candOutStr > s.in);

    if (overlap) {
      candInStr = overlap.out;
    } else {
      isAvailable = true;
    }
  }

  const nextOutStr = addDaysToMauritiusDate(candInStr, durationDays);
  return { checkIn: candInStr, checkOut: nextOutStr };
}

// Resort packages are price modifiers and experience labels only.
// They do NOT create service bookings or trips (booked post-confirmation in the portal).
const RESORT_PACKAGES = [
  {
    id: "none",
    name: "Standard Experience",
    description: "Standard accommodation with your selected room and dining board plan.",
    priceAdjustment: 0,
    badge: "Flexible",
  },
  {
    id: "honeymoon",
    name: "Honeymoon Escape Experience",
    description: "Romantic room setup, welcome sparkling wine and special honeymoon privileges.",
    priceAdjustment: -1500, // Promotional bundle discount
    badge: "15% Promotional Savings",
  },
  {
    id: "family",
    name: "Family Adventure Experience",
    description: "Complimentary kids amenities, early check-in priority and family resort perks.",
    priceAdjustment: -1000, // Promotional bundle discount
    badge: "10% Promotional Savings",
  },
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
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);

  // Wizard Selections
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [checkInDate, setCheckInDate] = useState<string>("");
  const [checkOutDate, setCheckOutDate] = useState<string>("");
  const [boardType, setBoardType] = useState<"RO" | "HB" | "FB">("RO");
  const [numAdults, setNumAdults] = useState<number>(1);
  const [numChildren, setNumChildren] = useState<number>(0);
  const [selectedPackage, setSelectedPackage] = useState<string>("none");

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

  // Payment Processing State
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState<boolean>(false);
  const [occupiedStays, setOccupiedStays] = useState<{ in: string; out: string }[]>([]);

  useEffect(() => {
    async function fetchOccupiedStays() {
      if (!selectedRoom) return;
      try {
        const todayStr = mauritiusToday();
        const { data } = await supabase
          .from("check_in_out")
          .select("check_in_date, check_out_date, booking!inner(booking_status)")
          .eq("room_room_id", selectedRoom.room_id)
          .eq("booking.booking_status", "Confirmed")
          .gte("check_out_date", todayStr);

        if (data) {
          setOccupiedStays(
            data
              .map((d) => ({
                in: d.check_in_date.split("T")[0],
                out: d.check_out_date.split("T")[0],
              }))
              .filter((stay) => stay.out >= todayStr)
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
        const [rRes, prRes] = await Promise.all([
          supabase.from("room").select("*, room_type(*), room_feature(feature(*))").eq("room_status", "Available"),
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
        if (prRes.data) setPricingRules(prRes.data);

        // Pre-fill dates using search params if provided, or default to Mauritius calendar
        const paramCheckIn = searchParams.get("checkIn");
        const paramCheckOut = searchParams.get("checkOut");
        const paramAdults = searchParams.get("adults");
        const paramChildren = searchParams.get("children");

        const todayStr = mauritiusToday();
        const tomorrowStr = addDaysToMauritiusDate(todayStr, 3);
        setCheckInDate(paramCheckIn || todayStr);
        setCheckOutDate(paramCheckOut || tomorrowStr);

        if (paramAdults) {
          const a = Number(paramAdults);
          if (!isNaN(a) && a >= 1) setNumAdults(a);
        }
        if (paramChildren) {
          const c = Number(paramChildren);
          if (!isNaN(c) && c >= 0) setNumChildren(c);
        }

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
    const stayIn = inDate || checkInDate || mauritiusToday();
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
    const [y1, m1, d1] = checkInDate.split("-").map(Number);
    const [y2, m2, d2] = checkOutDate.split("-").map(Number);
    const diff = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
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

  // Package adjustment (discount)
  const pkg = RESORT_PACKAGES.find((p) => p.id === selectedPackage);
  const packageAdjustment = pkg ? pkg.priceAdjustment : 0;

  const subtotal = Math.max(0, totalRoomCost + packageAdjustment);
  const vatAmount = calculateVat(subtotal);
  const grandTotal = subtotal + vatAmount;

  // Max occupancy limits from room_type
  const maxAdultsAllowed = selectedRoom?.room_type?.max_adults || 2;
  const maxChildrenAllowed = selectedRoom?.room_type?.max_children ?? 2;

  // Navigation handlers
  const handleNextStep = async () => {
    setErrorMsg("");
    setSuggestedDates(null);

    if (currentStep === 1) {
      if (!selectedRoom) {
        setErrorMsg("Please select a room to proceed.");
        return;
      }
    }

    if (currentStep === 2) {
      if (!checkInDate || !checkOutDate) {
        setErrorMsg("Please select check-in and check-out dates.");
        return;
      }
      if (checkOutDate <= checkInDate) {
        setErrorMsg("Check-out date must be after check-in date.");
        return;
      }

      const todayStr = mauritiusToday();
      if (checkInDate < todayStr) {
        setErrorMsg("Check-in date cannot be in the past.");
        return;
      }

      // Validate Occupancy against room_type limits
      if (numAdults < 1) {
        setErrorMsg("At least 1 adult is required for the reservation.");
        return;
      }
      if (numAdults > maxAdultsAllowed) {
        setErrorMsg(`Selected room accommodates a maximum of ${maxAdultsAllowed} adults.`);
        return;
      }
      if (numChildren > maxChildrenAllowed) {
        setErrorMsg(`Selected room accommodates a maximum of ${maxChildrenAllowed} children (under 12).`);
        return;
      }

      if (selectedRoom) {
        const { data: stays, error } = await supabase
          .from("check_in_out")
          .select("check_in_date, check_out_date, booking!inner(booking_status)")
          .eq("room_room_id", selectedRoom.room_id)
          .eq("booking.booking_status", "Confirmed")
          .gte("check_out_date", todayStr);

        if (error) {
          console.error("Error checking availability:", error);
        } else if (stays) {
          const conflicting = stays.some((stay) => {
            const stayIn = stay.check_in_date.split("T")[0];
            const stayOut = stay.check_out_date.split("T")[0];
            return checkInDate < stayOut && checkOutDate > stayIn;
          });

          if (conflicting) {
            const activeStays = stays.map((s) => ({
              in: s.check_in_date.split("T")[0],
              out: s.check_out_date.split("T")[0],
            }));
            const nextDates = findNextAvailableDates(checkInDate, nights, activeStays);
            setSuggestedDates(nextDates);
            setErrorMsg("This room is already reserved for the selected dates. Please review the occupied ranges.");
            return;
          }
        }
      }
    }

    if (currentStep === 4) {
      if (!fname.trim() || !lname.trim() || !email.trim()) {
        setErrorMsg("Please provide your first name, last name, and contact email.");
        return;
      }
    }

    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const handlePrevStep = () => {
    setErrorMsg("");
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Stripe Checkout Session Trigger (Flow 1: Room Booking only)
  const handleProceedToStripe = async () => {
    setIsRedirectingToStripe(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutType: "booking",
          roomId: selectedRoom?.room_id,
          roomTypeName: selectedRoom?.room_type?.type,
          checkInDate,
          checkOutDate,
          boardType,
          numAdults,
          numChildren,
          selectedPackage: selectedPackage !== "none" ? pkg?.name : null,
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
        router.push(`/customer/bookings`);
      } else {
        throw new Error(data.error || "Failed to initialize Stripe Checkout session.");
      }
    } catch (err: any) {
      console.error("Stripe Checkout Error:", err);
      setErrorMsg(err.message || "Checkout connection issue. Redirecting to bookings confirmation...");
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
                  setErrorMsg("");
                  setSuggestedDates(null);
                }}
                className="text-xs bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-8"
              >
                Apply Suggested Dates
              </Button>
            </div>
          )}
        </div>
      )}

      {/* STEP 1: Room Selection */}
      {currentStep === 1 && (
        <div className="bg-white p-8 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-[#1A202C]">Step 1: Select Your Room</h2>
            <span className="text-xs text-slate-500">{rooms.length} Available Rooms</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map((room) => {
              const isSelected = selectedRoom?.room_id === room.room_id;
              const rule = getRuleForRoom(room);
              const price = room.room_type?.price || 5000;

              return (
                <div
                  key={room.room_id}
                  onClick={() => setSelectedRoom(room)}
                  className={`rounded-2xl border cursor-pointer transition-all flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                    isSelected
                      ? "border-[#A37836] bg-[#F4EFE6] ring-2 ring-[#A37836]"
                      : "border-[#E5E2DC] hover:border-[#A37836]/60 bg-white"
                  }`}
                >
                  <div className="h-32 w-full bg-slate-100 overflow-hidden relative">
                    <img
                      src={getImageUrl(room.image_path || room.room_type?.image_path, "room")}
                      alt={room.room_type?.type || "Room"}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-[#1A202C]/80 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                      Room #{room.room_id}
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-base text-[#1A202C]">{room.room_type?.type}</h3>
                      </div>
                      <div className="text-right">
                        <PricingBadge
                          basePrice={price}
                          rateOverride={rule?.rate_override}
                          reason={rule?.reason}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {room.room_desc || "Luxurious suite with private ocean terrace and king bed."}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Max {room.room_type?.max_adults || 2} Adults</span>
                      <span>•</span>
                      <span>Max {room.room_type?.max_children ?? 2} Children</span>
                    </div>
                  </div>

                  <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
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

      {/* STEP 2: Dates, Board & Occupancy */}
      {currentStep === 2 && (
        <div className="bg-white p-8 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-[#1A202C]">Step 2: Dates, Board Plan & Occupancy</h2>
            <span className="text-xs text-slate-500 font-medium">
              Selected Room #{selectedRoom?.room_id} ({selectedRoom?.room_type?.type})
            </span>
          </div>

          {/* Reserved Dates Warning */}
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
                Please pick check-in/out dates outside of these reserved ranges.
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
                    Seasonal rate override applies: <strong>{formatCurrency(effectiveRoomRate)}</strong> / night (Standard: <span className="line-through">{formatCurrency(roomBasePrice)}</span>).
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

          {/* Occupancy selection validated against room limits */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <Label className="font-bold text-slate-700 flex items-center gap-2">
                <Users className="h-4 w-4 text-[#A37836]" /> Guests & Occupancy *
              </Label>
              <span className="text-xs text-slate-500">
                Room #{selectedRoom?.room_id} limit: Max {maxAdultsAllowed} Adults, {maxChildrenAllowed} Children
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 bg-[#F8F7F4] p-4 rounded-2xl border border-[#E5E2DC]">
                <div className="flex justify-between items-center">
                  <Label htmlFor="numAdults" className="text-xs font-bold text-[#1A202C]">Adults (Age 12+)</Label>
                  <span className="text-[11px] text-slate-400">Max {maxAdultsAllowed}</span>
                </div>
                <Input
                  id="numAdults"
                  type="number"
                  min="1"
                  max={maxAdultsAllowed}
                  value={numAdults}
                  onChange={(e) => setNumAdults(Math.max(1, Number(e.target.value)))}
                  className="bg-white border-[#E5E2DC]"
                  required
                />
              </div>

              <div className="space-y-1.5 bg-[#F8F7F4] p-4 rounded-2xl border border-[#E5E2DC]">
                <div className="flex justify-between items-center">
                  <Label htmlFor="numChildren" className="text-xs font-bold text-[#1A202C]">Children (Under 12 years)</Label>
                  <span className="text-[11px] text-slate-400">Max {maxChildrenAllowed}</span>
                </div>
                <Input
                  id="numChildren"
                  type="number"
                  min="0"
                  max={maxChildrenAllowed}
                  value={numChildren}
                  onChange={(e) => setNumChildren(Math.max(0, Number(e.target.value)))}
                  className="bg-white border-[#E5E2DC]"
                />
                <p className="text-[10px] text-slate-500">Child means under 12 years old.</p>
              </div>
            </div>
          </div>

          {/* Board Plan selection */}
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

      {/* STEP 3: Resort Experience Packages */}
      {currentStep === 3 && (
        <div className="bg-white p-8 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[#1A202C] flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#A37836]" /> Step 3: Resort Experience Packages
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Select an optional resort package modifier for special amenities and promotional discounts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {RESORT_PACKAGES.map((p) => {
              const isSelected = selectedPackage === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPackage(p.id)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? "border-[#A37836] bg-[#F4EFE6] ring-2 ring-[#A37836]"
                      : "border-[#E5E2DC] hover:border-[#A37836]/60 bg-white"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <Badge className="bg-[#A37836] text-white text-[9px] uppercase tracking-wider font-bold">
                        {p.badge}
                      </Badge>
                      {p.priceAdjustment < 0 && (
                        <span className="font-bold text-emerald-600 text-xs">
                          {formatCurrency(Math.abs(p.priceAdjustment))} Off
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#1A202C]">{p.name}</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{p.description}</p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#A37836]">
                      {isSelected ? "✓ Selected" : "Select Package"}
                    </span>
                    <input
                      type="radio"
                      name="selectedPackage"
                      checked={isSelected}
                      onChange={() => setSelectedPackage(p.id)}
                      className="accent-[#A37836] h-4 w-4"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Portal Information Banner */}
          <div className="bg-[#F8F7F4] border border-[#E5E2DC] p-5 rounded-2xl flex items-start gap-3">
            <Compass className="h-5 w-5 text-[#A37836] shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-1">
              <span className="font-bold text-[#1A202C] block">Looking to book Spa treatments or Excursions?</span>
              <p>
                In accordance with resort policy, individual services (massages, shuttle, buffet) and scheduled catamaran trips can be booked directly through your <strong>Client Portal</strong> once your room is reserved!
              </p>
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
                  <span className="text-xs text-slate-500 block">
                    {numAdults} Adult{numAdults > 1 ? "s" : ""}{numChildren > 0 ? `, ${numChildren} Child${numChildren > 1 ? "ren" : ""}` : ""}
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

              {selectedPackage !== "none" && pkg && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>{pkg.name} ({pkg.badge})</span>
                  <span>{packageAdjustment < 0 ? `-${formatCurrency(Math.abs(packageAdjustment))}` : formatCurrency(packageAdjustment)}</span>
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

          {/* Add-ons Guidance */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-900">
            <Compass className="h-5 w-5 text-amber-700 shrink-0" />
            <span>
              After completing your reservation, you can customize your itinerary with Spa sessions, airport shuttles, and scheduled catamaran trips directly in your <strong>Client Portal</strong>.
            </span>
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
