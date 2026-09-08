// app/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Room, Service, Tour } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Hotel,
  Sparkles,
  BedDouble,
  ConciergeBell,
  Compass,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Star,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";

export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);

  useEffect(() => {
    async function fetchShowcase() {
      const [rRes, sRes, tRes] = await Promise.all([
        supabase.from("room").select("*, room_type(*), room_feature(feature(*))").eq("room_status", "Available").limit(3),
        supabase.from("service").select("*").limit(3),
        supabase.from("tour").select("*").limit(3),
      ]);
      if (rRes.data) setRooms(rRes.data);
      if (sRes.data) setServices(sRes.data);
      if (tRes.data) setTours(tRes.data);
    }
    fetchShowcase();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1A202C] font-sans antialiased">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#E5E2DC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#A37836] text-white shadow-md">
              <Hotel className="h-6 w-6" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-[#1A202C] block leading-none">
                Le Paradis Royal
              </span>
              <span className="text-[10px] text-[#A37836] font-semibold uppercase tracking-widest">
                Hotel & Ocean Spa • Mauritius
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-slate-600">
            <a href="#hero" className="hover:text-[#A37836] transition-colors">Overview</a>
            <a href="#rooms" className="hover:text-[#A37836] transition-colors">Accommodations</a>
            <a href="#services" className="hover:text-[#A37836] transition-colors">Spa & Services</a>
            <a href="#tours" className="hover:text-[#A37836] transition-colors">Island Tours</a>
          </nav>

          <div className="flex items-center space-x-3">
            {isSignedIn ? (
              <Button asChild className="bg-[#A37836] hover:bg-[#8B6327] text-white shadow-md gap-2 rounded-xl">
                <Link href="/customer/dashboard">
                  <Calendar className="h-4 w-4" /> Guest Portal
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="text-slate-700 hover:text-[#A37836]">
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild className="bg-[#A37836] hover:bg-[#8B6327] text-white shadow-md gap-2 rounded-xl">
                  <Link href="/sign-up">Book Your Stay</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="hero" className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-[#1A202C]">
        <img
          src="https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1920&q=80"
          alt="Le Paradis Royal Resort"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A202C] via-transparent to-[#1A202C]/60" />

        <div className="relative max-w-4xl mx-auto px-4 text-center text-white space-y-6 py-20">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
            An Unrivalled Haven of Serenity & Tropical Luxury
          </h1>
          <p className="text-lg sm:text-xl text-slate-200 font-light max-w-2xl mx-auto leading-relaxed">
            Immerse yourself in crystal waters, private beach villas, world-class dining, and tailored island excursions.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-[#A37836] hover:bg-[#8B6327] text-white px-8 py-6 text-base rounded-2xl shadow-xl font-bold gap-2">
              <Link href={isSignedIn ? "/customer/rooms" : "/sign-up"}>
                Explore Accommodations <ChevronRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 px-8 py-6 text-base rounded-2xl font-bold backdrop-blur-sm">
              <a href="#rooms">View Resort Details</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Accommodations Showcase */}
      <section id="rooms" className="max-w-7xl mx-auto px-4 py-20 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-bold text-[#A37836] uppercase tracking-widest">Handcrafted Suites & Villas</span>
          <h2 className="text-3xl font-extrabold text-[#1A202C]">Accommodations Suited for Royalty</h2>
          <p className="text-slate-600 text-sm">Every suite is designed with natural elegance, ocean panoramas, and total privacy.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {rooms.map((room) => {
            const type = room.room_type?.type || "Deluxe Suite";
            const price = room.room_type?.price || 6000;
            return (
              <div key={room.room_id} className="bg-white rounded-2xl border border-[#E5E2DC] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
                <div>
                  <div className="h-52 bg-slate-100 relative">
                    <img
                      src={
                        type === "Villa"
                          ? "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?auto=format&fit=crop&w=800&q=80"
                          : type === "Suite"
                          ? "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80"
                          : "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=80"
                      }
                      alt={type}
                      className="w-full h-full object-cover"
                    />
                    <Badge className="absolute top-3 right-3 bg-[#A37836] text-white">
                      {type}
                    </Badge>
                  </div>
                  <div className="p-6 space-y-3">
                    <h3 className="font-bold text-xl text-[#1A202C]">{type} Room #{room.room_id}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {room.room_desc || "Spacious suite featuring king bed, private terrace, rainforest shower, and ocean view."}
                    </p>
                  </div>
                </div>
                <div className="p-6 pt-0 border-t border-slate-100 flex items-center justify-between mt-4">
                  <div>
                    <span className="text-xl font-extrabold text-[#1A202C]">{formatCurrency(price)}</span>
                    <span className="text-xs text-slate-500"> / night</span>
                  </div>
                  <Button asChild size="sm" className="bg-[#A37836] hover:bg-[#8B6327] text-white rounded-xl">
                    <Link href={isSignedIn ? "/customer/rooms" : "/sign-up"}>Reserve</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Spa & Resort Services */}
      <section id="services" className="bg-white py-20 border-y border-[#E5E2DC]">
        <div className="max-w-7xl mx-auto px-4 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold text-[#A37836] uppercase tracking-widest">Resort Amenities & Dining</span>
            <h2 className="text-3xl font-extrabold text-[#1A202C]">Bespoke Services & Holistic Wellness</h2>
            <p className="text-slate-600 text-sm">Elevate your stay with signature massages, beachside dining, and luxury concierge assistance.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {services.map((srv) => (
              <div key={srv.service_id} className="bg-[#F8F7F4] p-6 rounded-2xl border border-[#E5E2DC] space-y-4">
                <div className="p-3 w-12 h-12 rounded-xl bg-[#F4EFE6] text-[#A37836] flex items-center justify-center">
                  <ConciergeBell className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg text-[#1A202C]">{srv.service_name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{srv.service_desc || "Indulge in premium service experiences tailored for resort guests."}</p>
                <div className="pt-2 font-bold text-[#A37836]">{formatCurrency(srv.price)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Island Tours Excursions */}
      <section id="tours" className="max-w-7xl mx-auto px-4 py-20 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-bold text-[#A37836] uppercase tracking-widest">Mauritian Island Excursions</span>
          <h2 className="text-3xl font-extrabold text-[#1A202C]">Discover the Wonders of Mauritius</h2>
          <p className="text-slate-600 text-sm">Guided catamaran cruises, dolphin snorkeling, and inland botanical explorations.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tours.map((t) => (
            <div key={t.tour_id} className="bg-white p-6 rounded-2xl border border-[#E5E2DC] shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-xl bg-[#F4EFE6] text-[#A37836]">
                  <Compass className="h-6 w-6" />
                </div>
                <Badge variant="outline" className="border-[#A37836] text-[#A37836]">
                  {t.durations} Hours
                </Badge>
              </div>
              <h3 className="font-bold text-lg text-[#1A202C]">{t.tour_name}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{t.tour_desc}</p>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                <div>Adult: <strong className="text-[#1A202C]">{formatCurrency(t.adult_price)}</strong></div>
                <div>Child: <strong className="text-[#1A202C]">{formatCurrency(t.child_price)}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1A202C] text-white py-16 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-[#A37836] text-white">
                <Hotel className="h-5 w-5" />
              </div>
              <span className="font-extrabold text-lg">Le Paradis Royal</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Grand Baie Coastal Road, Mauritius. A luxury beach sanctuary offering unrivaled hospitality.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-sm text-[#A37836] uppercase tracking-wider mb-4">Quick Links</h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li><Link href="/customer/rooms" className="hover:text-white">Browse Rooms</Link></li>
              <li><Link href="/sign-in" className="hover:text-white">Customer Sign In</Link></li>
              <li><Link href="/admin/dashboard" className="hover:text-white">Admin Portal</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm text-[#A37836] uppercase tracking-wider mb-4">Resort Contact</h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#A37836]" /> Grand Baie, Mauritius</li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-[#A37836]" /> +230 200 8888</li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#A37836]" /> concierge@leparadisroyal.mu</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-sm text-[#A37836] uppercase tracking-wider mb-4">Reservations</h4>
            <p className="text-xs text-slate-400 mb-4">Ready for your tropical escape?</p>
            <Button asChild className="w-full bg-[#A37836] hover:bg-[#8B6327] text-white rounded-xl">
              <Link href="/sign-up">Book Now</Link>
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
