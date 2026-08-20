// app/customer/profile/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Customer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, ShieldCheck, Save, CheckCircle, AlertCircle } from "lucide-react";

export default function CustomerProfilePage() {
  const { user } = useUser();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Editable Form fields
  const [contactInfo, setContactInfo] = useState<string>("");
  const [nationality, setNationality] = useState<string>("");
  const [passportNumber, setPassportNumber] = useState<string>("");
  const [country, setCountry] = useState<string>("");

  useEffect(() => {
    async function fetchProfile() {
      if (!user?.primaryEmailAddress?.emailAddress) return;
      setLoading(true);
      const email = user.primaryEmailAddress.emailAddress;

      try {
        const { data, error } = await supabase.from("customer").select("*").eq("email", email).single();

        if (data) {
          setCustomer(data);
          setContactInfo(data.contact_info || "");
          setNationality(data.nationality || "Mauritian");
          setPassportNumber(data.passport_number || "");
          setCountry(data.country || "Mauritius");
        } else {
          // If no customer record exists yet in DB for logged in user, prepopulate from Clerk
          const newCust = {
            cust_fname: user.firstName || "Guest",
            cust_lname: user.lastName || "User",
            email: email,
            contact_info: "",
            nationality: "Mauritian",
            passport_number: "",
            country: "Mauritius",
          };
          setContactInfo("");
          setNationality("Mauritian");
          setPassportNumber("");
          setCountry("Mauritius");
        }
      } catch (err) {
        console.error("Fetch profile error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");
    setSaving(true);

    try {
      const email = user?.primaryEmailAddress?.emailAddress;
      if (!email) throw new Error("No user email address found.");

      const payload = {
        cust_fname: user?.firstName || "Guest",
        cust_lname: user?.lastName || "User",
        email: email,
        contact_info: contactInfo,
        nationality: nationality,
        passport_number: passportNumber,
        country: country,
      };

      if (customer) {
        const { error } = await supabase.from("customer").update(payload).eq("cust_id", customer.cust_id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("customer").insert([payload]).select().single();
        if (error) throw error;
        if (inserted) setCustomer(inserted);
      }

      setSuccessMsg("Profile updated successfully!");
    } catch (err: any) {
      console.error("Update profile error:", err);
      setErrorMsg(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#F4EFE6] text-[#A37836]">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#1A202C]">Guest Account Profile</h1>
            <p className="text-slate-500 text-xs">Manage your passport details, contact number, and country preferences.</p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-2 text-xs font-bold">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-2 text-xs font-bold">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border border-[#E5E2DC] shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-bold text-slate-700">First Name</Label>
            <Input value={user?.firstName || ""} disabled className="bg-slate-100 border-slate-200 text-slate-500" />
          </div>
          <div className="space-y-2">
            <Label className="font-bold text-slate-700">Last Name</Label>
            <Input value={user?.lastName || ""} disabled className="bg-slate-100 border-slate-200 text-slate-500" />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-bold text-slate-700">Account Email</Label>
          <Input value={user?.primaryEmailAddress?.emailAddress || ""} disabled className="bg-slate-100 border-slate-200 text-slate-500" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-bold text-slate-700">Phone Contact Number</Label>
            <Input
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="e.g. +230 5700 1234"
              className="bg-[#F8F7F4] border-[#E5E2DC]"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-bold text-slate-700">Nationality</Label>
            <Input
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              placeholder="e.g. Mauritian / French"
              className="bg-[#F8F7F4] border-[#E5E2DC]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="font-bold text-slate-700">Passport Number</Label>
            <Input
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
              placeholder="e.g. N12345678"
              className="bg-[#F8F7F4] border-[#E5E2DC]"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-bold text-slate-700">Country of Residence</Label>
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Mauritius"
              className="bg-[#F8F7F4] border-[#E5E2DC]"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <Button type="submit" disabled={saving} className="bg-[#A37836] hover:bg-[#8B6327] text-white rounded-xl gap-2 font-bold px-6">
            <Save className="h-4 w-4" /> {saving ? "Saving Changes..." : "Save Profile Details"}
          </Button>
        </div>
      </form>
    </div>
  );
}
