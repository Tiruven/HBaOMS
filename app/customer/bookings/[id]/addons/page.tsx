// app/customer/bookings/[id]/addons/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Booking, CheckInOut, Service, Tour, Trip, ServiceBooking, TripBooking } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getImageUrl } from "@/lib/imageUtils";
import {
  isWithinStayWindow,
  computeSlotEndTime,
  isWithinOperatingHours,
  mauritiusToInstant,
  isPast,
  formatMauritius,
} from "@/lib/timeUtils";
import { calculateVat, calculateTotalWithVat, calculateTourPrice } from "@/lib/pricing";
import { checkServiceSlotCapacity, checkTripCapacity } from "@/lib/capacity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ConciergeBell,
  Compass,
  CreditCard,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Clock,
  Calendar,
  Users,
  Loader2,
} from "lucide-react";

interface SelectedServiceCartItem {
  service: Service;
  date: string;
  timeIn: string;
  timeOut: string;
  numPerson: number;
  price: number;
}

interface SelectedTripCartItem {
  tour: Tour;
  trip: Trip;
  numAdult: number;
  numChild: number;
  price: number;
}

export default function CustomerAddonsPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = Number(params.id);
  const { user } = useUser();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [stay, setStay] = useState<CheckInOut | null>(null);
  const [existingServiceBookings, setExistingServiceBookings] = useState<ServiceBooking[]>([]);
  const [existingTripBookings, setExistingTripBookings] = useState<TripBooking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Cart selection state
  const [cartServices, setCartServices] = useState<Record<number, SelectedServiceCartItem>>({});
  const [cartTrips, setCartTrips] = useState<Record<number, SelectedTripCartItem>>({});

  // Trip remaining seats cache: tripId -> remainingSeats
  const [tripRemainingSeats, setTripRemainingSeats] = useState<Record<number, number>>({});

  useEffect(() => {
    async function loadData() {
      if (!bookingId) return;
      setLoading(true);
      setErrorMsg("");

      try {
        const [bRes, cioRes, srvRes, tourRes, tripRes, sbRes, tbRes] = await Promise.all([
          supabase.from("booking").select("*, customer(*)").eq("booking_id", bookingId).single(),
          supabase.from("check_in_out").select("*, room(*, room_type(*))").eq("booking_booking_id", bookingId).single(),
          supabase.from("service").select("*").order("service_name", { ascending: true }),
          supabase.from("tour").select("*").order("tour_name", { ascending: true }),
          supabase.from("trip").select("*, tour(*)").order("start_time", { ascending: true }),
          supabase.from("service_booking").select("*").eq("booking_booking_id", bookingId).neq("sb_status", "Cancelled"),
          supabase.from("trip_booking").select("*").eq("booking_booking_id", bookingId),
        ]);

        if (bRes.data) setBooking(bRes.data);
        if (cioRes.data) setStay(cioRes.data);
        if (srvRes.data) setServices(srvRes.data);
        if (tourRes.data) setTours(tourRes.data);
        if (tripRes.data) setTrips(tripRes.data);
        if (sbRes.data) setExistingServiceBookings(sbRes.data);
        if (tbRes.data) setExistingTripBookings(tbRes.data);

        // Compute seat availability for all trips
        if (tripRes.data) {
          const seatMap: Record<number, number> = {};
          for (const t of tripRes.data) {
            const capResult = await checkTripCapacity(supabase, t.trip_id);
            seatMap[t.trip_id] = capResult.remainingSeats;
          }
          setTripRemainingSeats(seatMap);
        }
      } catch (err: any) {
        console.error("Load add-on data error:", err);
        setErrorMsg("Failed to load catalog. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [bookingId]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#A37836]" />
      </div>
    );
  }

  if (!booking || !stay) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-[#E5E2DC] space-y-4">
        <h2 className="text-xl font-bold text-[#1A202C]">Reservation Not Found</h2>
        <p className="text-xs text-slate-500">We could not locate active booking #{bookingId}.</p>
        <Button asChild variant="outline">
          <Link href="/customer/bookings">Back to My Bookings</Link>
        </Button>
      </div>
    );
  }

  // Rule: Only Confirmed or Checked In bookings can purchase add-ons
  const canAddServices = booking.booking_status === "Confirmed" || booking.booking_status === "Checked In";
  if (!canAddServices) {
    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl border border-[#E5E2DC] text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-amber-600 mx-auto" />
        <h2 className="text-xl font-bold text-[#1A202C]">Add-ons Unavailable</h2>
        <p className="text-sm text-slate-600">
          Services and excursions can only be added to reservations with status <strong>Confirmed</strong> or <strong>Checked In</strong>.
          Your current reservation status is <strong>{booking.booking_status}</strong>.
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link href={`/customer/bookings/${bookingId}`}>Return to Booking Details</Link>
        </Button>
      </div>
    );
  }

  const checkInDateOnly = stay.check_in_date ? stay.check_in_date.split("T")[0] : "";
  const checkOutDateOnly = stay.check_out_date ? stay.check_out_date.split("T")[0] : "";
  const maxStayParty = (booking.num_adults || 1) + (booking.num_children || 0);

  // Toggle or update service in cart
  const handleToggleService = (srv: Service) => {
    setErrorMsg("");
    if (cartServices[srv.service_id]) {
      const copy = { ...cartServices };
      delete copy[srv.service_id];
      setCartServices(copy);
    } else {
      const defaultTime = srv.daily_open_time ? srv.daily_open_time.substring(0, 5) : "10:00";
      const duration = srv.duration_min || 60;
      const computedEnd = computeSlotEndTime(defaultTime, duration);

      setCartServices({
        ...cartServices,
        [srv.service_id]: {
          service: srv,
          date: checkInDateOnly,
          timeIn: defaultTime,
          timeOut: computedEnd,
          numPerson: 1,
          price: srv.price,
        },
      });
    }
  };

  const handleUpdateServiceField = (serviceId: number, field: string, value: any) => {
    setErrorMsg("");
    const item = cartServices[serviceId];
    if (!item) return;

    if (field === "date") {
      if (!isWithinStayWindow(value, checkInDateOnly, checkOutDateOnly)) {
        setErrorMsg(`Selected date must be within your stay window (${formatDate(checkInDateOnly)} to ${formatDate(checkOutDateOnly)}).`);
        return;
      }
      setCartServices({
        ...cartServices,
        [serviceId]: { ...item, date: value },
      });
    } else if (field === "timeIn") {
      const duration = item.service.duration_min || 60;
      const openTime = item.service.daily_open_time ? item.service.daily_open_time.substring(0, 5) : "09:00";
      const closeTime = item.service.daily_close_time ? item.service.daily_close_time.substring(0, 5) : "18:00";
      const computedEnd = computeSlotEndTime(value, duration);

      if (!isWithinOperatingHours(value, computedEnd, openTime, closeTime)) {
        setErrorMsg(`Service operating hours are between ${openTime} and ${closeTime}.`);
      }
      setCartServices({
        ...cartServices,
        [serviceId]: { ...item, timeIn: value, timeOut: computedEnd },
      });
    } else if (field === "numPerson") {
      const count = Math.max(1, Math.min(maxStayParty, Number(value) || 1));
      setCartServices({
        ...cartServices,
        [serviceId]: { ...item, numPerson: count },
      });
    }
  };

  // Toggle or update trip in cart
  const handleToggleTrip = (trip: Trip, tour: Tour) => {
    setErrorMsg("");
    // Check if duplicate on existing booking
    const alreadyBooked = existingTripBookings.some((t) => t.trip_trip_id === trip.trip_id && t.tb_status !== "Cancelled");
    if (alreadyBooked) {
      setErrorMsg("This excursion trip is already reserved on your booking.");
      return;
    }

    if (cartTrips[trip.trip_id]) {
      const copy = { ...cartTrips };
      delete copy[trip.trip_id];
      setCartTrips(copy);
    } else {
      const rem = tripRemainingSeats[trip.trip_id] ?? 20;
      if (rem <= 0) {
        setErrorMsg("This departure has no remaining seats available.");
        return;
      }

      // Pre-fill from booking, independent and editable, not capped by booking guest counts
      const defaultAdults = Math.max(1, Math.min(booking.num_adults || 1, rem));
      const defaultChildren = Math.min(booking.num_children || 0, Math.max(0, rem - defaultAdults));
      const price = calculateTourPrice(tour.adult_price, tour.child_price, defaultAdults, defaultChildren);

      setCartTrips({
        ...cartTrips,
        [trip.trip_id]: {
          tour,
          trip,
          numAdult: defaultAdults,
          numChild: defaultChildren,
          price,
        },
      });
    }
  };

  const handleUpdateTripGuests = (tripId: number, numAdult: number, numChild: number) => {
    setErrorMsg("");
    const item = cartTrips[tripId];
    if (!item) return;

    const remainingSeats = tripRemainingSeats[tripId] ?? 20;
    const totalGuests = numAdult + numChild;

    if (totalGuests <= 0) {
      setErrorMsg("Please select at least 1 participant.");
      return;
    }

    if (totalGuests > remainingSeats) {
      setErrorMsg(`Only ${remainingSeats} seat(s) remaining for this departure.`);
      return;
    }

    const price = calculateTourPrice(item.tour.adult_price, item.tour.child_price, numAdult, numChild);
    setCartTrips({
      ...cartTrips,
      [tripId]: {
        ...item,
        numAdult,
        numChild,
        price,
      },
    });
  };

  // Computations
  const servicesSubtotal = Object.values(cartServices).reduce((sum, item) => sum + item.price, 0);
  const tripsSubtotal = Object.values(cartTrips).reduce((sum, item) => sum + item.price, 0);
  const subtotal = servicesSubtotal + tripsSubtotal;
  const vatAmount = calculateVat(subtotal);
  const grandTotal = calculateTotalWithVat(subtotal);
  const totalItemsCount = Object.keys(cartServices).length + Object.keys(cartTrips).length;

  // Checkout trigger
  const handleCheckoutAddons = async () => {
    if (totalItemsCount === 0) {
      setErrorMsg("Please select at least one service or excursion.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const servicePayload = Object.values(cartServices).map((cs) => ({
        serviceId: cs.service.service_id,
        serviceDate: cs.date,
        timeIn: cs.service.service_type === "scheduled" ? mauritiusToInstant(cs.date, cs.timeIn) : mauritiusToInstant(cs.date, "10:00"),
        timeOut: cs.service.service_type === "scheduled" ? mauritiusToInstant(cs.date, cs.timeOut) : mauritiusToInstant(cs.date, "11:00"),
        numPerson: cs.numPerson,
        amount: cs.price,
      }));

      const tripPayload = Object.values(cartTrips).map((ct) => ({
        tripId: ct.trip.trip_id,
        numAdult: ct.numAdult,
        numChild: ct.numChild,
        amount: ct.price,
      }));

      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutType: "addon",
          bookingId,
          totalAmount: grandTotal,
          guestEmail: booking.customer?.email || user?.primaryEmailAddress?.emailAddress,
          serviceBookings: servicePayload,
          tripBookings: tripPayload,
          addonDescription: `${servicePayload.length} service(s), ${tripPayload.length} excursion(s) for Booking #${bookingId}`,
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.sessionId) {
        router.push(`/customer/bookings/${bookingId}?addon_success=true`);
      } else {
        throw new Error(data.error || "Failed to initiate add-on checkout session.");
      }
    } catch (err: any) {
      console.error("Add-on checkout error:", err);
      setErrorMsg(err.message || "Failed to proceed to payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" className="text-slate-600 hover:text-[#1A202C] gap-1">
          <Link href={`/customer/bookings/${bookingId}`}>
            <ChevronLeft className="h-4 w-4" /> Back to Booking #{bookingId}
          </Link>
        </Button>
        <Badge className="bg-[#A37836] text-white">
          Stay Window: {formatDate(checkInDateOnly)} to {formatDate(checkOutDateOnly)}
        </Badge>
      </div>

      {/* Main Banner */}
      <div className="bg-white p-8 rounded-3xl border border-[#E5E2DC] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A202C]">Add-on Services & Excursions</h1>
          <p className="text-slate-500 text-sm mt-1">
            Customize your stay for Room #{stay.room_room_id} ({stay.room?.room_type?.type}).
          </p>
        </div>
        <div className="text-xs bg-[#F8F7F4] p-3 rounded-2xl border border-[#E5E2DC] text-slate-700">
          <span>Booking Stay Party: <strong>{booking.num_adults || 1} Adult(s)</strong>, <strong>{booking.num_children || 0} Child(ren)</strong></span>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-2 text-sm font-semibold">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Services and Excursions Catalog */}
        <div className="lg:col-span-2 space-y-8">
          {/* SECTION 1: Hotel Services */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ConciergeBell className="h-5 w-5 text-[#A37836]" />
              <h2 className="text-lg font-bold text-[#1A202C]">Hotel Services & Spa</h2>
            </div>

            <div className="space-y-4">
              {services.map((s) => {
                const isSelected = Boolean(cartServices[s.service_id]);
                const item = cartServices[s.service_id];
                const isScheduled = s.service_type === "scheduled";

                return (
                  <div
                    key={s.service_id}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                      isSelected ? "border-[#A37836] bg-[#F4EFE6]/40" : "border-[#E5E2DC] bg-[#FAF8F5]"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="h-16 w-20 sm:h-20 sm:w-28 shrink-0 rounded-xl overflow-hidden bg-slate-200 border border-slate-200/80">
                          <img
                            src={getImageUrl(s.image_path, "service")}
                            alt={s.service_name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-[#1A202C]">{s.service_name}</h3>
                            <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                              {isScheduled ? "Timed Slot" : "On Demand"}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{s.service_desc || "Premium resort amenity."}</p>
                          {isScheduled && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3 text-[#A37836]" />
                              <span>{s.duration_min || 60} minutes • Hours: {s.daily_open_time ? s.daily_open_time.substring(0, 5) : "09:00"} to {s.daily_close_time ? s.daily_close_time.substring(0, 5) : "18:00"}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 w-full sm:w-auto">
                        <span className="font-bold text-base text-[#A37836]">{formatCurrency(s.price)}</span>
                        <Button
                          type="button"
                          variant={isSelected ? "gold" : "outline"}
                          size="sm"
                          onClick={() => handleToggleService(s)}
                          className="rounded-xl font-semibold shrink-0"
                        >
                          {isSelected ? "Selected ✓" : "Select"}
                        </Button>
                      </div>
                    </div>

                    {/* Service Slot Scheduling Configuration */}
                    {isSelected && item && (
                      <div className="mt-4 pt-4 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3.5 rounded-xl border border-slate-100">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-slate-700">Date within stay *</Label>
                          <Input
                            type="date"
                            min={checkInDateOnly}
                            max={checkOutDateOnly}
                            value={item.date}
                            onChange={(e) => handleUpdateServiceField(s.service_id, "date", e.target.value)}
                            className="bg-[#F8F7F4] text-xs h-9"
                          />
                        </div>

                        {isScheduled && (
                          <div className="space-y-1">
                            <Label className="text-[11px] font-bold text-slate-700">Start Time (ends at {item.timeOut}) *</Label>
                            <Input
                              type="time"
                              value={item.timeIn}
                              onChange={(e) => handleUpdateServiceField(s.service_id, "timeIn", e.target.value)}
                              className="bg-[#F8F7F4] text-xs h-9"
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-slate-700">Persons (Max {maxStayParty}) *</Label>
                          <Input
                            type="number"
                            min="1"
                            max={maxStayParty}
                            value={item.numPerson}
                            onChange={(e) => handleUpdateServiceField(s.service_id, "numPerson", e.target.value)}
                            className="bg-[#F8F7F4] text-xs h-9"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Island Tours & Scheduled Departures (Trip Model) */}
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Compass className="h-5 w-5 text-[#A37836]" />
              <h2 className="text-lg font-bold text-[#1A202C]">Excursion Tours & Departures</h2>
            </div>
            <p className="text-xs text-slate-500">
              Browse resort tours and select from scheduled departures during your stay.
            </p>

            <div className="space-y-6">
              {tours.map((tour) => {
                // Filter trips belonging to this tour that are pending, in the future, and inside stay window
                const tourDepartures = trips.filter((tr) => {
                  if (tr.tour_tour_id !== tour.tour_id) return false;
                  const isScheduledStatus = tr.trip_status === "Pending" || tr.trip_status === "Scheduled";
                  if (!isScheduledStatus) return false;
                  if (isPast(tr.start_time)) return false;
                  return isWithinStayWindow(tr.start_time, checkInDateOnly, checkOutDateOnly);
                });

                return (
                  <div key={tour.tour_id} className="bg-[#FAF8F5] border border-[#E5E2DC] p-5 rounded-2xl space-y-4">
                    {/* Tour Catalog Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-3">
                      <div className="flex items-start gap-4">
                        <div className="h-20 w-24 sm:h-20 sm:w-28 shrink-0 rounded-xl overflow-hidden bg-slate-200 border border-slate-200/80">
                          <img
                            src={getImageUrl(tour.image_path, "tour")}
                            alt={tour.tour_name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base text-[#1A202C]">{tour.tour_name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">{tour.tour_desc}</p>
                          <div className="text-[11px] text-slate-500 mt-1">
                            Duration: {tour.durations} hours • Standard Rate: {formatCurrency(tour.adult_price)} / adult, {formatCurrency(tour.child_price)} / child
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-[#A37836] text-white shrink-0 self-start sm:self-auto text-xs">
                        {tourDepartures.length} departure(s) during your stay
                      </Badge>
                    </div>

                    {/* Scheduled Departures for this Tour */}
                    {tourDepartures.length === 0 ? (
                      <div className="p-4 bg-white rounded-xl border border-dashed border-slate-200 text-center">
                        <p className="text-xs text-slate-400 font-medium">No departures during your stay</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tourDepartures.map((tr) => {
                          const isSelected = Boolean(cartTrips[tr.trip_id]);
                          const item = cartTrips[tr.trip_id];
                          const remSeats = tripRemainingSeats[tr.trip_id] ?? 20;
                          const alreadyBooked = existingTripBookings.some(
                            (t) => t.trip_trip_id === tr.trip_id && t.tb_status !== "Cancelled"
                          );

                          return (
                            <div
                              key={tr.trip_id}
                              className={`p-3.5 rounded-xl border transition-all ${
                                alreadyBooked
                                  ? "border-slate-200 bg-slate-50 opacity-70"
                                  : isSelected
                                  ? "border-[#A37836] bg-[#F4EFE6]"
                                  : "border-slate-200 bg-white"
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-[#1A202C]">
                                      Departure: {formatDate(tr.trip_date)}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] font-semibold text-slate-600">
                                      {formatMauritius(tr.start_time, "time")} to {formatMauritius(tr.return_time, "time")}
                                    </Badge>
                                    <Badge
                                      className={`text-[10px] ${
                                        remSeats <= 3 ? "bg-amber-600 text-white" : "bg-emerald-600 text-white"
                                      }`}
                                    >
                                      {remSeats > 0 ? `${remSeats} seats remaining` : "Sold Out"}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {alreadyBooked ? (
                                    <Badge className="bg-slate-200 text-slate-600 text-[11px]">
                                      Already Reserved on this Stay
                                    </Badge>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant={isSelected ? "gold" : "outline"}
                                      size="sm"
                                      disabled={remSeats <= 0}
                                      onClick={() => handleToggleTrip(tr, tour)}
                                      className="rounded-xl font-semibold text-xs h-8"
                                    >
                                      {isSelected ? "Selected ✓" : "Book Departure"}
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* Independent Participants Configuration */}
                              {isSelected && item && (
                                <div className="mt-3 pt-3 border-t border-slate-200 bg-[#FAF8F5] p-3 rounded-xl space-y-2">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-700">Select Excursion Travelers</span>
                                    <span className="font-extrabold text-[#A37836] text-xs">
                                      Total: {formatCurrency(item.price)}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label className="text-[11px] font-bold">Adults (Age 12+)</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        max={remSeats}
                                        value={item.numAdult}
                                        onChange={(e) =>
                                          handleUpdateTripGuests(tr.trip_id, Number(e.target.value), item.numChild)
                                        }
                                        className="bg-white text-xs h-8 mt-1"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-[11px] font-bold">Children (under 12)</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        max={remSeats}
                                        value={item.numChild}
                                        onChange={(e) =>
                                          handleUpdateTripGuests(tr.trip_id, item.numAdult, Number(e.target.value))
                                        }
                                        className="bg-white text-xs h-8 mt-1"
                                      />
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-slate-500">
                                    Child means under 12. Participant counts are capped only by remaining seat capacity ({remSeats}).
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Stripe Checkout */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-[#E5E2DC] shadow-md sticky top-6 space-y-5">
            <h3 className="font-extrabold text-base text-[#1A202C] border-b border-slate-100 pb-3">
              Add-ons Order Summary
            </h3>

            {totalItemsCount === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">
                No services or tours selected yet. Select items from the list to add to your reservation.
              </p>
            ) : (
              <div className="space-y-3 text-xs">
                {/* Services itemized */}
                {Object.values(cartServices).map((cs) => (
                  <div key={cs.service.service_id} className="flex justify-between items-start border-b border-slate-100 pb-2">
                    <div>
                      <span className="font-bold text-slate-800 block">{cs.service.service_name}</span>
                      <span className="text-slate-400 text-[11px]">
                        {formatDate(cs.date)} {cs.service.service_type === "scheduled" ? `(${cs.timeIn})` : "(Flexible)"} • {cs.numPerson} person(s)
                      </span>
                    </div>
                    <span className="font-bold text-slate-900">{formatCurrency(cs.price)}</span>
                  </div>
                ))}

                {/* Excursions itemized */}
                {Object.values(cartTrips).map((ct) => (
                  <div key={ct.trip.trip_id} className="flex justify-between items-start border-b border-slate-100 pb-2">
                    <div>
                      <span className="font-bold text-slate-800 block">{ct.tour.tour_name}</span>
                      <span className="text-slate-400 text-[11px]">
                        {ct.numAdult} adult(s), {ct.numChild} child(ren) • {formatDate(ct.trip.trip_date)}
                      </span>
                    </div>
                    <span className="font-bold text-slate-900">{formatCurrency(ct.price)}</span>
                  </div>
                ))}

                {/* Totals */}
                <div className="pt-2 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>VAT (15% Mauritius):</span>
                    <span>{formatCurrency(vatAmount)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-[#A37836] pt-2 border-t border-slate-200">
                    <span>Total Due:</span>
                    <span>{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="button"
              variant="gold"
              disabled={totalItemsCount === 0 || isSubmitting}
              onClick={handleCheckoutAddons}
              className="w-full rounded-xl py-6 font-bold shadow-md gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting to Stripe...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  Proceed to Secure Checkout
                </>
              )}
            </Button>
            <p className="text-[11px] text-slate-400 text-center">
              Separate add-on payment receipt issued immediately upon confirmation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
