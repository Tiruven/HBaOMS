import { SignIn } from "@clerk/nextjs";
import { Hotel } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-900 px-4">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="p-3 rounded-xl bg-gold-500 text-navy-900 mb-3 shadow-lg">
          <Hotel className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-wide">
          HBaOMS Admin Access
        </h1>
        <p className="text-xs text-slate-300 mt-1">
          Hotel Booking and Operations Management System
        </p>
      </div>

      <SignIn
        appearance={{
          elements: {
            card: "shadow-2xl border border-slate-700 bg-white rounded-xl",
            buttonPrimary: "bg-navy-900 hover:bg-navy-800 text-white font-semibold",
          },
        }}
      />
    </div>
  );
}
