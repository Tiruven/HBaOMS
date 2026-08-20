// components/ui/checkbox.tsx
"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, onChange, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={(e) => {
            if (onChange) onChange(e);
            if (onCheckedChange) onCheckedChange(e.target.checked);
          }}
          className={cn(
            "peer h-4 w-4 shrink-0 rounded border border-slate-300 bg-white text-gold-600 focus:ring-gold-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer accent-[#A37836]",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
