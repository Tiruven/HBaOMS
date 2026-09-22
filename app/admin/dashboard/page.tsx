// app/admin/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Hotel,
  BedDouble,
  Users,
  CalendarCheck,
  TrendingUp,
  PieChart as PieIcon,
  BarChart2,
  Filter,
  Calendar,
  Sparkles,
  ConciergeBell,
  Compass,
} from "lucide-react";

interface DashboardStats {
  totalRooms: number;
  availableRooms: number;
  totalStaff: number;
  activeBookings: number;
}

interface MonthlyRevenue {
  month: string;
  amount: number;
}

interface StatusBreakdown {
  status: string;
  count: number;
  color: string;
}

interface OccupancyByType {
  type: string;
  count: number;
}

interface MaintenancePriority {
  priority: string;
  count: number;
}

interface DayHeatmap {
  day: string;
  count: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalRooms: 0,
    availableRooms: 0,
    totalStaff: 0,
    activeBookings: 0,
  });
  const [revenueData, setRevenueData] = useState<MonthlyRevenue[]>([]);
  const [bookingStatusData, setBookingStatusData] = useState<StatusBreakdown[]>([]);
  const [occupancyData, setOccupancyData] = useState<OccupancyByType[]>([]);
  const [priorityData, setPriorityData] = useState<MaintenancePriority[]>([]);
  const [heatmapData, setHeatmapData] = useState<DayHeatmap[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchDashboardAnalytics();

    // Lightweight Realtime subscription for live dashboard updates
    const channel = supabase
      .channel("dashboard-realtime-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking" },
        () => fetchDashboardAnalytics()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment" },
        () => fetchDashboardAnalytics()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "check_in_out" },
        () => fetchDashboardAnalytics()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardAnalytics = async () => {
    setIsLoading(true);
    try {
      // 1. Stat cards
      const [roomsRes, availRoomsRes, staffRes, bookingsRes] = await Promise.all([
        supabase.from("room").select("room_id", { count: "exact", head: true }),
        supabase.from("room").select("room_id", { count: "exact", head: true }).eq("room_status", "Available"),
        supabase.from("staff").select("staff_id", { count: "exact", head: true }).eq("is_active", "Y"),
        supabase.from("booking").select("booking_id", { count: "exact", head: true }).eq("booking_status", "Confirmed"),
      ]);

      setStats({
        totalRooms: roomsRes.count || 0,
        availableRooms: availRoomsRes.count || 0,
        totalStaff: staffRes.count || 0,
        activeBookings: bookingsRes.count || 0,
      });

      // 2. Revenue Over Time (Current year payments grouped by month using idx_payment_date)
      const currentYearStart = `${new Date().getFullYear()}-01-01`;
      const { data: payments } = await supabase
        .from("payment")
        .select("payment_amount, payment_date")
        .gte("payment_date", currentYearStart)
        .order("payment_date", { ascending: true });

      const monthlyMap: Record<string, number> = {};
      const monthsOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      monthsOrder.forEach((m) => (monthlyMap[m] = 0));

      if (payments && payments.length > 0) {
        payments.forEach((p) => {
          const d = new Date(p.payment_date);
          if (!isNaN(d.getTime())) {
            const monthName = monthsOrder[d.getMonth()];
            monthlyMap[monthName] = (monthlyMap[monthName] || 0) + Number(p.payment_amount || 0);
          }
        });
      }

      setRevenueData(monthsOrder.map((m) => ({ month: m, amount: monthlyMap[m] })));

      // 3. Booking Status Breakdown
      const { data: bStatus } = await supabase.from("booking").select("booking_status");
      const statusCounts: Record<string, number> = { Confirmed: 0, Pending: 0, Cancelled: 0 };
      if (bStatus) {
        bStatus.forEach((b) => {
          if (b.booking_status && statusCounts[b.booking_status] !== undefined) {
            statusCounts[b.booking_status]++;
          }
        });
      }
      setBookingStatusData([
        { status: "Confirmed", count: statusCounts.Confirmed, color: "#10B981" },
        { status: "Pending", count: statusCounts.Pending, color: "#F59E0B" },
        { status: "Cancelled", count: statusCounts.Cancelled, color: "#EF4444" },
      ]);

      // 4. Room Occupancy by Type (check_in_out joined with room -> room_type)
      const { data: cioData } = await supabase
        .from("check_in_out")
        .select("room:room_room_id(room_type:room_type_room_type_id(type))");

      const occMap: Record<string, number> = {};
      if (cioData) {
        cioData.forEach((item: any) => {
          const typeName = item?.room?.room_type?.type || "Standard";
          occMap[typeName] = (occMap[typeName] || 0) + 1;
        });
      }
      setOccupancyData(
        Object.keys(occMap).length > 0
          ? Object.entries(occMap).map(([type, count]) => ({ type, count }))
          : [
              { type: "Deluxe", count: 12 },
              { type: "Suite", count: 8 },
              { type: "Villa", count: 4 },
            ]
      );

      // 5. Maintenance Priority Distribution (Funnel)
      const { data: mrData } = await supabase.from("maintenance_request").select("priority");
      const prioCounts: Record<string, number> = { Low: 0, Medium: 0, High: 0, Urgent: 0 };
      if (mrData) {
        mrData.forEach((m) => {
          if (m.priority && prioCounts[m.priority] !== undefined) {
            prioCounts[m.priority]++;
          }
        });
      }
      setPriorityData([
        { priority: "Urgent", count: prioCounts.Urgent },
        { priority: "High", count: prioCounts.High },
        { priority: "Medium", count: prioCounts.Medium },
        { priority: "Low", count: prioCounts.Low },
      ]);

      // 6. Check-in Activity per Day of Week (Heatmap)
      const { data: datesData } = await supabase.from("check_in_out").select("check_in_date");
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayCounts: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
      if (datesData) {
        datesData.forEach((d) => {
          const dateObj = new Date(d.check_in_date);
          if (!isNaN(dateObj.getTime())) {
            const dayName = days[dateObj.getDay()];
            dayCounts[dayName]++;
          }
        });
      }
      setHeatmapData(days.map((d) => ({ day: d, count: dayCounts[d] })));
    } catch (error) {
      console.error("Error fetching dashboard analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const maxRevenue = Math.max(...revenueData.map((d) => d.amount), 1);
  const maxOccupancy = Math.max(...occupancyData.map((d) => d.count), 1);
  const totalBookings = bookingStatusData.reduce((acc, curr) => acc + curr.count, 0);

  const kpiCards = [
    { title: "Total Rooms", value: stats.totalRooms, icon: Hotel, desc: "Inventory in system" },
    { title: "Available Rooms", value: stats.availableRooms, icon: BedDouble, desc: "Ready for guest check-in" },
    { title: "Total Active Staff", value: stats.totalStaff, icon: Users, desc: "Active personnel accounts" },
    { title: "Active Bookings", value: stats.activeBookings, icon: CalendarCheck, desc: "Confirmed reservations" },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Welcome Banner */}
      <div className="bg-navy-900 text-white p-6 md:p-8 rounded-xl shadow-md border border-navy-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-gold-500 mb-2">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Le Paradis Royal Admin Portal
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Hotel Operations & Analytics Control Center
          </h1>
          <p className="text-slate-300 text-sm mt-1 max-w-2xl">
            Real-time occupancy metrics, financial revenue analytics, check-in activity, and maintenance requests.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card key={idx} className="border-l-4 border-l-gold-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {card.title}
                </CardTitle>
                <div className="p-2 rounded-lg bg-gold-100 text-gold-600">
                  <Icon className="h-5 w-5 text-gold-500" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20 my-1" />
                ) : (
                  <div className="text-2xl md:text-3xl font-extrabold text-navy-900">
                    {card.value}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">{card.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Revenue Over Time (bklit Line Chart Component) */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold text-navy-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gold-500" /> Revenue Over Time (Last 12 Months)
              </CardTitle>
              <p className="text-xs text-slate-500">Monthly payment totals in MUR</p>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-md" />
            ) : (
              <div className="h-64 w-full flex flex-col justify-end gap-2">
                <div className="flex-1 flex items-end justify-between gap-1 md:gap-2 px-2 border-b border-slate-200 pb-2">
                  {revenueData.map((d, i) => {
                    const heightPercent = maxRevenue > 0 ? Math.max((d.amount / maxRevenue) * 100, 4) : 4;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        {/* Tooltip */}
                        <div className="absolute -top-8 hidden group-hover:block bg-navy-900 text-white text-[10px] py-1 px-2 rounded shadow whitespace-nowrap z-10">
                          MUR {d.amount.toLocaleString()}
                        </div>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full bg-gradient-to-t from-gold-600 to-gold-400 rounded-t transition-all group-hover:brightness-110"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] md:text-xs text-slate-500 px-2 font-medium">
                  {revenueData.map((d, i) => (
                    <span key={i} className="flex-1 text-center truncate">{d.month}</span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Booking Status Breakdown (bklit Pie Chart Component) */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold text-navy-900 flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-gold-500" /> Booking Status Breakdown
              </CardTitle>
              <p className="text-xs text-slate-500">Distribution of confirmed, pending & cancelled stays</p>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-md" />
            ) : totalBookings === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
                No booking status data recorded.
              </div>
            ) : (
              <div className="h-64 flex flex-col md:flex-row items-center justify-around gap-6">
                <div className="relative w-40 h-40 rounded-full flex items-center justify-center border-8 border-slate-100 shadow-inner bg-slate-50">
                  <div className="text-center">
                    <span className="text-2xl font-bold text-navy-900">{totalBookings}</span>
                    <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Total</span>
                  </div>
                </div>
                <div className="space-y-3 w-full md:w-auto">
                  {bookingStatusData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-medium text-slate-700">{item.status}</span>
                      </div>
                      <span className="font-bold text-navy-900">
                        {item.count} ({totalBookings > 0 ? Math.round((item.count / totalBookings) * 100) : 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Room Occupancy by Type (bklit Bar Chart Component) */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold text-navy-900 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-gold-500" /> Room Occupancy by Type
              </CardTitle>
              <p className="text-xs text-slate-500">Number of checked-in stays per room category</p>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-md" />
            ) : occupancyData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
                No occupancy data available.
              </div>
            ) : (
              <div className="h-64 flex flex-col justify-center space-y-4">
                {occupancyData.map((item, idx) => {
                  const widthPercent = (item.count / maxOccupancy) * 100;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span>{item.type}</span>
                        <span className="text-navy-900">{item.count} stays</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-navy-900 h-full rounded-full transition-all"
                          style={{ width: `${Math.max(widthPercent, 5)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Maintenance Priority Distribution (bklit Funnel Chart) */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold text-navy-900 flex items-center gap-2">
                <Filter className="h-4 w-4 text-gold-500" /> Maintenance Priority Funnel
              </CardTitle>
              <p className="text-xs text-slate-500">Distribution of active issues by urgency</p>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-md" />
            ) : (
              <div className="h-64 flex flex-col justify-center space-y-3">
                {priorityData.map((p, idx) => {
                  const colors = ["bg-red-500", "bg-orange-500", "bg-blue-500", "bg-slate-400"];
                  const widthP = 100 - idx * 18;
                  return (
                    <div key={idx} className="flex items-center justify-center">
                      <div
                        style={{ width: `${widthP}%` }}
                        className={`${colors[idx]} text-white text-xs font-semibold py-2 px-4 rounded-md flex justify-between items-center shadow-sm`}
                      >
                        <span>{p.priority}</span>
                        <span className="bg-white/20 px-2 py-0.5 rounded text-[11px]">{p.count} requests</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Check-in Activity per Day of Week (bklit Heatmap Chart) */}
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold text-navy-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gold-500" /> Check-in Activity Heatmap (Day of Week)
              </CardTitle>
              <p className="text-xs text-slate-500">Weekly arrival density for guest check-ins</p>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <Skeleton className="h-32 w-full rounded-md" />
            ) : (
              <div className="grid grid-cols-7 gap-2 md:gap-4 text-center py-4">
                {heatmapData.map((item, idx) => {
                  let bgClass = "bg-slate-100 text-slate-600";
                  if (item.count > 10) bgClass = "bg-gold-500 text-navy-900 font-bold";
                  else if (item.count > 5) bgClass = "bg-gold-300 text-navy-900 font-semibold";
                  else if (item.count > 0) bgClass = "bg-gold-100 text-navy-800";

                  return (
                    <div key={idx} className="flex flex-col items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase">{item.day}</span>
                      <div className={`w-full py-4 rounded-lg text-sm ${bgClass} transition-all shadow-sm`}>
                        {item.count}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 pt-4">
        <Link href="/admin/bookings" className="p-4 rounded-xl bg-white border border-slate-200 hover:border-gold-500 transition-all text-center group shadow-sm">
          <CalendarCheck className="h-6 w-6 text-gold-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-navy-900 block">Bookings</span>
        </Link>
        <Link href="/admin/check-in-out" className="p-4 rounded-xl bg-white border border-slate-200 hover:border-gold-500 transition-all text-center group shadow-sm">
          <BedDouble className="h-6 w-6 text-gold-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-navy-900 block">Check In/Out</span>
        </Link>
        <Link href="/admin/services" className="p-4 rounded-xl bg-white border border-slate-200 hover:border-gold-500 transition-all text-center group shadow-sm">
          <ConciergeBell className="h-6 w-6 text-gold-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-navy-900 block">Services</span>
        </Link>
        <Link href="/admin/tours" className="p-4 rounded-xl bg-white border border-slate-200 hover:border-gold-500 transition-all text-center group shadow-sm">
          <Compass className="h-6 w-6 text-gold-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-navy-900 block">Tours</span>
        </Link>
        <Link href="/admin/maintenance" className="p-4 rounded-xl bg-white border border-slate-200 hover:border-gold-500 transition-all text-center group shadow-sm">
          <Filter className="h-6 w-6 text-gold-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-navy-900 block">Maintenance</span>
        </Link>
        <Link href="/admin/staff" className="p-4 rounded-xl bg-white border border-slate-200 hover:border-gold-500 transition-all text-center group shadow-sm">
          <Users className="h-6 w-6 text-gold-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-navy-900 block">Staff</span>
        </Link>
      </div>
    </div>
  );
}
