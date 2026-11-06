// lib/imageUtils.ts

import { supabase } from "@/lib/supabaseClient";

export const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

// High-quality fallback photos from Unsplash for Mauritius resort aesthetic
export const FALLBACK_IMAGES = {
  room: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
  roomExecutive: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
  roomStandard: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
  service: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80",
  tour: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
};

/**
 * Resolves an image path from Supabase storage into a full public URL,
 * or returns a themed fallback image if no path is provided.
 */
export function getImageUrl(
  imagePath?: string | null,
  fallbackCategory: "room" | "service" | "tour" = "room"
): string {
  if (!imagePath || typeof imagePath !== "string" || imagePath.trim() === "") {
    return FALLBACK_IMAGES[fallbackCategory];
  }

  // If already an absolute URL (e.g. Unsplash or external CDN)
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // Clean relative path (remove leading slashes)
  const cleanPath = imagePath.replace(/^\/+/, "");

  const { data } = supabase.storage.from("catalog-images").getPublicUrl(cleanPath);
  return data?.publicUrl || FALLBACK_IMAGES[fallbackCategory];
}

