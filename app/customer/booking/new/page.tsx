// app/customer/booking/new/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Room, Service, Tour, Customer } from "@/lib/types";
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

  // Payment Processing State
  const [isRedirectingToStripe, setIsRedirectingToStripe] = useState<boolean>(false);

  useEffect(() => {
    async function loadCatalog() {
      setLoadingData(true);
      try {
        const [rRes, sRes, tRes] = await Promise.all([
          supabase.from("room").select("*, room_type(*), room_feature(feature(*))").eq("room_status", "Available"),
          supabase.from("service").select("*"),
          supabase.from("tour").select("*"),
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

  // Calculations
  const calculateNights = () => {
    if (!checkInDate || !checkOutDate) return 1;
    const d1 = new Date(checkInDate);
    const d2 = new Date(checkOutDate);
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
    return diff > 0 ? diff : 1;
  };

  const nights = calculateNights();
  const roomBasePrice = selectedRoom?.room_type?.price || 5000;

  // Board Surcharges per night
  const boardSurchargePerNight = boardType === "HB" ? 1500 : boardType === "FB" ? 3000 : 0;
  const totalRoomCost = (roomBasePrice + boardSurchargePerNight) * nights;

  const totalServicesCost = selectedServiceIds.reduce((sum, sId) => {
    const srv = services.find((s) => s.service_id === sId);
    return sum + (srv?.price || 0);
  }, 0);

  const totalToursCost = selectedTourIds.reduce((sum, tId) => {
    const tour = tours.find((t) => t.tour_id === tId);
    return sum + (tour?.adult_price || 0);
  }, 0);

  const subtotal = totalRoomCost + totalServicesCost + totalToursCost;
  const vatAmount = subtotal * 0.15; // 15% VAT in Mauritius
  const grandTotal = subtotal + vatAmount;

  // Navigation handlers
  const handleNextStep = () => {
    setErrorMsg("");
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
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-2 text-sm font-semibold">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
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
                        <span className="text-lg font-extrabold text-[#1A202C]">{formatCurrency(price)}</span>
                        <span className="text-[10px] text-slate-400 block">/ night</span>
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
          <h2 className="text-xl font-bold text-[#1A202C]">Step 2: Dates & Board Plan</h2>

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
              <div className="flex justify-between">
                <span className="text-slate-600">
                  {selectedRoom?.room_type?.type} Room #{selectedRoom?.room_id} ({nights} nights)
                </span>
                <span className="font-bold text-[#1A202C]">
                  {formatCurrency((selectedRoom?.room_type?.price || 5000) * nights)}
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
