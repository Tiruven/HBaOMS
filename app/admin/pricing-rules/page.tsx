// app/admin/pricing-rules/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { PricingRule, RoomType } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { SkeletonTable } from "@/components/shared/SkeletonTable";
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
import { Plus, Search, Trash2, Edit, Tag, AlertTriangle } from "lucide-react";

export default function PricingRulesPage() {
  const { user } = useUser();
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [selectedPR, setSelectedPR] = useState<PricingRule | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form
  const [roomTypeId, setRoomTypeId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [rateOverride, setRateOverride] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [inlineError, setInlineError] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prRes, rtRes] = await Promise.all([
        supabase.from("pricing_rule").select("*, room_type(*)").order("pr_id", { ascending: false }),
        supabase.from("room_type").select("*").order("type", { ascending: true }),
      ]);

      if (prRes.data) setRules(prRes.data);
      if (rtRes.data) setRoomTypes(rtRes.data);
    } catch (err) {
      console.error("Fetch pricing rules error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setSelectedPR(null);
    setRoomTypeId(roomTypes.length > 0 ? String(roomTypes[0].room_type_id) : "");
    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    setStartDate(today);
    setEndDate(nextWeek);
    setRateOverride("20");
    setReason("Peak Season Surcharge");
    setInlineError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pr: PricingRule) => {
    setSelectedPR(pr);
    setRoomTypeId(String(pr.room_type_room_type_id));
    setStartDate(pr.start_date.split("T")[0]);
    setEndDate(pr.end_date.split("T")[0]);
    setRateOverride(String(pr.rate_override));
    setReason(pr.reason || "");
    setInlineError("");
    setIsModalOpen(true);
  };

  const handleOpenDelete = (pr: PricingRule) => {
    setSelectedPR(pr);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError("");

    const numRate = parseFloat(rateOverride);
    if (!roomTypeId) {
      setInlineError("Please select a room type.");
      return;
    }
    if (!startDate || !endDate) {
      setInlineError("Start date and end date are required.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setInlineError("End date must be on or after start date.");
      return;
    }
    if (isNaN(numRate) || numRate === 0) {
      setInlineError("Rate override percentage cannot be zero.");
      return;
    }

    // Application validation: detect overlapping date range for the same room_type_id
    try {
      const { data: existingRules, error: queryError } = await supabase
        .from("pricing_rule")
        .select("*")
        .eq("room_type_room_type_id", Number(roomTypeId));

      if (queryError) throw queryError;

      const hasOverlap = (existingRules || []).some((r) => {
        if (selectedPR && r.pr_id === selectedPR.pr_id) return false;
        return new Date(startDate) <= new Date(r.end_date) && new Date(endDate) >= new Date(r.start_date);
      });

      if (hasOverlap) {
        setInlineError(`Date range overlap detected! An active pricing rule already exists for this room type in the selected window.`);
        return;
      }

      setIsSaving(true);
      const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";
      const now = new Date().toISOString();

      if (selectedPR) {
        const { error } = await supabase
          .from("pricing_rule")
          .update({
            room_type_room_type_id: Number(roomTypeId),
            start_date: startDate,
            end_date: endDate,
            rate_override: numRate,
            reason,
            updated_by_: currentUserEmail,
            date_updated: now,
          })
          .eq("pr_id", selectedPR.pr_id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("pricing_rule").insert([
          {
            room_type_room_type_id: Number(roomTypeId),
            start_date: startDate,
            end_date: endDate,
            rate_override: numRate,
            reason,
            created_by: currentUserEmail,
            date_created: now,
            updated_by_: currentUserEmail,
            date_updated: now,
          },
        ]);

        if (error) throw error;
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Save PR error:", err);
      setInlineError(err.message || "Failed to save pricing rule.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPR) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("pricing_rule").delete().eq("pr_id", selectedPR.pr_id);
      if (error) throw error;
      await fetchData();
      setIsDeleteOpen(false);
    } catch (err) {
      console.error("Delete PR error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = rules.filter((r) => {
    const search = searchTerm.toLowerCase();
    const typeName = (r.room_type?.type || "").toLowerCase();
    return String(r.pr_id).includes(search) || typeName.includes(search) || (r.reason || "").toLowerCase().includes(search);
  });

  const formatOverride = (rate: number) => {
    const prefix = rate > 0 ? "+" : "";
    return `${prefix}${rate}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Dynamic Pricing Rules</h1>
          <p className="text-slate-500 text-sm">Configure seasonal price multipliers (+30%, -20%) and date range overrides.</p>
        </div>
        <Button onClick={handleOpenAdd} variant="gold" className="gap-2">
          <Plus className="h-4 w-4" /> Add Pricing Rule
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by Room Type or reason..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {loading ? (
        <SkeletonTable rows={5} columns={7} />
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Rule ID</th>
                  <th className="px-4 py-3">Room Type</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Override %</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      No pricing rules defined.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.pr_id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-navy-900">#{r.pr_id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{r.room_type?.type || "Standard"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(r.start_date)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(r.end_date)}</td>
                      <td className="px-4 py-3 font-bold">
                        <Badge
                          className={r.rate_override > 0 ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"}
                        >
                          {formatOverride(r.rate_override)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs max-w-xs truncate">{r.reason || "-"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{r.created_by || "System"}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(r)}>
                          <Edit className="h-4 w-4 text-slate-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(r)}>
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
            {filtered.map((r) => (
              <div key={r.pr_id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-navy-900">{r.room_type?.type}</span>
                  <Badge className={r.rate_override > 0 ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"}>
                    {formatOverride(r.rate_override)}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div><strong>Window:</strong> {formatDate(r.start_date)} to {formatDate(r.end_date)}</div>
                  <div><strong>Reason:</strong> {r.reason || "-"}</div>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenEdit(r)}>Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleOpenDelete(r)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle>{selectedPR ? "Edit Pricing Rule" : "Add Pricing Rule"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {inlineError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Validation Error</strong>
                  {inlineError}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Target Room Type *</Label>
              <Select value={roomTypeId} onValueChange={setRoomTypeId}>
                <SelectTrigger><SelectValue placeholder="Choose room type..." /></SelectTrigger>
                <SelectContent>
                  {roomTypes.map((rt) => (
                    <SelectItem key={rt.room_type_id} value={String(rt.room_type_id)}>
                      {rt.type} (Base Price: MUR {rt.price})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rate Override % (+30 for surcharge, -20 for discount) *</Label>
              <Input
                type="number"
                step="1"
                placeholder="e.g. 25 or -15"
                value={rateOverride}
                onChange={(e) => setRateOverride(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Reason / Event Description</Label>
              <Input
                placeholder="e.g. Christmas Peak Season"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={isSaving}>
                {isSaving ? "Saving..." : selectedPR ? "Update Rule" : "Save Rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete Pricing Rule</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Delete pricing rule <strong>#{selectedPR?.pr_id}</strong> for {selectedPR?.room_type?.type}?
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
