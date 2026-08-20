// app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";
import { Hotel } from "lucide-react";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F7F4] px-4 py-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <Link href="/" className="p-3 rounded-2xl bg-[#A37836] text-white mb-3 shadow-lg hover:scale-105 transition-transform">
          <Hotel className="h-8 w-8" />
        </Link>
        <h1 className="text-2xl font-extrabold text-[#1A202C]">
          Create Guest Account
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Join Le Paradis Royal for seamless stay reservations and exclusive perks
        </p>
      </div>

      <SignUp
        forceRedirectUrl="/customer/dashboard"
        signInUrl="/sign-in"
        appearance={{
          elements: {
            card: "shadow-xl border border-[#E5E2DC] bg-white rounded-2xl p-6",
            buttonPrimary: "bg-[#A37836] hover:bg-[#8B6327] text-white font-semibold rounded-xl",
          },
        }}
      />
    </div>
  );
}
