// app/admin/notifications/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Notification } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { SkeletonTable } from "@/components/shared/SkeletonTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Search, RefreshCw, CheckCircle, Clock, AlertCircle } from "lucide-react";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notification")
        .select("*, customer(*), booking(*)")
        .order("notif_id", { ascending: false });

      if (error) throw error;
      if (data) setNotifications(data);
    } catch (err) {
      console.error("Fetch notifications error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (notif_id: number, newStatus: "Pending" | "Sent" | "Failed") => {
    setUpdatingId(notif_id);
    try {
      const { error } = await supabase
        .from("notification")
        .update({ notif_status: newStatus, date_updated: new Date().toISOString() })
        .eq("notif_id", notif_id);

      if (error) throw error;
      await fetchNotifications();
    } catch (err) {
      console.error("Status update error:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResend = async (notif_id: number) => {
    // Sets status back to Pending to trigger background job
    await handleStatusChange(notif_id, "Pending");
  };

  const filtered = notifications.filter((n) => {
    const search = searchTerm.toLowerCase();
    const custName = `${n.customer?.cust_fname || ""} ${n.customer?.cust_lname || ""}`.toLowerCase();
    return String(n.notif_id).includes(search) || custName.includes(search) || n.notif_type.toLowerCase().includes(search);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Sent":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1"><CheckCircle className="h-3 w-3" /> Sent</Badge>;
      case "Pending":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "Failed":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white gap-1"><AlertCircle className="h-3 w-3" /> Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">System Notifications</h1>
          <p className="text-slate-500 text-sm">Read-only system log of customer emails, booking confirmations & reminders.</p>
        </div>
        <Badge variant="outline" className="px-3 py-1.5 text-slate-600 border-slate-300 w-fit">
          System Generated
        </Badge>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by Notification ID, Guest name or Type..."
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
                  <th className="px-4 py-3">Notif ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Booking ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Sent Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No notification logs found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((n) => (
                    <tr key={n.notif_id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-navy-900">#{n.notif_id}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {n.customer ? `${n.customer.cust_fname} ${n.customer.cust_lname}` : "Guest"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        #{n.booking_booking_id}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{n.notif_type}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(n.sent_date)}</td>
                      <td className="px-4 py-3">
                        <Select
                          value={n.notif_status}
                          onValueChange={(val: any) => handleStatusChange(n.notif_id, val)}
                          disabled={updatingId === n.notif_id}
                        >
                          <SelectTrigger className="h-8 w-32 border-none p-0 bg-transparent">
                            <SelectValue>{getStatusBadge(n.notif_status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Sent">Sent</SelectItem>
                            <SelectItem value="Failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResend(n.notif_id)}
                          disabled={updatingId === n.notif_id}
                          className="gap-1 text-xs"
                        >
                          <RefreshCw className={`h-3 w-3 ${updatingId === n.notif_id ? "animate-spin" : ""}`} /> Resend
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-4">
            {filtered.map((n) => (
              <div key={n.notif_id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-xs text-gold-600">Notif #{n.notif_id}</span>
                  {getStatusBadge(n.notif_status)}
                </div>
                <div className="font-bold text-navy-900">
                  {n.customer ? `${n.customer.cust_fname} ${n.customer.cust_lname}` : "Guest"}
                </div>
                <div className="text-xs text-slate-600">
                  <div><strong>Type:</strong> {n.notif_type}</div>
                  <div><strong>Booking:</strong> #{n.booking_booking_id}</div>
                </div>
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => handleResend(n.notif_id)} className="gap-1 text-xs">
                    <RefreshCw className="h-3 w-3" /> Resend
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
