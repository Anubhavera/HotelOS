"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import dashStyles from "../../../dashboard.module.css";

export default function CalendarPage() {
  const { org } = useOrg();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dailyData, setDailyData] = useState<Record<string, { revenue: number; expenses: number }>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    if (!org?.id) return;
    fetchCalendarData();
  }, [org?.id, selectedMonth]);

  async function fetchCalendarData() {
    setLoading(true);
    const supabase = createClient();
    const monthStart = `${selectedMonth}-01`;
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEnd = nextMonth.toISOString().split("T")[0];

    const [ordersRes, bookingsRes, expensesRes] = await Promise.all([
      supabase.from("restaurant_orders").select("total_amount, created_at").eq("org_id", org!.id).eq("status", "completed").gte("created_at", monthStart).lt("created_at", monthEnd),
      supabase.from("bookings").select("total_amount, check_in").eq("org_id", org!.id).eq("payment_status", "paid").gte("check_in", monthStart).lt("check_in", monthEnd),
      supabase.from("expenses").select("total_amount, date").eq("org_id", org!.id).gte("date", monthStart).lt("date", monthEnd),
    ]);

    const data: Record<string, { revenue: number; expenses: number }> = {};

    ordersRes.data?.forEach((o) => {
      const day = o.created_at.split("T")[0];
      if (!data[day]) data[day] = { revenue: 0, expenses: 0 };
      data[day].revenue += o.total_amount || 0;
    });

    bookingsRes.data?.forEach((b) => {
      const day = b.check_in.split("T")[0];
      if (!data[day]) data[day] = { revenue: 0, expenses: 0 };
      data[day].revenue += b.total_amount || 0;
    });

    expensesRes.data?.forEach((e) => {
      if (!data[e.date]) data[e.date] = { revenue: 0, expenses: 0 };
      data[e.date].expenses += e.total_amount || 0;
    });

    setDailyData(data);
    setLoading(false);
  }

  // Generate calendar grid
  const monthDate = new Date(`${selectedMonth}-01`);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  const maxRevenue = Math.max(...Object.values(dailyData).map((d) => d.revenue), 1);

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Calendar View</h2>
          <p className={dashStyles["page-header__subtitle"]}>Daily revenue heatmap</p>
        </div>
        <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{
          padding: "var(--space-3) var(--space-4)", background: "var(--bg-secondary)", border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "var(--text-sm)",
        }} />
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 400, borderRadius: "var(--radius-lg)" }} />
      ) : (
        <div className={dashStyles["content-grid"]}>
          {/* Calendar */}
          <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "var(--space-1)", marginBottom: "var(--space-2)" }}>
              {dayNames.map((d) => (
                <div key={d} style={{ textAlign: "center", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)", padding: "var(--space-2)" }}>
                  {d}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "var(--space-1)" }}>
              {cells.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} />;
                const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
                const data = dailyData[dateStr];
                const intensity = data ? Math.min(data.revenue / maxRevenue, 1) : 0;
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDay;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDay(dateStr === selectedDay ? null : dateStr)}
                    style={{
                      aspectRatio: "1",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "var(--radius-md)",
                      border: isSelected ? "2px solid var(--color-primary)" : isToday ? "2px solid var(--border-hover)" : "1px solid transparent",
                      background: intensity > 0 ? `rgba(13, 148, 136, ${0.1 + intensity * 0.5})` : "var(--bg-secondary)",
                      cursor: "pointer",
                      transition: "all var(--transition-fast)",
                      fontSize: "var(--text-sm)",
                      fontWeight: isToday ? 700 : 400,
                      color: "var(--text-primary)",
                    }}
                  >
                    {day}
                    {data && data.revenue > 0 && (
                      <span style={{ fontSize: "7px", color: "var(--color-primary)", fontWeight: 600, marginTop: 1 }}>
                        {data.revenue >= 1000 ? `${(data.revenue / 1000).toFixed(0)}k` : data.revenue}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day details */}
          <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
            {selectedDay ? (
              <>
                <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-4)" }}>
                  {formatDate(selectedDay, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </h3>
                {dailyData[selectedDay] ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3)", background: "var(--color-success-subtle)", borderRadius: "var(--radius-md)" }}>
                      <span>Revenue</span>
                      <span style={{ fontWeight: 700, color: "var(--color-success)" }}>{formatCurrency(dailyData[selectedDay].revenue)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3)", background: "var(--color-error-subtle)", borderRadius: "var(--radius-md)" }}>
                      <span>Expenses</span>
                      <span style={{ fontWeight: 700, color: "var(--color-error)" }}>{formatCurrency(dailyData[selectedDay].expenses)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3)", fontWeight: 700, borderTop: "1px solid var(--border-default)", paddingTop: "var(--space-4)" }}>
                      <span>Profit</span>
                      <span style={{ color: (dailyData[selectedDay].revenue - dailyData[selectedDay].expenses) >= 0 ? "var(--color-success)" : "var(--color-error)" }}>
                        {formatCurrency(dailyData[selectedDay].revenue - dailyData[selectedDay].expenses)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: "var(--text-tertiary)" }}>No transactions on this day</p>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--text-tertiary)" }}>
                <div style={{ fontSize: "2rem", marginBottom: "var(--space-3)" }}>📅</div>
                <p>Click on a date to see details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
