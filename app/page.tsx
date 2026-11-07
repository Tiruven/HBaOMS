// app/page.tsx
"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Room, Service, Tour, RoomType, Feature, PricingRule } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { getImageUrl } from "@/lib/imageUtils";
import { mauritiusToday } from "@/lib/time";
import { isRoomAvailableForDates, getEffectiveRoomPrice, OccupiedStay } from "@/lib/searchUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Hotel,
  BedDouble,
  ConciergeBell,
  Compass,
  Calendar,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Clock,
  Waves,
  Shield,
  ArrowRight,
  ChevronDown,
  Maximize2,
  Users,
  Sparkles,
  Search,
  SlidersHorizontal,
  RefreshCw,
} from "lucide-react";

// ============================================================
// Intersection Observer hook for scroll animations
// ============================================================
function useScrollAnimation(dependencyCount: number) {
  useEffect(() => {
    const targets = document.querySelectorAll(
      ".anim-fade-up, .anim-fade-left, .anim-fade-right"
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("anim-visible");
          }
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [dependencyCount]);
}

// ============================================================
// Navbar - transparent then dark on scroll
// ============================================================
function Navbar({ isSignedIn }: { isSignedIn: boolean | undefined }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#1A202C]/95 backdrop-blur-md shadow-xl"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-[#A37836] text-white shadow-md">
            <Hotel className="h-5 w-5" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight text-white block leading-none">
              Le Paradis Royal
            </span>
            <span className="text-[9px] text-[#A37836] font-semibold uppercase tracking-widest">
              Hotel &amp; Ocean Spa &bull; Mauritius
            </span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-white/80">
          <a href="#search" className="hover:text-[#A37836] transition-colors">
            Find Rooms
          </a>
          <a href="#rooms" className="hover:text-[#A37836] transition-colors">
            Accommodations
          </a>
          <a href="#services" className="hover:text-[#A37836] transition-colors">
            Spa &amp; Services
          </a>
          <a href="#tours" className="hover:text-[#A37836] transition-colors">
            Island Tours
          </a>
          <a href="#footer" className="hover:text-[#A37836] transition-colors">
            Contact
          </a>
        </nav>

        {/* CTA */}
        <div className="flex items-center space-x-3">
          {isSignedIn ? (
            <Button
              asChild
              className="bg-[#A37836] hover:bg-[#8B6327] text-white shadow-md gap-2 rounded-xl"
            >
              <Link href="/customer/dashboard">
                <Calendar className="h-4 w-4" /> Guest Portal
              </Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button
                asChild
                className="bg-[#A37836] hover:bg-[#8B6327] text-white shadow-md gap-2 rounded-xl"
              >
                <Link href="/sign-up">Book Your Stay</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ============================================================
// Sticky Booking Bar (bottom of screen)
// ============================================================
function BookingBar({ isSignedIn }: { isSignedIn: boolean | undefined }) {
  return (
    <div className="booking-bar fixed bottom-0 left-0 right-0 z-40 bg-[#1A202C]/95 backdrop-blur-md border-t border-[#A37836]/30 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-[#A37836]" />
          <span className="text-white/80 text-sm font-medium hidden sm:block">
            Ready to begin your tropical escape?
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#A37836] text-xs font-semibold uppercase tracking-wider hidden md:block">
            Luxury Awaits You
          </span>
          <Button
            asChild
            className="bg-[#A37836] hover:bg-[#8B6327] text-white rounded-xl gap-2 font-semibold shadow-lg"
          >
            <Link href={isSignedIn ? "/customer/rooms" : "/sign-up"}>
              Book Your Stay <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [occupiedStays, setOccupiedStays] = useState<OccupiedStay[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [counts, setCounts] = useState({ rooms: 0, types: 0, services: 0, tours: 0 });
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Filter State on Landing Page
  const todayStr = useMemo(() => mauritiusToday(), []);
  const [checkInDate, setCheckInDate] = useState<string>("");
  const [checkOutDate, setCheckOutDate] = useState<string>("");
  const [adults, setAdults] = useState<number>(1);
  const [children, setChildren] = useState<number>(0);
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedFeature, setSelectedFeature] = useState<string>("ALL");
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  useEffect(() => {
    async function fetchShowcase() {
      setLoading(true);
      try {
        const [rRes, rtRes, fRes, prRes, staysRes, sRes, tRes, c1, c2, c3, c4] = await Promise.all([
          supabase
            .from("room")
            .select("*, room_type(*), room_feature(feature_feature_id, feature(*))")
            .neq("room_status", "Maintenance")
            .order("room_id", { ascending: true }),
          supabase.from("room_type").select("*"),
          supabase.from("feature").select("*").order("room_features", { ascending: true }),
          supabase.from("pricing_rule").select("*"),
          supabase
            .from("check_in_out")
            .select("room_room_id, check_in_date, check_out_date, booking!inner(booking_status)")
            .neq("booking.booking_status", "Cancelled")
            .gte("check_out_date", todayStr),
          supabase.from("service").select("*").limit(3),
          supabase.from("tour").select("*").limit(3),
          supabase.from("room").select("*", { count: "exact", head: true }),
          supabase.from("room_type").select("*", { count: "exact", head: true }),
          supabase.from("service").select("*", { count: "exact", head: true }),
          supabase.from("tour").select("*", { count: "exact", head: true }),
        ]);

        if (rRes.data) setRooms(rRes.data);
        if (rtRes.data) setRoomTypes(rtRes.data);
        if (fRes.data) setFeatures(fRes.data);
        if (prRes.data) setPricingRules(prRes.data);
        if (staysRes.data) {
          setOccupiedStays(
            staysRes.data.map((s) => ({
              room_id: s.room_room_id,
              check_in_date: s.check_in_date,
              check_out_date: s.check_out_date,
            }))
          );
        }
        if (sRes.data) setServices(sRes.data);
        if (tRes.data) setTours(tRes.data);
        setCounts({
          rooms: c1.count ?? (rRes.data?.length || 0),
          types: c2.count ?? (rtRes.data?.length || 0),
          services: c3.count ?? (sRes.data?.length || 0),
          tours: c4.count ?? (tRes.data?.length || 0),
        });
      } catch (err) {
        console.error("Landing page fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchShowcase();
  }, [todayStr]);

  // Activate scroll animations whenever rooms change
  useScrollAnimation(rooms.length);

  // Dynamic Room Filtering on Landing Page
  const filteredRooms = useMemo(() => {
    // Determine if any active filter is applied
    const hasFilter =
      Boolean(checkInDate && checkOutDate) ||
      adults > 1 ||
      children > 0 ||
      selectedType !== "ALL" ||
      selectedFeature !== "ALL" ||
      Boolean(searchKeyword.trim());

    const result = rooms.filter((r) => {
      // 1. Availability check if stay dates are selected
      if (checkInDate && checkOutDate) {
        const isAvail = isRoomAvailableForDates(r.room_id, checkInDate, checkOutDate, occupiedStays);
        if (!isAvail) return false;
      }

      // 2. Guest capacity
      const maxAdults = r.room_type?.max_adults ?? 2;
      const maxChildren = r.room_type?.max_children ?? 2;
      if (adults > 1 && adults > maxAdults) return false;
      if (children > 0 && children > maxChildren) return false;

      // 3. Category
      const typeName = r.room_type?.type || "";
      if (selectedType !== "ALL" && typeName !== selectedType) return false;

      // 4. Feature
      if (selectedFeature !== "ALL") {
        const featureId = Number(selectedFeature);
        const roomFeatureIds = (r.room_feature || []).map(
          (rf: any) => rf.feature_feature_id || rf.feature?.feature_id
        );
        if (!roomFeatureIds.includes(featureId)) return false;
      }

      // 5. Keyword search
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const desc = (r.room_desc || "").toLowerCase();
        const matchesType = typeName.toLowerCase().includes(q);
        const matchesId = String(r.room_id).includes(q);
        const matchesDesc = desc.includes(q);
        if (!matchesType && !matchesId && !matchesDesc) return false;
      }

      return true;
    });

    // If no filter is applied, sort to show recommended rooms (rooms with photos first)
    if (!hasFilter) {
      const hasPhoto = (r: Room) => Boolean(r.image_path || r.room_type?.image_path);
      return [...result].sort((a, b) => Number(hasPhoto(b)) - Number(hasPhoto(a)));
    }

    return result;
  }, [
    rooms,
    checkInDate,
    checkOutDate,
    occupiedStays,
    adults,
    children,
    selectedType,
    selectedFeature,
    searchKeyword,
  ]);

  // Construct target link for room cards:
  // If user is not signed in -> redirect to /sign-up
  // If signed in -> navigate to /customer/booking/new with pre-selected room and dates
  const getRoomBookingHref = (room: Room) => {
    if (!isSignedIn) {
      return "/sign-up";
    }
    const params = new URLSearchParams({
      roomId: String(room.room_id),
      ...(checkInDate && { checkIn: checkInDate }),
      ...(checkOutDate && { checkOut: checkOutDate }),
      ...(adults > 1 && { adults: String(adults) }),
      ...(children > 0 && { children: String(children) }),
    });
    return `/customer/booking/new?${params.toString()}`;
  };

  const handleResetFilters = () => {
    setCheckInDate("");
    setCheckOutDate("");
    setAdults(1);
    setChildren(0);
    setSelectedType("ALL");
    setSelectedFeature("ALL");
    setSearchKeyword("");
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1A202C] font-sans antialiased">
      {/* Fixed Navbar */}
      <Navbar isSignedIn={isSignedIn} />

      {/* ======================================================= */}
      {/* HERO - Video Background                                  */}
      {/* ======================================================= */}
      <section
        id="hero"
        className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#1A202C]"
      >
        {/* Video background - autoplay muted loop */}
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-55"
          poster="https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1920&q=80"
        >
          {/* Free Pexels ocean/resort video - royalty free */}
          <source
            src="https://videos.pexels.com/video-files/1739010/1739010-hd_1920_1080_30fps.mp4"
            type="video/mp4"
          />
        </video>

        {/* Cinematic overlay gradient */}
        <div className="video-overlay absolute inset-0" />

        {/* Gold decorative top border */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#A37836] to-transparent" />

        {/* Hero Content */}
        <div className="relative max-w-5xl mx-auto px-4 text-center text-white py-32">
          {/* Eyebrow label */}
          <p className="hero-subtitle text-[#A37836] text-xs font-semibold uppercase tracking-[0.3em] mb-6">
            Grand Baie, Mauritius
          </p>

          {/* Main headline */}
          <h1 className="hero-title section-heading text-5xl sm:text-7xl font-bold leading-[1.08] mb-6">
            An Unrivalled Haven of{" "}
            <em className="text-[#C9995A] not-italic">Serenity</em>
            <br />
            &amp; Tropical Luxury
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle text-lg sm:text-xl text-white/70 font-light max-w-2xl mx-auto leading-relaxed mb-10">
            Immerse yourself in crystal waters, private beach villas,
            world-class dining, and tailored island excursions.
          </p>

          {/* CTA Buttons */}
          <div className="hero-cta flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-[#A37836] hover:bg-[#8B6327] text-white px-10 py-6 text-base rounded-2xl shadow-2xl font-semibold gap-2 border border-[#A37836]/30"
            >
              <Link href={isSignedIn ? "/customer/rooms" : "/sign-up"}>
                Explore Accommodations <ChevronRight className="h-5 w-5" />
              </Link>
            </Button>
            <a
              href="#search"
              className="inline-flex items-center gap-2 px-10 py-4 text-base font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/40 rounded-2xl backdrop-blur-sm transition-all duration-300"
            >
              Find Available Rooms <ChevronDown className="h-5 w-5" />
            </a>
          </div>

          {/* Trust badges */}
          <div className="hero-cta mt-14 flex flex-wrap justify-center gap-6 text-white/50 text-xs font-medium uppercase tracking-widest">
            {["Private Beach", "Ocean Spa", "Fine Dining"].map((badge) => (
              <span key={badge} className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-[#A37836]" />
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40">
          <span className="text-[10px] uppercase tracking-widest">Scroll</span>
          <div className="w-px h-10 bg-gradient-to-b from-white/40 to-transparent animate-pulse" />
        </div>
      </section>

      {/* ======================================================= */}
      {/* INTRO STRIP - Database Counts                            */}
      {/* ======================================================= */}
      <section className="bg-[#1A202C] border-t border-[#A37836]/20">
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: "Rooms & Suites", value: String(counts.rooms) },
            { label: "Room Types", value: String(counts.types) },
            { label: "Resort Services", value: String(counts.services) },
            { label: "Island Tours", value: String(counts.tours) },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`anim-fade-up anim-delay-${(i + 1) * 100}`}
            >
              <div className="text-3xl font-bold text-[#A37836]">
                {stat.value}
              </div>
              <div className="text-white/50 text-xs uppercase tracking-widest mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ======================================================= */}
      {/* LIVE ACCOMMODATIONS SEARCH & FILTER WIDGET               */}
      {/* Clean vertical flow: no overlapping negative margins     */}
      {/* ======================================================= */}
      <section id="search" className="max-w-7xl mx-auto px-4 pt-12 pb-6 relative z-10">
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold text-[#A37836] uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="h-4 w-4" /> Live Accommodation Finder
              </span>
              <h2 className="text-2xl font-extrabold text-[#1A202C] mt-1">
                Find Your Perfect Island Suite
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium">
                {filteredRooms.length} of {rooms.length} rooms available
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs border-[#E5E2DC] text-slate-600 hover:bg-[#F4EFE6] gap-1 h-8 rounded-xl"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>
          </div>

          {/* Search Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            {/* Check-In */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#A37836]" /> Check-In
              </Label>
              <Input
                type="date"
                value={checkInDate}
                min={todayStr}
                onChange={(e) => setCheckInDate(e.target.value)}
                className="bg-[#F8F7F4] border-[#E5E2DC] text-xs font-medium"
              />
            </div>

            {/* Check-Out */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#A37836]" /> Check-Out
              </Label>
              <Input
                type="date"
                value={checkOutDate}
                min={checkInDate || todayStr}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="bg-[#F8F7F4] border-[#E5E2DC] text-xs font-medium"
              />
            </div>

            {/* Adults */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[#A37836]" /> Adults
              </Label>
              <Select value={String(adults)} onValueChange={(val) => setAdults(Number(val))}>
                <SelectTrigger className="bg-[#F8F7F4] border-[#E5E2DC] text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} Adult{n > 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Room Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <BedDouble className="h-3.5 w-3.5 text-[#A37836]" /> Category
              </Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="bg-[#F8F7F4] border-[#E5E2DC] text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  {roomTypes.map((rt) => (
                    <SelectItem key={rt.room_type_id} value={rt.type}>
                      {rt.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Room Feature */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#A37836]" /> Amenity
              </Label>
              <Select value={selectedFeature} onValueChange={setSelectedFeature}>
                <SelectTrigger className="bg-[#F8F7F4] border-[#E5E2DC] text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Any Amenity</SelectItem>
                  {features.map((f) => (
                    <SelectItem key={f.feature_id} value={String(f.feature_id)}>
                      {f.room_features}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Keyword Search */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-[#A37836]" /> Keyword
              </Label>
              <Input
                placeholder="Suite, villa..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="bg-[#F8F7F4] border-[#E5E2DC] text-xs"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================= */}
      {/* ACCOMMODATIONS SHOWCASE (DYNAMICALLY FILTERED)          */}
      {/* ======================================================= */}
      <section id="rooms" className="max-w-7xl mx-auto px-4 pt-6 pb-20 space-y-12">
        {/* Section header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <span className="text-[#A37836] text-xs font-semibold uppercase tracking-[0.3em]">
            Handcrafted Suites &amp; Villas
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-[#1A202C]">
            Accommodations Suited
            <br />
            <em className="text-[#A37836]">for Royalty</em>
          </h2>
          <div className="gold-divider" />
          <p className="text-slate-500 text-sm leading-relaxed">
            Every suite is designed with natural elegance, ocean panoramas, and total privacy.
            Select any room to reserve your stay.
          </p>
        </div>

        {/* Room cards */}
        {loading ? (
          <SkeletonCard count={3} />
        ) : filteredRooms.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#E5E2DC] p-12 text-center space-y-3 shadow-sm">
            <BedDouble className="h-10 w-10 text-[#A37836] mx-auto" />
            <h3 className="text-lg font-bold text-[#1A202C]">No Accommodations Match Your Criteria</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try adjusting your date range or filter settings above to explore other luxury suites.
            </p>
            <Button
              onClick={handleResetFilters}
              variant="outline"
              className="text-xs border-[#A37836] text-[#A37836] hover:bg-[#F4EFE6]"
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {filteredRooms.slice(0, 6).map((room) => {
              const type = room.room_type?.type || "Deluxe Suite";
              const { effectivePrice, activeRule } = getEffectiveRoomPrice(
                room,
                checkInDate,
                checkOutDate,
                pricingRules
              );
              const imgSrc = getImageUrl(room.image_path || room.room_type?.image_path, "room");
              const targetHref = getRoomBookingHref(room);

              return (
                <div
                  key={room.room_id}
                  className="card-lift bg-white rounded-2xl border border-[#E5E2DC] overflow-hidden shadow-sm flex flex-col justify-between"
                >
                  <div>
                    {/* Photo */}
                    <div className="img-zoom-wrap h-56 bg-slate-100 overflow-hidden relative">
                      <img
                        src={imgSrc}
                        alt={type}
                        className="img-zoom w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute top-3 left-3 bg-[#1A202C]/80 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Room #{room.room_id}
                      </div>
                      <Badge className="absolute top-3 right-3 bg-[#A37836] text-white border-0 font-medium">
                        {type}
                      </Badge>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                      <div>
                        <h3 className="font-bold text-xl text-[#1A202C]">
                          {type}
                        </h3>
                        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mt-1">
                          {room.room_desc || "Comfortable luxury accommodation at Le Paradis Royal."}
                        </p>
                      </div>

                      {/* Specs */}
                      <div className="flex items-center gap-4 text-xs text-slate-600 border-y border-slate-100 py-2.5">
                        <span className="flex items-center gap-1">
                          <Maximize2 className="h-3.5 w-3.5 text-[#A37836]" /> {room.room_type?.size ?? "-"} m²
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-[#A37836]" /> Max {(room.room_type?.max_adults ?? 0) + (room.room_type?.max_children ?? 0)} Guests
                        </span>
                      </div>

                      {/* Features preview */}
                      {room.room_feature && room.room_feature.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {room.room_feature.slice(0, 3).map((rf: any, fIdx: number) => (
                            <span
                              key={fIdx}
                              className="text-[10px] bg-[#F4EFE6] text-[#8B6327] font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
                            >
                              <Sparkles className="h-2.5 w-2.5" /> {rf.feature?.room_features}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price + CTA */}
                  <div className="p-6 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-1.5">
                        <span className="text-lg sm:text-xl font-extrabold text-[#1A202C] tracking-tight whitespace-nowrap">
                          {formatCurrency(effectivePrice)}
                        </span>
                        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">/ night</span>
                      </div>
                      {activeRule && (
                        <span className="text-[10px] text-amber-700 font-medium block">
                          {activeRule.reason}
                        </span>
                      )}
                    </div>
                    <Button
                      asChild
                      size="sm"
                      className="shrink-0 bg-[#A37836] hover:bg-[#8B6327] text-white rounded-xl gap-1 text-xs px-3.5 py-2 font-semibold"
                    >
                      <Link href={targetHref}>
                        Select Room <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View all link */}
        <div className="text-center mt-12">
          <Link
            href={isSignedIn ? "/customer/rooms" : "/sign-up"}
            className="inline-flex items-center gap-2 text-[#A37836] font-semibold text-sm hover:gap-3 transition-all duration-300 border-b border-[#A37836]/40 pb-0.5"
          >
            Explore Full Accommodations Catalogue <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ======================================================= */}
      {/* SPA & SERVICES                                           */}
      {/* ======================================================= */}
      <section id="services" className="bg-[#F8F7F4] py-24 border-t border-[#E5E2DC]">
        <div className="max-w-7xl mx-auto px-4">
          {/* Header */}
          <div className="text-center space-y-4 max-w-2xl mx-auto mb-16 anim-fade-up">
            <span className="text-[#A37836] text-xs font-semibold uppercase tracking-[0.3em]">
              Resort Amenities &amp; Dining
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-[#1A202C]">
              Bespoke Services &amp;
              <br />
              <em className="text-[#A37836]">Holistic Wellness</em>
            </h2>
            <div className="gold-divider" />
            <p className="text-slate-500 text-sm">
              Elevate your stay with signature massages, beachside dining, and luxury concierge assistance.
            </p>
          </div>

          {/* Service cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {services.map((srv, i) => {
              const imgSrc = getImageUrl(srv.image_path, "service");
              return (
                <div
                  key={srv.service_id}
                  className={`card-lift group bg-white rounded-2xl border border-[#E5E2DC] overflow-hidden shadow-sm flex flex-col anim-fade-up anim-delay-${(i + 1) * 100}`}
                >
                  <div className="img-zoom-wrap h-48 overflow-hidden bg-slate-100 relative">
                    <img
                      src={imgSrc}
                      alt={srv.service_name}
                      className="img-zoom w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-4 left-4 p-2 rounded-lg bg-[#A37836]/90 text-white">
                      <ConciergeBell className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="p-6 flex flex-col flex-1 space-y-3">
                    <h3 className="font-bold text-lg text-[#1A202C]">
                      {srv.service_name}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed flex-1">
                      {srv.service_desc || "Indulge in premium service experiences tailored for resort guests."}
                    </p>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xl font-extrabold text-[#1A202C]">
                        {formatCurrency(srv.price)}
                      </span>
                      <span className="text-xs text-[#A37836] font-semibold uppercase tracking-wide">
                        Per Session
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ======================================================= */}
      {/* WHY CHOOSE US - Feature Strip                            */}
      {/* ======================================================= */}
      <section className="bg-[#1A202C] py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14 anim-fade-up">
            <span className="text-[#A37836] text-xs font-semibold uppercase tracking-[0.3em]">
              The Difference
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">
              Why Guests Return Every Year
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                icon: Waves,
                title: "Private Lagoon",
                desc: "Direct access to a sheltered private lagoon with crystal-clear waters.",
              },
              {
                icon: Sparkles,
                title: "Gourmet Dining",
                desc: "Award-winning restaurants with locally sourced Mauritian cuisine.",
              },
              {
                icon: Shield,
                title: "Total Privacy",
                desc: "Secluded villas and suites for an intimate, interruption-free retreat.",
              },
              {
                icon: Clock,
                title: "24/7 Concierge",
                desc: "Round-the-clock personalized service for every need and request.",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div
                key={title}
                className={`text-center space-y-4 p-6 rounded-2xl border border-white/10 hover:border-[#A37836]/40 transition-colors anim-fade-up anim-delay-${(i + 1) * 100}`}
              >
                <div className="inline-flex p-4 rounded-2xl bg-[#A37836]/15 text-[#A37836]">
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="font-bold text-white text-lg">{title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================= */}
      {/* ISLAND TOURS                                             */}
      {/* ======================================================= */}
      <section id="tours" className="bg-white py-24 border-t border-[#E5E2DC]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center space-y-4 max-w-2xl mx-auto mb-16 anim-fade-up">
            <span className="text-[#A37836] text-xs font-semibold uppercase tracking-[0.3em]">
              Mauritian Island Excursions
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-[#1A202C]">
              Discover the Wonders
              <br />
              <em className="text-[#A37836]">of Mauritius</em>
            </h2>
            <div className="gold-divider" />
            <p className="text-slate-500 text-sm">
              Guided catamaran cruises, dolphin snorkeling, and inland botanical explorations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {tours.map((t, i) => {
              const imgSrc = getImageUrl(t.image_path, "tour");
              return (
                <div
                  key={t.tour_id}
                  className={`card-lift group bg-[#F8F7F4] rounded-2xl border border-[#E5E2DC] overflow-hidden shadow-sm anim-fade-up anim-delay-${(i + 1) * 100}`}
                >
                  <div className="img-zoom-wrap h-52 overflow-hidden bg-slate-100 relative">
                    <img
                      src={imgSrc}
                      alt={t.tour_name}
                      className="img-zoom w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-white/20 backdrop-blur text-white border border-white/30 font-semibold">
                        <Clock className="h-3 w-3 mr-1" />
                        {t.durations}h
                      </Badge>
                    </div>
                    <div className="absolute bottom-4 left-4 p-2 rounded-lg bg-[#A37836]/90 text-white">
                      <Compass className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="p-6 space-y-3">
                    <h3 className="font-bold text-xl text-[#1A202C]">
                      {t.tour_name}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
                      {t.tour_desc}
                    </p>
                    <div className="pt-3 border-t border-[#E5E2DC] flex items-center justify-between text-sm">
                      <div className="space-y-0.5">
                        <div className="text-xs text-slate-400 uppercase tracking-wide">Adult</div>
                        <div className="font-extrabold text-[#1A202C]">
                          {formatCurrency(t.adult_price)}
                        </div>
                      </div>
                      <div className="w-px h-8 bg-[#E5E2DC]" />
                      <div className="space-y-0.5 text-right">
                        <div className="text-xs text-slate-400 uppercase tracking-wide">Child</div>
                        <div className="font-extrabold text-[#1A202C]">
                          {formatCurrency(t.child_price)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ======================================================= */}
      {/* FOOTER                                                   */}
      {/* ======================================================= */}
      <footer
        id="footer"
        className="bg-[#1A202C] text-white pt-20 pb-28 border-t border-slate-800"
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 pb-12 border-b border-white/10">
            {/* Brand */}
            <div className="space-y-5 md:col-span-1">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-[#A37836] text-white">
                  <Hotel className="h-5 w-5" />
                </div>
                <span className="font-bold text-xl text-white">
                  Le Paradis Royal
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Grand Baie Coastal Road, Mauritius. A luxury beach sanctuary offering unrivaled hospitality.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold text-sm text-[#A37836] uppercase tracking-wider mb-5">
                Quick Links
              </h4>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>
                  <Link href="/customer/rooms" className="hover:text-white transition-colors">
                    Browse Rooms
                  </Link>
                </li>
                <li>
                  <Link href="/sign-in" className="hover:text-white transition-colors">
                    Customer Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/sign-up" className="hover:text-white transition-colors">
                    Create Account
                  </Link>
                </li>
                <li>
                  <Link href="/admin/dashboard" className="hover:text-white transition-colors">
                    Admin Portal
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold text-sm text-[#A37836] uppercase tracking-wider mb-5">
                Resort Contact
              </h4>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-[#A37836] mt-0.5 shrink-0" />
                  Grand Baie Coastal Road, Mauritius
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-[#A37836] shrink-0" />
                  +230 200 8888
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-[#A37836] shrink-0" />
                  concierge@leparadisroyal.mu
                </li>
              </ul>
            </div>

            {/* Reservations CTA */}
            <div>
              <h4 className="font-bold text-sm text-[#A37836] uppercase tracking-wider mb-5">
                Reservations
              </h4>
              <p className="text-sm text-slate-400 mb-5 leading-relaxed">
                Ready for your tropical escape? Reserve your suite now and begin your journey.
              </p>
              <Button
                asChild
                className="w-full bg-[#A37836] hover:bg-[#8B6327] text-white rounded-xl font-semibold gap-2"
              >
                <Link href="/sign-up">
                  Book Now <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Bottom row */}
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>
              &copy; {new Date().getFullYear()} Le Paradis Royal Hotel &amp;
              Ocean Spa. All rights reserved.
            </p>
            <p>Powered by HBaOMS &bull; Grand Baie, Mauritius</p>
          </div>
        </div>
      </footer>

      {/* Sticky Booking Bar */}
      <BookingBar isSignedIn={isSignedIn} />
    </div>
  );
}
