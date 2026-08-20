// components/customer/RoomCard.tsx
import React from "react";
import Image from "next/image";
import { Room, Feature } from "@/lib/types";
import { PricingBadge } from "./PricingBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BedDouble, Users, Maximize2, Sparkles, Check } from "lucide-react";

interface RoomCardProps {
  room: Room;
  rateOverride?: number | null;
  overrideReason?: string | null;
  onSelect?: (room: Room) => void;
  isSelected?: boolean;
}

const DEFAULT_ROOM_IMAGES: Record<string, string> = {
  Deluxe: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=80",
  Suite: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
  Villa: "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?auto=format&fit=crop&w=800&q=80",
};

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  rateOverride,
  overrideReason,
  onSelect,
  isSelected,
}) => {
  const roomTypeName = room.room_type?.type || "Standard Room";
  const basePrice = room.room_type?.price || 5000;
  const roomSize = room.room_type?.size || 35;
  const imageUrl = DEFAULT_ROOM_IMAGES[roomTypeName] || DEFAULT_ROOM_IMAGES.Deluxe;

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-xl ${
        isSelected ? "border-[#A37836] ring-2 ring-[#A37836]" : "border-[#E5E2DC] hover:border-[#A37836]/50"
      }`}
    >
      <div>
        {/* Room Header Image */}
        <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
          <img
            src={imageUrl}
            alt={roomTypeName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute top-3 left-3 bg-[#1A202C]/80 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
            Room #{room.room_id}
          </div>
          <div className="absolute top-3 right-3">
            <Badge className="bg-[#A37836] text-white font-medium">
              {roomTypeName}
            </Badge>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-5 space-y-4">
          <div>
            <h3 className="font-bold text-lg text-[#1A202C]">{roomTypeName}</h3>
            <p className="text-xs text-slate-500 line-clamp-2 mt-1">
              {room.room_desc || "Luxurious accommodation with premium island views, climate control, and ocean breeze access."}
            </p>
          </div>

          {/* Key Specs */}
          <div className="flex items-center gap-4 text-xs text-slate-600 border-y border-slate-100 py-2.5">
            <div className="flex items-center gap-1.5">
              <Maximize2 className="h-4 w-4 text-[#A37836]" />
              <span>{roomSize} m²</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BedDouble className="h-4 w-4 text-[#A37836]" />
              <span>King Bed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-[#A37836]" />
              <span>2 Guests</span>
            </div>
          </div>

          {/* Features List */}
          {room.room_feature && room.room_feature.length > 0 && (
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Amenities Included
              </span>
              <div className="flex flex-wrap gap-1.5">
                {room.room_feature.slice(0, 3).map((f, i) => (
                  <span
                    key={i}
                    className="text-[10px] bg-[#F4EFE6] text-[#8B6327] font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
                  >
                    <Sparkles className="h-2.5 w-2.5" /> {f.feature?.room_features}
                  </span>
                ))}
                {room.room_feature.length > 3 && (
                  <span className="text-[10px] text-slate-400">+{room.room_feature.length - 3} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Pricing & CTA */}
      <div className="p-5 pt-0 border-t border-slate-100 flex items-center justify-between">
        <PricingBadge basePrice={basePrice} rateOverride={rateOverride} reason={overrideReason} />
        {onSelect && (
          <Button
            onClick={() => onSelect(room)}
            className={`gap-1.5 ${
              isSelected
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-[#A37836] hover:bg-[#8B6327] text-white"
            }`}
          >
            {isSelected ? (
              <>
                <Check className="h-4 w-4" /> Selected
              </>
            ) : (
              "Select Room"
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
