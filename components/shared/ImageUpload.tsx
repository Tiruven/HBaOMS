// components/shared/ImageUpload.tsx
"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getImageUrl, MAX_IMAGE_SIZE_BYTES } from "@/lib/imageUtils";
import { Upload, X, Loader2, Image as ImageIcon, AlertCircle } from "lucide-react";

interface ImageUploadProps {
  value?: string | null;
  onChange: (imagePath: string | null) => void;
  folder: "room-types" | "rooms" | "services" | "tours";
  fallbackCategory?: "room" | "service" | "tour";
  label?: string;
  disabled?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  folder,
  fallbackCategory = "room",
  label = "Catalog Photo",
  disabled = false,
}) => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentPreviewUrl = getImageUrl(value, fallbackCategory);
  const hasCustomImage = Boolean(value && value.trim() !== "");

  const handleFileSelected = async (file: File) => {
    setErrorMsg(null);

    // 1. Client-Side Size Validation
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setErrorMsg(`File size exceeds 3 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
      return;
    }

    // 2. Client-Side Format Validation
    const validMimes = ["image/jpeg", "image/png", "image/webp"];
    if (!validMimes.includes(file.type)) {
      setErrorMsg("Invalid file format. Please upload a JPEG, PNG, or WebP image.");
      return;
    }

    // 3. Upload to Route Handler
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload image.");
      }

      // If replacing an old image, optionally delete old file
      if (hasCustomImage && value && !value.startsWith("http")) {
        fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_path: value }),
        }).catch((e) => console.warn("Old image cleanup error:", e));
      }

      onChange(data.image_path);
    } catch (err: any) {
      console.error("[ImageUpload] Upload error:", err);
      setErrorMsg(err.message || "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || isUploading) return;

    const oldPath = value;
    onChange(null);

    if (oldPath && !oldPath.startsWith("http")) {
      try {
        await fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_path: oldPath }),
        });
      } catch (e) {
        console.warn("Storage deletion error:", e);
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-navy-900 uppercase tracking-wider">{label}</Label>
        <span className="text-[11px] text-slate-400">Max 3 MB • JPEG, PNG, WebP</span>
      </div>

      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        disabled={disabled || isUploading}
        className="hidden"
      />

      {/* Image Preview & Upload Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && !disabled && fileInputRef.current?.click()}
        className={`relative group cursor-pointer overflow-hidden rounded-xl border-2 transition-all ${
          isDragging
            ? "border-gold-500 bg-gold-50/50"
            : "border-dashed border-slate-200 hover:border-gold-400 bg-slate-50"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        {/* Preview Frame */}
        <div className="relative h-44 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
          {currentPreviewUrl ? (
            <img
              src={currentPreviewUrl}
              alt="Catalog preview"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <ImageIcon className="h-10 w-10 mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">No image selected</p>
              <p className="text-[11px]">Click or drag a photo here to upload</p>
            </div>
          )}

          {/* Uploading Overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-navy-900/70 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10">
              <Loader2 className="h-8 w-8 animate-spin text-gold-400 mb-2" />
              <span className="text-xs font-semibold">Validating & Uploading...</span>
            </div>
          )}

          {/* Hover Action Overlay */}
          {!isUploading && (
            <div className="absolute inset-0 bg-navy-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
              <Button
                type="button"
                size="sm"
                variant="gold"
                className="gap-1.5 text-xs shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="h-3.5 w-3.5" />
                {hasCustomImage ? "Change Image" : "Upload Image"}
              </Button>

              {hasCustomImage && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="gap-1.5 text-xs shadow-lg"
                  onClick={handleRemove}
                >
                  <X className="h-3.5 w-3.5" />
                  Remove
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Message Alert */}
      {errorMsg && (
        <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};

