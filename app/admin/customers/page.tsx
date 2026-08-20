// app/admin/customers/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Customer } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { SkeletonTable } from "@/components/shared/SkeletonTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Trash2, Edit, UserCheck } from "lucide-react";

export default function CustomersPage() {
  const { user } = useUser();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form fields
  const [fname, setFname] = useState<string>("");
  const [lname, setLname] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [contactInfo, setContactInfo] = useState<string>("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [nationality, setNationality] = useState<string>("");
  const [passportNumber, setPassportNumber] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [formError, setFormError] = useState<string>("");

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer")
        .select("*")
        .order("cust_id", { ascending: false });

      if (error) throw error;
      if (data) setCustomers(data);
    } catch (err) {
      console.error("Fetch customers error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setSelectedCust(null);
    setFname("");
    setLname("");
    setEmail("");
    setContactInfo("");
    setGender("M");
    setNationality("Mauritian");
    setPassportNumber("");
    setCountry("Mauritius");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setSelectedCust(c);
    setFname(c.cust_fname);
    setLname(c.cust_lname);
    setEmail(c.email);
    setContactInfo(c.contact_info || "");
    setGender(c.gender || "M");
    setNationality(c.nationality || "");
    setPassportNumber(c.passport_number || "");
    setCountry(c.country || "");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenDelete = (c: Customer) => {
    setSelectedCust(c);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!fname || !lname || !email) {
      setFormError("First name, last name, and email are required.");
      return;
    }

    setIsSaving(true);
    const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";
    const now = new Date().toISOString();

    const payload = {
      cust_fname: fname,
      cust_lname: lname,
      email,
      contact_info: contactInfo,
      gender,
      nationality,
      passport_number: passportNumber || null,
      country: country || null,
      updated_by_: currentUserEmail,
      date_updated: now,
    };

    try {
      if (selectedCust) {
        const { error } = await supabase.from("customer").update(payload).eq("cust_id", selectedCust.cust_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customer").insert([
          {
            ...payload,
            created_by: currentUserEmail,
            date_created: now,
          },
        ]);
        if (error) throw error;
      }

      await fetchCustomers();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Save customer error:", err);
      setFormError(err.message || "Failed to save customer record.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCust) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("customer").delete().eq("cust_id", selectedCust.cust_id);
      if (error) throw error;
      await fetchCustomers();
      setIsDeleteOpen(false);
    } catch (err: any) {
      console.error("Delete customer error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = customers.filter((c) => {
    const search = searchTerm.toLowerCase();
    const fullName = `${c.cust_fname} ${c.cust_lname}`.toLowerCase();
    return fullName.includes(search) || c.email.toLowerCase().includes(search) || (c.nationality || "").toLowerCase().includes(search);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Customer Directory</h1>
          <p className="text-slate-500 text-sm">Registered guest profiles, contact details, and passport information.</p>
        </div>
        <Button onClick={handleOpenAdd} variant="gold" className="gap-2">
          <Plus className="h-4 w-4" /> Add Customer
        </Button>
      </div>

      {/* Filter */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by name, email or nationality..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {loading ? (
        <SkeletonTable rows={5} columns={8} />
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">First Name</th>
                  <th className="px-4 py-3">Last Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Nationality</th>
                  <th className="px-4 py-3">Passport #</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.cust_id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-navy-900">#{c.cust_id}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{c.cust_fname}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{c.cust_lname}</td>
                      <td className="px-4 py-3 text-slate-600">{c.email}</td>
                      <td className="px-4 py-3 text-slate-600">{c.nationality || "-"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{c.passport_number || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{c.country || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(c.date_created)}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(c)}>
                          <Edit className="h-4 w-4 text-slate-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(c)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {filtered.map((c) => (
              <div key={c.cust_id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-navy-900 text-base">{c.cust_fname} {c.cust_lname}</h3>
                  <span className="font-mono text-xs text-gold-600 font-bold">#{c.cust_id}</span>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div><strong>Email:</strong> {c.email}</div>
                  <div><strong>Nationality:</strong> {c.nationality || "-"}</div>
                  <div><strong>Passport:</strong> {c.passport_number || "-"}</div>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenEdit(c)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleOpenDelete(c)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCust ? "Edit Customer Profile" : "Register Customer"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {formError && <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded">{formError}</p>}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={fname} onChange={(e) => setFname(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={lname} onChange={(e) => setLname(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email Address *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Phone / Contact</Label>
                <Input value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={(val: any) => setGender(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Male (M)</SelectItem>
                    <SelectItem value="F">Female (F)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nationality</Label>
                <Input value={nationality} onChange={(e) => setNationality(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Passport Number (Optional)</Label>
                <Input value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Country (Optional)</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={isSaving}>
                {isSaving ? "Saving..." : selectedCust ? "Update Profile" : "Save Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete Customer</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Delete customer record for <strong>{selectedCust?.cust_fname} {selectedCust?.cust_lname}</strong>?
          </p>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
