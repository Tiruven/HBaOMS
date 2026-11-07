// components/customer/PricingBadge.tsx
import React from "react";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface PricingBadgeProps {
  basePrice: number;
  rateOverride?: number | null;
  reason?: string | null;
}

export const PricingBadge: React.FC<PricingBadgeProps> = ({ basePrice, rateOverride, reason }) => {
  if (!rateOverride || rateOverride === 0) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-1.5">
        <span className="text-lg sm:text-xl font-extrabold text-[#1A202C] tracking-tight leading-none whitespace-nowrap">
          {formatCurrency(basePrice)}
        </span>
        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">/ night</span>
      </div>
    );
  }

  const effectivePrice = Math.round(basePrice * (1 + rateOverride / 100));
  const isSurcharge = rateOverride > 0;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-1.5">
        <span className="text-lg sm:text-xl font-extrabold text-[#1A202C] tracking-tight leading-none whitespace-nowrap">
          {formatCurrency(effectivePrice)}
        </span>
        <span className="text-xs text-slate-400 line-through font-medium whitespace-nowrap">
          {formatCurrency(basePrice)}
        </span>
        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">/ night</span>
      </div>
      <Badge
        className={`text-[10px] py-0 px-1.5 ${
          isSurcharge
            ? "bg-amber-100 text-amber-800 border-amber-200"
            : "bg-emerald-100 text-emerald-800 border-emerald-200"
        }`}
      >
        {isSurcharge ? `+${rateOverride}%` : `${rateOverride}%`} {reason ? `(${reason})` : ""}
      </Badge>
    </div>
  );
};
