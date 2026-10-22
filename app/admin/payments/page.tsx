// app/admin/payments/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { Payment, Booking, Refund } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { nowInstant, mauritiusToday, startOfMauritiusDay } from "@/lib/time";
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
import { Plus, Search, Trash2, CreditCard, DollarSign, RefreshCcw, FileText } from "lucide-react";

export default function PaymentsPage() {
  const { user } = useUser();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form
  const [bookingId, setBookingId] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [paymentType, setPaymentType] = useState<"Credit Card" | "Cash" | "Stripe">("Credit Card");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [formError, setFormError] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, bRes, rRes] = await Promise.all([
        supabase.from("payment").select("*, booking(*, customer(*))").order("payment_id", { ascending: false }),
        supabase.from("booking").select("*, customer(*)").order("booking_id", { ascending: false }),
        supabase.from("refund").select("*, service_booking(*, service(*)), trip(*, tour(*))").order("refund_id", { ascending: false }),
      ]);

      if (pRes.data) setPayments(pRes.data);
      if (bRes.data) setBookings(bRes.data);
      if (rRes.data) setRefunds(rRes.data);
    } catch (err) {
      console.error("Fetch payment error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setSelectedPayment(null);
    setBookingId(bookings.length > 0 ? String(bookings[0].booking_id) : "");
    setPaymentDate(mauritiusToday());
    setPaymentType("Credit Card");
    setPaymentAmount("");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenDelete = (p: Payment) => {
    setSelectedPayment(p);
    setIsDeleteOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const numAmount = parseFloat(paymentAmount);
    if (!bookingId) {
      setFormError("Please select a booking.");
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError("Payment amount must be greater than 0.");
      return;
    }

    setIsSaving(true);
    const currentUserEmail = user?.primaryEmailAddress?.emailAddress || "admin@hbaoms.com";
    const now = nowInstant();
    const cleanPayDate = paymentDate.includes("T") ? paymentDate.split("T")[0] : paymentDate;

    try {
      const { error } = await supabase.from("payment").insert([
        {
          booking_booking_id: Number(bookingId),
          payment_date: startOfMauritiusDay(cleanPayDate),
          payment_type: paymentType,
          payment_method: paymentType === "Stripe" ? "ON" : "OFF",
          payment_amount: numAmount,
          created_by: currentUserEmail,
          date_created: now,
          updated_by_: currentUserEmail,
          date_updated: now,
        },
      ]);
      if (error) throw error;

      await fetchData();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Save payment error:", err);
      setFormError(err.message || "Failed to save payment.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPayment) return;
    setIsSaving(true);
    try {
      const pId = selectedPayment.payment_id || selectedPayment.pay_id;
      const { error } = await supabase.from("payment").delete().eq("payment_id", pId);
      if (error) throw error;
      await fetchData();
      setIsDeleteOpen(false);
    } catch (err) {
      console.error("Delete payment error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = payments.filter((p) => {
    const search = searchTerm.toLowerCase();
    const custName = `${p.booking?.customer?.cust_fname || ""} ${p.booking?.customer?.cust_lname || ""}`.toLowerCase();
    const pId = p.payment_id || p.pay_id;
    return String(pId).includes(search) || String(p.booking_booking_id).includes(search) || custName.includes(search);
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Payment Transactions & Item Refunds</h1>
          <p className="text-slate-500 text-sm">Financial logs, item-linked refunds, and revenue amounts in MUR.</p>
        </div>
        <Button onClick={handleOpenAdd} variant="gold" className="gap-2">
          <Plus className="h-4 w-4" /> Record Payment
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by Payment ID, Booking ID or Guest name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-white"
        />
      </div>

      {loading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : (
        <div className="space-y-8">
          {/* Section 1: Payments */}
          <div className="space-y-3">
            <h2 className="text-base font-bold text-[#1A202C] flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[#A37836]" /> Inward Payment Transactions
            </h2>

            <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Payment ID</th>
                    <th className="px-4 py-3">Booking & Guest</th>
                    <th className="px-4 py-3">Payment Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Amount (MUR)</th>
                    <th className="px-4 py-3">Linked Refunds</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No payment transactions found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => {
                      const pId = p.payment_id || p.pay_id;
                      const linkedRefunds = refunds.filter((r) => r.payment_payment_id === pId);

                      return (
                        <tr key={pId} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono font-bold text-navy-900">#{pId}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">
                              {p.booking?.customer ? `${p.booking.customer.cust_fname} ${p.booking.customer.cust_lname}` : "Guest"}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">Booking #{p.booking_booking_id}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(p.payment_date)}</td>
                          <td className="px-4 py-3 font-medium">
                            <Badge variant="outline" className="border-gold-400 text-gold-700 bg-gold-50">
                              {p.payment_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-600">
                            {formatCurrency(p.payment_amount || p.amount_paid || 0)}
                          </td>
                          <td className="px-4 py-3">
                            {linkedRefunds.length === 0 ? (
                              <span className="text-xs text-slate-400">None</span>
                            ) : (
                              <div className="space-y-1">
                                {linkedRefunds.map((ref) => (
                                  <Badge key={ref.refund_id} className="bg-red-50 text-red-700 border border-red-200 text-[10px] block py-0.5">
                                    Refund #{ref.refund_id}: -{formatCurrency(ref.refund_amount)} ({ref.item_type || "room"})
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(p)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-4">
              {filtered.map((p) => {
                const pId = p.payment_id || p.pay_id;
                return (
                  <div key={pId} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-xs text-gold-600">Payment #{pId}</span>
                      <span className="font-bold text-emerald-600">{formatCurrency(p.payment_amount)}</span>
                    </div>
                    <div className="font-bold text-navy-900">
                      {p.booking?.customer ? `${p.booking.customer.cust_fname} ${p.booking.customer.cust_lname}` : "Guest"}
                    </div>
                    <div className="text-xs text-slate-600 flex justify-between">
                      <span>Booking #{p.booking_booking_id}</span>
                      <span>Type: {p.payment_type}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-100 text-right">
                      <Button variant="destructive" size="sm" onClick={() => handleOpenDelete(p)}>Delete</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Processed Item Refunds Log (Decision F.3) */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h2 className="text-base font-bold text-[#1A202C] flex items-center gap-2">
              <RefreshCcw className="h-4 w-4 text-red-600" /> Item-Linked Refunds Log (Decision F.3)
            </h2>
            <p className="text-xs text-slate-500">
              Audited refund records linked directly to room cancellations, service add-ons, or excursion trips with proportional VAT.
            </p>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Refund ID</th>
                    <th className="px-4 py-3">Booking ID</th>
                    <th className="px-4 py-3">Linked Item</th>
                    <th className="px-4 py-3">Ladder %</th>
                    <th className="px-4 py-3">Refund Amount</th>
                    <th className="px-4 py-3">VAT Portion</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {refunds.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No refunds have been processed yet.
                      </td>
                    </tr>
                  ) : (
                    refunds.map((r) => {
                      let itemLabel = "Room Reservation";
                      if (r.item_type === "service") {
                        itemLabel = `Service: ${r.service_booking?.service?.service_name || `#${r.service_booking_id}`}`;
                      } else if (r.item_type === "trip") {
                        itemLabel = `Excursion: ${r.trip?.tour?.tour_name || `#${r.trip_trip_id}`}`;
                      }

                      return (
                        <tr key={r.refund_id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono font-bold text-red-700">#{r.refund_id}</td>
                          <td className="px-4 py-3 font-mono text-slate-700">Booking #{r.booking_booking_id}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            <Badge variant="outline" className="mr-1.5 uppercase text-[9px]">
                              {r.item_type || "room"}
                            </Badge>
                            {itemLabel}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700">
                            {r.refund_percentage || 100}%
                          </td>
                          <td className="px-4 py-3 font-bold text-red-700">
                            -{formatCurrency(r.refund_amount)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatCurrency(r.vat_amount || 0)}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {formatDate(r.refund_date)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Recording Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Record Payment Transaction</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {formError && <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded">{formError}</p>}

            <div className="space-y-2">
              <Label>Select Reservation *</Label>
              <Select value={bookingId} onValueChange={setBookingId}>
                <SelectTrigger><SelectValue placeholder="Choose booking..." /></SelectTrigger>
                <SelectContent>
                  {bookings.map((b) => (
                    <SelectItem key={b.booking_id} value={String(b.booking_id)}>
                      #{b.booking_id} - {b.customer ? `${b.customer.cust_fname} ${b.customer.cust_lname}` : "Guest"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Date *</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Channel *</Label>
                <Select value={paymentType} onValueChange={(val: any) => setPaymentType(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Stripe">Stripe Online</SelectItem>
                    <SelectItem value="Cash">Cash (Front Desk)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount (MUR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={isSaving}>
                {isSaving ? "Saving..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
