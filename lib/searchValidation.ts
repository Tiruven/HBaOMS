// lib/searchValidation.ts
import { z } from "zod";
import { mauritiusToday } from "@/lib/time";

export const searchParamsSchema = z.object({
  checkIn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-in date format")
    .optional()
    .default(() => mauritiusToday()),
  checkOut: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid check-out date format")
    .optional(),
  adults: z.coerce.number().int().min(1, "At least 1 adult required").max(10).default(1),
  children: z.coerce.number().int().min(0, "Children cannot be negative").max(10).default(0),
  types: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((s) => s.trim()).filter(Boolean) : [])),
  features: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((n) => !isNaN(n) && n > 0)
        : []
    ),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minSize: z.coerce.number().min(0).optional(),
  maxSize: z.coerce.number().min(0).optional(),
  keyword: z.string().optional().default(""),
  sort: z.enum(["recommended", "price_asc", "price_desc", "size_desc"]).default("recommended"),
});

export type SearchFilterParams = z.infer<typeof searchParamsSchema>;

/**
 * Validates search dates ensuring check-in is not in the past
 * and check-out is strictly after check-in.
 */
export function validateStayDates(checkIn: string, checkOut: string): { isValid: boolean; error?: string } {
  const today = mauritiusToday();
  if (checkIn < today) {
    return { isValid: false, error: "Check-in date cannot be in the past." };
  }
  if (checkOut <= checkIn) {
    return { isValid: false, error: "Check-out date must be after check-in date." };
  }
  return { isValid: true };
}

