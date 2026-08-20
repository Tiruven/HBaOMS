// app/customer/rooms/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Room, RoomType, PricingRule } from "@/lib/types";
import { RoomCard } from "@/components/customer/RoomCard";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, RefreshCw, BedDouble } from "lucide-react";

export default function CustomerRoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [maxPriceFilter, setMaxPriceFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [rRes, rtRes, prRes] = await Promise.all([
          supabase.from("room").select("*, room_type(*), room_feature(feature(*))").eq("room_status", "Available"),
          supabase.from("room_type").select("*"),
          supabase.from("pricing_rule").select("*"),
        ]);

        if (rRes.data) setRooms(rRes.data);
        if (rtRes.data) setRoomTypes(rtRes.data);
        if (prRes.data) setPricingRules(prRes.data);
      } catch (err) {
        console.error("Fetch rooms error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSelectRoom = (room: Room) => {
    // Navigate directly to booking wizard step 1 with preselected room
    router.push(`/customer/booking/new?roomId=${room.room_id}`);
  };

  const getRuleForRoom = (room: Room) => {
    const today = new Date().toISOString().split("T")[0];
    const rule = pricingRules.find(
      (p) =>
        p.room_type_room_type_id === room.room_type_room_type_id &&
        today >= p.start_date.split("T")[0] &&
        today <= p.end_date.split("T")[0]
    );
    return rule;
  };

  const filteredRooms = rooms.filter((r) => {
    const typeName = r.room_type?.type || "";
    const basePrice = r.room_type?.price || 0;

    if (selectedType !== "ALL" && typeName !== selectedType) return false;
    if (maxPriceFilter && basePrice > parseFloat(maxPriceFilter)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const desc = (r.room_desc || "").toLowerCase();
      return typeName.toLowerCase().includes(q) || desc.includes(q) || String(r.room_id).includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-2">
        <h1 className="text-3xl font-extrabold text-[#1A202C]">Accommodations Showcase</h1>
        <p className="text-slate-500 text-sm max-w-2xl">
          Browse our ocean suites and luxury island villas. Filter by room category, capacity, or night rate.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-[#E5E2DC] shadow-sm flex flex-col md:flex-row items-end gap-4">
        <div className="w-full md:w-1/3 space-y-2">
          <Label className="text-xs font-bold text-slate-600">Search Keyword</Label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search suite, villa, amenities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#F8F7F4] border-[#E5E2DC]"
            />
          </div>
        </div>

        <div className="w-full sm:w-1/2 md:w-1/4 space-y-2">
          <Label className="text-xs font-bold text-slate-600">Room Category</Label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="bg-[#F8F7F4] border-[#E5E2DC]">
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

        <div className="w-full sm:w-1/2 md:w-1/4 space-y-2">
          <Label className="text-xs font-bold text-slate-600">Max Base Rate (MUR)</Label>
          <Input
            type="number"
            placeholder="e.g. 25000"
            value={maxPriceFilter}
            onChange={(e) => setMaxPriceFilter(e.target.value)}
            className="bg-[#F8F7F4] border-[#E5E2DC]"
          />
        </div>

        <Button
          variant="outline"
          onClick={() => {
            setSelectedType("ALL");
            setMaxPriceFilter("");
            setSearchQuery("");
          }}
          className="border-[#E5E2DC] text-slate-600 gap-1 hover:bg-[#F4EFE6]"
        >
          <RefreshCw className="h-4 w-4" /> Reset
        </Button>
      </div>

      {/* Room Grid */}
      {loading ? (
        <SkeletonCard count={3} />
      ) : filteredRooms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E2DC] p-12 text-center space-y-3">
          <BedDouble className="h-10 w-10 text-[#A37836] mx-auto" />
          <h3 className="text-lg font-bold text-[#1A202C]">No Rooms Match Your Criteria</h3>
          <p className="text-xs text-slate-500">Try adjusting your filters or search keywords.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {filteredRooms.map((room) => {
            const rule = getRuleForRoom(room);
            return (
              <RoomCard
                key={room.room_id}
                room={room}
                rateOverride={rule?.rate_override}
                overrideReason={rule?.reason}
                onSelect={handleSelectRoom}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
