import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "HBaOMS - Hotel Management System Admin",
  description: "Hotel Booking and Operations Management System Admin Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-background text-slate-900 min-h-screen">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
