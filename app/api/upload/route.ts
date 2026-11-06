// app/api/upload/route.ts
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { MAX_IMAGE_SIZE_BYTES, ALLOWED_IMAGE_MIME_TYPES } from "@/lib/imageUtils";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "placeholder_key";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALLOWED_FOLDERS = ["room-types", "rooms", "services", "tours"] as const;
type AllowedFolder = (typeof ALLOWED_FOLDERS)[number];

/**
 * Validates the file buffer against authentic image magic bytes.
 * Blocks disguised executables, scripts, or malicious SVGs.
 */
function validateMagicBytes(buffer: Uint8Array): { isValid: boolean; detectedExt: string; mime: string } {
  if (buffer.length < 12) {
    return { isValid: false, detectedExt: "", mime: "" };
  }

  // 1. JPEG signature: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, detectedExt: "jpg", mime: "image/jpeg" };
  }

  // 2. PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, detectedExt: "png", mime: "image/png" };
  }

  // 3. WebP signature: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return { isValid: true, detectedExt: "webp", mime: "image/webp" };
  }

  return { isValid: false, detectedExt: "", mime: "" };
}

export async function POST(req: Request) {
  try {
    // 1. Authentication & Authorization Check
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Authentication required to upload catalog assets." },
        { status: 401 }
      );
    }

    const user = await currentUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress || "";

    // Check staff role in Supabase staff table (or allow authorized Clerk admin email)
    if (userEmail) {
      const { data: staffMember } = await supabase
        .from("staff")
        .select("role")
        .eq("email", userEmail)
        .maybeSingle();

      const userRole = (staffMember?.role as string) || (user?.publicMetadata?.role as string) || "";
      const isAllowed =
        userRole === "Admin" ||
        userRole === "Receptnst" ||
        userEmail.includes("admin") ||
        process.env.NODE_ENV === "development";

      if (!isAllowed) {
        return NextResponse.json(
          { success: false, error: "Forbidden. Only authorized staff members can upload catalog images." },
          { status: 403 }
        );
      }
    }

    // 2. Parse Form Data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "room-types";

    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded." }, { status: 400 });
    }

    if (!ALLOWED_FOLDERS.includes(folder as AllowedFolder)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid folder. Must be one of: ${ALLOWED_FOLDERS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // 3. File Size Validation (<= 3 MB)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds the 3 MB limit (Uploaded: ${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
        },
        { status: 400 }
      );
    }

    // 4. MIME Type Pre-Check
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as any)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file type "${file.type}". Allowed formats: JPEG, PNG, WebP. (SVGs are blocked for security).`,
        },
        { status: 400 }
      );
    }

    // 5. Deep Magic Bytes Inspection
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const magicCheck = validateMagicBytes(buffer);

    if (!magicCheck.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Security validation failed. File content does not match genuine image header signatures.",
        },
        { status: 400 }
      );
    }

    // 6. Generate Collision-Resistant Random UUID Filename
    const uniqueId = crypto.randomUUID();
    const filename = `${uniqueId}.${magicCheck.detectedExt}`;
    const storagePath = `${folder}/${filename}`;

    // 7. Upload to Supabase Storage Bucket ('catalog-images')
    const { error: uploadError } = await supabase.storage
      .from("catalog-images")
      .upload(storagePath, buffer, {
        contentType: magicCheck.mime,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("[Upload API] Supabase storage upload error:", uploadError);
      return NextResponse.json(
        {
          success: false,
          error: uploadError.message || "Failed to upload file to storage.",
        },
        { status: 500 }
      );
    }

    // 8. Resolve Public URL
    const { data: publicUrlData } = supabase.storage
      .from("catalog-images")
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      image_path: storagePath,
      public_url: publicUrlData.publicUrl,
      size: file.size,
      mime: magicCheck.mime,
    });
  } catch (err: any) {
    console.error("[Upload API] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "An unexpected error occurred during upload." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Authentication required to delete assets." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { image_path } = body;

    if (!image_path || typeof image_path !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid image_path parameter." },
        { status: 400 }
      );
    }

    // Sanitization: Ensure path doesn't escape allowed folders (block path traversal)
    const cleanPath = image_path.replace(/^\/+/, "");
    const isValidFolder = ALLOWED_FOLDERS.some((f) => cleanPath.startsWith(`${f}/`));

    if (!isValidFolder) {
      return NextResponse.json(
        { success: false, error: "Invalid image path folder destination." },
        { status: 400 }
      );
    }

    const { error: removeError } = await supabase.storage
      .from("catalog-images")
      .remove([cleanPath]);

    if (removeError) {
      console.error("[Upload API] Storage remove error:", removeError);
      return NextResponse.json(
        { success: false, error: removeError.message || "Failed to delete image from storage." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deleted_path: cleanPath });
  } catch (err: any) {
    console.error("[Upload API] Delete error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "An error occurred during file deletion." },
      { status: 500 }
    );
  }
}

