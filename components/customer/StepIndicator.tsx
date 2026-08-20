// components/customer/StepIndicator.tsx
import React from "react";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, steps }) => {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative max-w-3xl mx-auto px-4">
        {/* Connecting line */}
        <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 -z-0" />
        <div
          className="absolute left-10 top-1/2 -translate-y-1/2 h-0.5 bg-[#A37836] transition-all duration-500 -z-0"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 85}%` }}
        />

        {steps.map((stepName, idx) => {
          const stepNumber = idx + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <div key={idx} className="flex flex-col items-center relative z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                  isCompleted
                    ? "bg-[#A37836] text-white shadow-md"
                    : isCurrent
                    ? "bg-[#A37836] text-white ring-4 ring-[#F4EFE6] shadow-lg scale-110"
                    : "bg-white border-2 border-slate-300 text-slate-400"
                }`}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : stepNumber}
              </div>
              <span
                className={`text-xs mt-2 font-medium hidden sm:block ${
                  isCurrent ? "text-[#A37836] font-bold" : "text-slate-500"
                }`}
              >
                {stepName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
