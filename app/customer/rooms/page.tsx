// app/customer/rooms/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Room, RoomType, Feature, PricingRule } from "@/lib/types";
import { mauritiusToday } from "@/lib/time";
import { formatCurrency } from "@/lib/utils";
import { isRoomAvailableForDates, getEffectiveRoomPrice, OccupiedStay } from "@/lib/searchUtils";
import { validateStayDates } from "@/lib/searchValidation";
import { RoomCard } from "@/components/customer/RoomCard";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  Search,
  RefreshCw,
  BedDouble,
  Calendar,
  Users,
  SlidersHorizontal,
  X,
  Sparkles,
  ArrowUpDown,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function CustomerRoomsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Primary Data State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [occupiedStays, setOccupiedStays] = useState<OccupiedStay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters from URL or Defaults
  // Default: NO date constraints unless user picks dates
  const todayStr = useMemo(() => mauritiusToday(), []);
  const [checkInDate, setCheckInDate] = useState<string>(
    searchParams.get("checkIn") || ""
  );
  const [checkOutDate, setCheckOutDate] = useState<string>(
    searchParams.get("checkOut") || ""
  );
  const [adults, setAdults] = useState<number>(
    Number(searchParams.get("adults")) || 1
  );
  const [children, setChildren] = useState<number>(
    Number(searchParams.get("children")) || 0
  );

  const [selectedTypes, setSelectedTypes] = useState<string[]>(() => {
    const p = searchParams.get("types");
    return p ? p.split(",").filter(Boolean) : [];
  });

  const [selectedFeatures, setSelectedFeatures] = useState<number[]>(() => {
    const p = searchParams.get("features");
    return p ? p.split(",").map(Number).filter((n) => !isNaN(n) && n > 0) : [];
  });

  const [maxPrice, setMaxPrice] = useState<number>(() => {
    const p = searchParams.get("maxPrice");
    return p ? Number(p) : 0; // 0 means unrestricted
  });

  const [minSize, setMinSize] = useState<number>(() => {
    const p = searchParams.get("minSize");
    return p ? Number(p) : 0;
  });

  const [searchQuery, setSearchQuery] = useState<string>(
    searchParams.get("q") || ""
  );

  const [sortBy, setSortBy] = useState<string>(
    searchParams.get("sort") || "recommended"
  );

  const [showAllFeatures, setShowAllFeatures] = useState<boolean>(false);
  const [dateError, setDateError] = useState<string>("");

  // Sync state changes with URL query parameters for bookmarkable search
  const updateURL = (overrides: Record<string, string | number | undefined | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    const merged = {
      checkIn: checkInDate || undefined,
      checkOut: checkOutDate || undefined,
      adults: adults > 1 ? adults : undefined,
      children: children > 0 ? children : undefined,
      types: selectedTypes.length > 0 ? selectedTypes.join(",") : undefined,
      features: selectedFeatures.length > 0 ? selectedFeatures.join(",") : undefined,
      maxPrice: maxPrice > 0 ? maxPrice : undefined,
      minSize: minSize > 0 ? minSize : undefined,
      q: searchQuery.trim() || undefined,
      sort: sortBy !== "recommended" ? sortBy : undefined,
      ...overrides,
    };

    Object.entries(merged).forEach(([key, val]) => {
      if (val === undefined || val === null || val === "") {
        params.delete(key);
      } else {
        params.set(key, String(val));
      }
    });

    startTransition(() => {
      router.replace(`/customer/rooms?${params.toString()}`, { scroll: false });
    });
  };

  // Validate Dates whenever dates change
  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const val = validateStayDates(checkInDate, checkOutDate);
      if (!val.isValid) {
        setDateError(val.error || "Invalid stay dates");
      } else {
        setDateError("");
      }
    } else {
      setDateError("");
    }
  }, [checkInDate, checkOutDate]);

  // Load Database Catalog Data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [rRes, rtRes, fRes, prRes, staysRes] = await Promise.all([
          supabase
            .from("room")
            .select("*, room_type(*), room_feature(feature_feature_id, feature(*))")
            .neq("room_status", "Maintenance"),
          supabase.from("room_type").select("*"),
          supabase.from("feature").select("*").order("room_features", { ascending: true }),
          supabase.from("pricing_rule").select("*"),
          supabase
            .from("check_in_out")
            .select("room_room_id, check_in_date, check_out_date, booking!inner(booking_status)")
            .neq("booking.booking_status", "Cancelled")
            .gte("check_out_date", todayStr),
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
      } catch (err) {
        console.error("Fetch rooms search error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [todayStr]);

  // Multi-select handlers
  const handleToggleType = (typeTitle: string) => {
    const updated = selectedTypes.includes(typeTitle)
      ? selectedTypes.filter((t) => t !== typeTitle)
      : [...selectedTypes, typeTitle];
    setSelectedTypes(updated);
    updateURL({ types: updated.length > 0 ? updated.join(",") : undefined });
  };

  const handleToggleFeature = (featureId: number) => {
    const updated = selectedFeatures.includes(featureId)
      ? selectedFeatures.filter((id) => id !== featureId)
      : [...selectedFeatures, featureId];
    setSelectedFeatures(updated);
    updateURL({ features: updated.length > 0 ? updated.join(",") : undefined });
  };

  const handleResetFilters = () => {
    setCheckInDate("");
    setCheckOutDate("");
    setAdults(1);
    setChildren(0);
    setSelectedTypes([]);
    setSelectedFeatures([]);
    setMaxPrice(0);
    setMinSize(0);
    setSearchQuery("");
    setSortBy("recommended");
    setDateError("");
    router.replace("/customer/rooms", { scroll: false });
  };

  // Helper: Extract all feature IDs from a room (checking both rf.feature_feature_id and rf.feature.feature_id)
  const getRoomFeatureIds = (r: Room): number[] => {
    if (!r.room_feature || !Array.isArray(r.room_feature)) return [];
    return r.room_feature
      .map((rf: any) => rf.feature_feature_id || rf.feature?.feature_id)
      .filter((id: any) => typeof id === "number" && id > 0);
  };

  // Compute live match count for each Feature
  const featureRoomCounts = useMemo(() => {
    const map = new Map<number, number>();
    rooms.forEach((r) => {
      const ids = getRoomFeatureIds(r);
      ids.forEach((id) => {
        map.set(id, (map.get(id) || 0) + 1);
      });
    });
    return map;
  }, [rooms]);

  const sortedFeatures = useMemo(() => {
    return [...features].sort(
      (a, b) => (featureRoomCounts.get(b.feature_id) || 0) - (featureRoomCounts.get(a.feature_id) || 0)
    );
  }, [features, featureRoomCounts]);

  // Compute live match count for each Room Type
  const typeRoomCounts = useMemo(() => {
    const map = new Map<string, number>();
    rooms.forEach((r) => {
      const type = r.room_type?.type;
      if (type) {
        map.set(type, (map.get(type) || 0) + 1);
      }
    });
    return map;
  }, [rooms]);

  // Price Bounds from data
  const { minPriceBound, maxPriceBound, minSizeBound, maxSizeBound } = useMemo(() => {
    if (roomTypes.length === 0) {
      return { minPriceBound: 1000, maxPriceBound: 40000, minSizeBound: 20, maxSizeBound: 250 };
    }
    const prices = roomTypes.map((rt) => rt.price);
    const sizes = roomTypes.map((rt) => rt.size);
    return {
      minPriceBound: Math.min(...prices),
      maxPriceBound: Math.max(...prices, 40000),
      minSizeBound: Math.min(...sizes),
      maxSizeBound: Math.max(...sizes),
    };
  }, [roomTypes]);

  // Effective upper price slider limit
  const currentMaxPrice = maxPrice > 0 ? maxPrice : maxPriceBound;

  // Core Advanced Filtering Algorithm
  const filteredAndSortedRooms = useMemo(() => {
    return rooms
      .filter((r) => {
        // 1. Explicit availability check: room_status not Maintenance
        if (r.room_status === "Maintenance") return false;

        // 2. Date overlap check against confirmed reservations (only if dates are explicitly selected)
        if (!dateError && checkInDate && checkOutDate) {
          const isAvail = isRoomAvailableForDates(r.room_id, checkInDate, checkOutDate, occupiedStays);
          if (!isAvail) return false;
        }

        // 3. Guest Capacity (Only filter if user actively raised guests above 1 or added children)
        const maxAdults = r.room_type?.max_adults ?? 2;
        const maxChildren = r.room_type?.max_children ?? 2;
        if (adults > 1 && adults > maxAdults) return false;
        if (children > 0 && children > maxChildren) return false;

        // 4. Room Types (OR Logic)
        const typeName = r.room_type?.type || "";
        if (selectedTypes.length > 0 && !selectedTypes.includes(typeName)) {
          return false;
        }

        // 5. Room Size
        const size = r.room_type?.size || 0;
        if (minSize > 0 && size < minSize) return false;

        // 6. Effective Price calculation with Pricing Rules
        const { effectivePrice } = getEffectiveRoomPrice(r, checkInDate, checkOutDate, pricingRules);
        if (maxPrice > 0 && effectivePrice > maxPrice) return false;

        // 7. Room Features (AND Logic: must possess ALL selected features)
        if (selectedFeatures.length > 0) {
          const roomFeatureIds = getRoomFeatureIds(r);
          const hasAllFeatures = selectedFeatures.every((fid) => roomFeatureIds.includes(fid));
          if (!hasAllFeatures) return false;
        }

        // 8. Keyword search across room name, description, and feature labels
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const desc = (r.room_desc || "").toLowerCase();
          const matchesType = typeName.toLowerCase().includes(q);
          const matchesId = String(r.room_id).includes(q);
          const matchesDesc = desc.includes(q);
          const matchesFeature = (r.room_feature || []).some((rf) =>
            rf.feature?.room_features.toLowerCase().includes(q)
          );
          if (!matchesType && !matchesId && !matchesDesc && !matchesFeature) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const pA = getEffectiveRoomPrice(a, checkInDate, checkOutDate, pricingRules).effectivePrice;
        const pB = getEffectiveRoomPrice(b, checkInDate, checkOutDate, pricingRules).effectivePrice;
        const sizeA = a.room_type?.size || 0;
        const sizeB = b.room_type?.size || 0;

        if (sortBy === "price_asc") return pA - pB;
        if (sortBy === "price_desc") return pB - pA;
        if (sortBy === "size_desc") return sizeB - sizeA;

        // Recommended: rooms with photos first, then by room_id
        const hasPhotoA = !!(a.image_path || a.room_type?.image_path);
        const hasPhotoB = !!(b.image_path || b.room_type?.image_path);
        if (hasPhotoA !== hasPhotoB) return Number(hasPhotoB) - Number(hasPhotoA);
        return a.room_id - b.room_id;
      });
  }, [
    rooms,
    dateError,
    checkInDate,
    checkOutDate,
    occupiedStays,
    adults,
    children,
    selectedTypes,
    minSize,
    maxPrice,
    selectedFeatures,
    searchQuery,
    sortBy,
    pricingRules,
  ]);

  // Navigate directly into Booking Wizard with preserved dates & guest counts
  const handleSelectRoom = (room: Room) => {
    const params = new URLSearchParams({
      roomId: String(room.room_id),
      ...(checkInDate && { checkIn: checkInDate }),
      ...(checkOutDate && { checkOut: checkOutDate }),
      ...(adults > 1 && { adults: String(adults) }),
      ...(children > 0 && { children: String(children) }),
    });
    router.push(`/customer/booking/new?${params.toString()}`);
  };

  const visibleFeatures = showAllFeatures ? sortedFeatures : sortedFeatures.slice(0, 5);

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="bg-white p-8 rounded-3xl border border-[#E5E2DC] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A37836]">
            <Sparkles className="h-4 w-4" /> Live Resort Catalogue
          </div>
          <h1 className="text-3xl font-extrabold text-[#1A202C]">Accommodations &amp; Suites</h1>
          <p className="text-slate-500 text-sm max-w-2xl">
            Browse our ocean suites and luxury island villas. Filter by availability, rates, or amenities.
          </p>
        </div>
        <div className="text-left md:text-right">
          <div className="text-2xl font-black text-[#1A202C]">
            {filteredAndSortedRooms.length}
          </div>
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Available Rooms
          </div>
        </div>
      </div>

      {/* TOP BAR: Dates, Occupancy & Global Keyword Search */}
      <div className="bg-white p-6 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Check-In */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#A37836]" /> Check-In (Optional)
            </Label>
            <Input
              type="date"
              value={checkInDate}
              min={todayStr}
              onChange={(e) => {
                setCheckInDate(e.target.value);
                updateURL({ checkIn: e.target.value || undefined });
              }}
              className="bg-[#F8F7F4] border-[#E5E2DC] text-xs font-medium"
            />
          </div>

          {/* Check-Out */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#A37836]" /> Check-Out (Optional)
            </Label>
            <Input
              type="date"
              value={checkOutDate}
              min={checkInDate || todayStr}
              onChange={(e) => {
                setCheckOutDate(e.target.value);
                updateURL({ checkOut: e.target.value || undefined });
              }}
              className="bg-[#F8F7F4] border-[#E5E2DC] text-xs font-medium"
            />
          </div>

          {/* Adults */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[#A37836]" /> Adults (12+)
            </Label>
            <Select
              value={String(adults)}
              onValueChange={(val) => {
                const n = Number(val);
                setAdults(n);
                updateURL({ adults: n > 1 ? n : undefined });
              }}
            >
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

          {/* Children */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[#A37836]" /> Children (&lt;12)
            </Label>
            <Select
              value={String(children)}
              onValueChange={(val) => {
                const n = Number(val);
                setChildren(n);
                updateURL({ children: n > 0 ? n : undefined });
              }}
            >
              <SelectTrigger className="bg-[#F8F7F4] border-[#E5E2DC] text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 0 ? "No Children" : `${n} Child${n > 1 ? "ren" : ""}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Keyword Search */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-[#A37836]" /> Search
            </Label>
            <div className="relative">
              <Input
                placeholder="Suite, Jacuzzi, Balcony..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  updateURL({ q: e.target.value.trim() || undefined });
                }}
                className="bg-[#F8F7F4] border-[#E5E2DC] text-xs pr-8"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    updateURL({ q: undefined });
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Date Validation Alert */}
        {dateError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-2xl flex items-center gap-2 text-xs font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{dateError}</span>
          </div>
        )}
      </div>

      {/* MAIN TWO-COLUMN CONTENT: Filters Sidebar + Room Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* SIDEBAR: Advanced Filters */}
        <div className="bg-white p-6 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-6 lg:sticky lg:top-24">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 font-bold text-sm text-[#1A202C]">
              <SlidersHorizontal className="h-4 w-4 text-[#A37836]" /> Filter Catalog
            </div>
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-[#A37836] hover:text-[#8B6327] flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Reset All
            </button>
          </div>

          {/* Filter Group: Room Types (OR Logic) */}
          <div className="space-y-3">
            <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Room Categories
            </Label>
            <div className="space-y-2">
              {roomTypes.map((rt) => {
                const count = typeRoomCounts.get(rt.type) || 0;
                const isChecked = selectedTypes.includes(rt.type);
                return (
                  <label
                    key={rt.room_type_id}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-[#F4EFE6] border-[#A37836] text-[#1A202C] font-semibold"
                        : "bg-[#F8F7F4] border-[#E5E2DC] text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleToggleType(rt.type)}
                      />
                      <span>{rt.type}</span>
                    </div>
                    <Badge variant="outline" className="border-slate-300 text-[10px] text-slate-500">
                      {count}
                    </Badge>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Filter Group: Max Nightly Rate Slider */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Max Nightly Rate
              </Label>
              <span className="text-xs font-bold text-[#A37836]">
                {maxPrice > 0 ? formatCurrency(maxPrice) : "Any Price"}
              </span>
            </div>
            <input
              type="range"
              min={minPriceBound}
              max={maxPriceBound}
              step="500"
              value={currentMaxPrice}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMaxPrice(val);
                updateURL({ maxPrice: val });
              }}
              className="w-full h-2 bg-[#F4EFE6] rounded-lg appearance-none cursor-pointer accent-[#A37836] border border-[#E5E2DC]"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>{formatCurrency(minPriceBound)}</span>
              <span>{formatCurrency(maxPriceBound)}</span>
            </div>
          </div>

          {/* Filter Group: Min Room Size */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Min Room Size
              </Label>
              <span className="text-xs font-bold text-[#A37836]">
                {minSize > 0 ? `${minSize} m²` : "Any Size"}
              </span>
            </div>
            <input
              type="range"
              min={minSizeBound}
              max={maxSizeBound}
              step="5"
              value={minSize}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMinSize(val);
                updateURL({ minSize: val > 0 ? val : undefined });
              }}
              className="w-full h-2 bg-[#F4EFE6] rounded-lg appearance-none cursor-pointer accent-[#A37836] border border-[#E5E2DC]"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>{minSizeBound} m²</span>
              <span>{maxSizeBound} m²</span>
            </div>
          </div>

          {/* Filter Group: Room Features (AND Logic) */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Features &amp; Amenities
              </Label>
              <span className="text-[10px] text-slate-400">Must have all</span>
            </div>
            <div className="space-y-2">
              {visibleFeatures.map((f) => {
                const count = featureRoomCounts.get(f.feature_id) || 0;
                const isChecked = selectedFeatures.includes(f.feature_id);
                return (
                  <label
                    key={f.feature_id}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-[#F4EFE6] border-[#A37836] text-[#1A202C] font-semibold"
                        : "bg-[#F8F7F4] border-[#E5E2DC] text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleToggleFeature(f.feature_id)}
                      />
                      <span>{f.room_features}</span>
                    </div>
                    <Badge variant="outline" className="border-slate-300 text-[10px] text-slate-500">
                      {count}
                    </Badge>
                  </label>
                );
              })}
            </div>

            {sortedFeatures.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllFeatures(!showAllFeatures)}
                className="text-xs text-[#A37836] font-semibold hover:text-[#8B6327] flex items-center gap-1 pt-1"
              >
                {showAllFeatures ? (
                  <>
                    Show Less <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    Show {sortedFeatures.length - 5} More Amenities <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* RESULTS PANEL */}
        <div className="lg:col-span-3 space-y-6">
          {/* Active Filter Chips & Sorting Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-[#E5E2DC] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Active Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Filters:
              </span>

              {checkInDate && checkOutDate && (
                <span className="bg-[#F4EFE6] text-[#8B6327] text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border border-[#E5E2DC]">
                  <Calendar className="h-3 w-3" />
                  {checkInDate} to {checkOutDate}
                  <button
                    onClick={() => {
                      setCheckInDate("");
                      setCheckOutDate("");
                      updateURL({ checkIn: undefined, checkOut: undefined });
                    }}
                  >
                    <X className="h-3 w-3 hover:text-red-600" />
                  </button>
                </span>
              )}

              {selectedTypes.map((t) => (
                <span
                  key={t}
                  className="bg-[#F4EFE6] text-[#8B6327] text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border border-[#E5E2DC]"
                >
                  {t}
                  <button onClick={() => handleToggleType(t)}>
                    <X className="h-3 w-3 hover:text-red-600" />
                  </button>
                </span>
              ))}

              {selectedFeatures.map((fid) => {
                const feat = features.find((f) => f.feature_id === fid);
                if (!feat) return null;
                return (
                  <span
                    key={fid}
                    className="bg-[#F4EFE6] text-[#8B6327] text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border border-[#E5E2DC]"
                  >
                    <Sparkles className="h-3 w-3" />
                    {feat.room_features}
                    <button onClick={() => handleToggleFeature(fid)}>
                      <X className="h-3 w-3 hover:text-red-600" />
                    </button>
                  </span>
                );
              })}

              {maxPrice > 0 && (
                <span className="bg-[#F4EFE6] text-[#8B6327] text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border border-[#E5E2DC]">
                  &le; {formatCurrency(maxPrice)}
                  <button
                    onClick={() => {
                      setMaxPrice(0);
                      updateURL({ maxPrice: undefined });
                    }}
                  >
                    <X className="h-3 w-3 hover:text-red-600" />
                  </button>
                </span>
              )}

              {minSize > 0 && (
                <span className="bg-[#F4EFE6] text-[#8B6327] text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border border-[#E5E2DC]">
                  &ge; {minSize} m²
                  <button
                    onClick={() => {
                      setMinSize(0);
                      updateURL({ minSize: undefined });
                    }}
                  >
                    <X className="h-3 w-3 hover:text-red-600" />
                  </button>
                </span>
              )}

              {!checkInDate &&
                selectedTypes.length === 0 &&
                selectedFeatures.length === 0 &&
                maxPrice === 0 &&
                minSize === 0 && (
                  <span className="text-xs text-slate-400 italic">Showing all available rooms</span>
                )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <ArrowUpDown className="h-4 w-4 text-slate-400" />
              <Select
                value={sortBy}
                onValueChange={(val) => {
                  setSortBy(val);
                  updateURL({ sort: val !== "recommended" ? val : undefined });
                }}
              >
                <SelectTrigger className="bg-[#F8F7F4] border-[#E5E2DC] text-xs font-medium w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">Recommended</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  <SelectItem value="size_desc">Room Size: Largest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Room Cards Grid */}
          {loading ? (
            <SkeletonCard count={3} />
          ) : filteredAndSortedRooms.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#E5E2DC] p-16 text-center space-y-4 shadow-sm">
              <div className="p-4 rounded-full bg-[#F4EFE6] text-[#A37836] inline-block">
                <BedDouble className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-[#1A202C]">No Accommodations Match Your Search</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                We couldn&apos;t find any rooms matching all your selected filters.
                Try adjusting your search criteria or resetting filters.
              </p>
              <div className="pt-2">
                <Button
                  onClick={handleResetFilters}
                  className="bg-[#A37836] hover:bg-[#8B6327] text-white rounded-xl gap-2 font-semibold"
                >
                  <RefreshCw className="h-4 w-4" /> Reset All Filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedRooms.map((room) => {
                const { activeRule } = getEffectiveRoomPrice(
                  room,
                  checkInDate,
                  checkOutDate,
                  pricingRules
                );

                return (
                  <div key={room.room_id} className="relative flex flex-col">
                    <RoomCard
                      room={room}
                      rateOverride={activeRule?.rate_override}
                      overrideReason={activeRule?.reason}
                      onSelect={handleSelectRoom}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
