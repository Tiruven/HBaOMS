// app/admin/staff/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Staff, StaffRole, ALL_STAFF_ROLES } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { SkeletonTable } from "@/components/shared/SkeletonTable";
import {
  UserPlus,
  Search,
  UserCheck,
  UserX,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Pencil,
} from "lucide-react";

interface CustomerCandidate {
  cust_id: number;
  cust_fname: string;
  cust_lname: string;
  email: string;
  contact_info: string;
  clerk_user_id?: string | null;
  date_created?: string | null;
  isAlreadyStaff?: boolean;
}

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [customers, setCustomers] = useState<CustomerCandidate[]>([]);
  const [currentAdminStaffId, setCurrentAdminStaffId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // "Add staff from existing account" Modal
  const [isPromoteOpen, setIsPromoteOpen] = useState<boolean>(false);
  const [custSearch, setCustSearch] = useState<string>("");
  const [selectedCust, setSelectedCust] = useState<CustomerCandidate | null>(null);
  const [selectedRole, setSelectedRole] = useState<StaffRole>("Receptionist");
  const [promoteError, setPromoteError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Edit Role Modal
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editRoleValue, setEditRoleValue] = useState<StaffRole>("Receptionist");
  const [editError, setEditError] = useState<string>("");

  const fetchStaffData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load staff directory");
      setStaffList(json.staff || []);
      setCustomers(json.customers || []);
      setCurrentAdminStaffId(json.currentAdminStaffId ?? null);
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Error loading staff list" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);

  const handleOpenPromote = () => {
    setCustSearch("");
    setSelectedCust(null);
    setSelectedRole("Receptionist");
    setPromoteError("");
    setIsPromoteOpen(true);
  };

  const handleConfirmPromote = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoteError("");
    if (!selectedCust) {
      setPromoteError("Please search and pick an existing customer account.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          custId: selectedCust.cust_id,
          role: selectedRole,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add staff member");

      setFeedback({
        type: "success",
        text: json.message || `${selectedCust.cust_fname} promoted to ${selectedRole}.`,
      });
      setIsPromoteOpen(false);
      await fetchStaffData();
    } catch (err: any) {
      setPromoteError(err.message || "Failed to promote account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (member: Staff) => {
    const nextActive = member.is_active === "Y" ? "N" : "Y";
    setFeedback(null);
    try {
      const res = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: member.staff_id,
          is_active: nextActive,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update status");
      setFeedback({
        type: "success",
        text: `${member.staff_fname} ${member.staff_lname} is now ${nextActive === "Y" ? "Active" : "Inactive"}.`,
      });
      await fetchStaffData();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message });
    }
  };

  const handleOpenEditRole = (member: Staff) => {
    setEditingStaff(member);
    setEditRoleValue(member.role);
    setEditError("");
  };

  const handleSaveRoleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setEditError("");
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: editingStaff.staff_id,
          role: editRoleValue,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update role");
      setFeedback({
        type: "success",
        text: `Updated role for ${editingStaff.staff_fname} ${editingStaff.staff_lname} to ${editRoleValue}.`,
      });
      setEditingStaff(null);
      await fetchStaffData();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStaff = staffList.filter((s) => {
    const q = searchTerm.toLowerCase();
    const fullName = `${s.staff_fname} ${s.staff_lname}`.toLowerCase();
    return (
      fullName.includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.role || "").toLowerCase().includes(q)
    );
  });

  const filteredCandidates = customers.filter((c) => {
    const q = custSearch.trim().toLowerCase();
    const fullName = `${c.cust_fname} ${c.cust_lname}`.toLowerCase();
    if (!q) return true;
    return fullName.includes(q) || (c.email || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Staff Directory & Onboarding</h1>
          <p className="text-slate-500 text-sm">
            Promote registered Clerk accounts to supervisor roles and manage active access (accounts are deactivated, never deleted).
          </p>
        </div>
        <Button onClick={handleOpenPromote} variant="gold" className="gap-2">
          <UserPlus className="h-4 w-4" /> Add Staff from Existing Account
        </Button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="font-bold ml-3">
            x
          </button>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search staff by name, email, or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {loading ? (
        <SkeletonTable rows={5} columns={7} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Staff Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated By</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No staff records found.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => {
                  const isSelf = member.staff_id === currentAdminStaffId;
                  return (
                    <tr key={member.staff_id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-navy-900">#{member.staff_id}</td>
                      <td className="px-4 py-3 font-semibold text-navy-900">
                        {member.staff_fname} {member.staff_lname}
                        {isSelf && (
                          <Badge variant="outline" className="ml-2 text-[10px] border-gold-400 text-gold-700">
                            You
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="bg-gold-500 text-navy-900 text-[11px] font-bold">
                          {member.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{member.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={member.is_active === "Y" ? "success" : "destructive"}>
                          {member.is_active === "Y" ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <div>{member.updated_by_ || member.created_by || "System"}</div>
                        <div className="text-[10px] text-slate-400">{formatDate(member.date_updated || member.date_created)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEditRole(member)}
                            disabled={isSelf}
                            title={isSelf ? "You cannot demote your own Admin role" : "Change role"}
                            className="h-7 px-2 text-xs gap-1"
                          >
                            <Pencil className="h-3 w-3" /> Role
                          </Button>
                          <Button
                            size="sm"
                            variant={member.is_active === "Y" ? "outline" : "gold"}
                            onClick={() => handleToggleActive(member)}
                            disabled={isSelf}
                            title={
                              isSelf
                                ? "You cannot deactivate your own Admin account"
                                : member.is_active === "Y"
                                ? "Remove portal access without deleting history"
                                : "Restore staff access"
                            }
                            className="h-7 px-2 text-xs gap-1"
                          >
                            {member.is_active === "Y" ? (
                              <>
                                <UserX className="h-3 w-3 text-red-600" /> Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3 w-3 text-emerald-700" /> Activate
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Staff From Existing Account Modal */}
      <Dialog open={isPromoteOpen} onOpenChange={setIsPromoteOpen}>
        <DialogContent className="sm:max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gold-500" /> Add Staff from Existing Account
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleConfirmPromote} className="space-y-4 pt-2">
            <p className="text-xs text-slate-500">
              Select a person who has already registered with Clerk (so their email is verified and no typo can occur), then assign their department role.
            </p>

            {promoteError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
                {promoteError}
              </div>
            )}

            <div className="space-y-2">
              <Label>1. Search and Pick Customer Account *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Type customer name or email to filter..."
                  value={custSearch}
                  onChange={(e) => setCustSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto divide-y">
                {filteredCandidates.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No matching customer accounts found. Ask the staff member to register through Clerk first.
                  </div>
                ) : (
                  filteredCandidates.map((cust) => {
                    const isPicked = selectedCust?.cust_id === cust.cust_id;
                    return (
                      <button
                        type="button"
                        key={cust.cust_id}
                        disabled={cust.isAlreadyStaff}
                        onClick={() => setSelectedCust(cust)}
                        className={`w-full text-left px-3 py-2.5 text-xs flex items-center justify-between transition-colors ${
                          cust.isAlreadyStaff
                            ? "bg-slate-50 text-slate-400 cursor-not-allowed"
                            : isPicked
                            ? "bg-gold-50 border-l-4 border-l-gold-500 text-navy-900"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <div className="font-bold">
                            {cust.cust_fname} {cust.cust_lname}
                          </div>
                          <div className="text-slate-500">{cust.email}</div>
                        </div>
                        {cust.isAlreadyStaff ? (
                          <Badge variant="outline" className="text-[10px]">Already in Staff</Badge>
                        ) : isPicked ? (
                          <Badge className="bg-gold-500 text-navy-900 text-[10px]">Selected</Badge>
                        ) : (
                          <span className="text-[11px] text-gold-700 font-semibold">Select</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>2. Assign Department Role *</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as StaffRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STAFF_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPromoteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" disabled={isSubmitting || !selectedCust}>
                {isSubmitting ? "Adding Staff..." : "Confirm & Grant Staff Access"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={Boolean(editingStaff)} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Update Role: {editingStaff?.staff_fname} {editingStaff?.staff_lname}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveRoleChange} className="space-y-4 pt-2">
            {editError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs font-semibold">
                {editError}
              </div>
            )}
            <div className="space-y-2">
              <Label>Department Role</Label>
              <Select value={editRoleValue} onValueChange={(v) => setEditRoleValue(v as StaffRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STAFF_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingStaff(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="gold" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
