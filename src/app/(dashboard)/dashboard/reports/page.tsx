"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import dashStyles from "../../dashboard.module.css";

interface WeekData {
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export default function ReportsPage() {
  const { org } = useOrg();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([]);
  const [totals, setTotals] = useState({ revenue: 0, roomRevenue: 0, restaurantRevenue: 0, expenses: 0, salaries: 0, utilities: 0, profit: 0 });

  useEffect(() => {
    if (!org?.id) return;
    fetchReport();
  }, [org?.id, selectedMonth]);

  async function fetchReport() {
    setLoading(true);
    const supabase = createClient();
    const monthStart = `${selectedMonth}-01`;
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEnd = nextMonth.toISOString().split("T")[0];

    const [bookingsRes, ordersRes, expensesRes, salariesRes, utilitiesRes] = await Promise.all([
      supabase.from("bookings").select("total_amount, check_in").eq("org_id", org!.id).eq("payment_status", "paid").gte("check_in", monthStart).lt("check_in", monthEnd),
      supabase.from("restaurant_orders").select("total_amount, created_at").eq("org_id", org!.id).eq("status", "completed").gte("created_at", monthStart).lt("created_at", monthEnd),
      supabase.from("expenses").select("total_amount, date").eq("org_id", org!.id).gte("date", monthStart).lt("date", monthEnd),
      supabase.from("salaries").select("monthly_salary").eq("org_id", org!.id).eq("payment_month", monthStart),
      supabase.from("utility_bills").select("amount").eq("org_id", org!.id).eq("paid", true).gte("created_at", monthStart).lt("created_at", monthEnd),
    ]);

    const roomRevenue = bookingsRes.data?.reduce((s, b) => s + (b.total_amount || 0), 0) || 0;
    const restaurantRevenue = ordersRes.data?.reduce((s, o) => s + (o.total_amount || 0), 0) || 0;
    const totalExpenses = expensesRes.data?.reduce((s, e) => s + (e.total_amount || 0), 0) || 0;
    const totalSalaries = salariesRes.data?.reduce((s, sal) => s + (sal.monthly_salary || 0), 0) || 0;
    const totalUtilities = utilitiesRes.data?.reduce((s, u) => s + (u.amount || 0), 0) || 0;
    const totalRevenue = roomRevenue + restaurantRevenue;
    const allExpenses = totalExpenses + totalSalaries + totalUtilities;

    setTotals({ revenue: totalRevenue, roomRevenue, restaurantRevenue, expenses: totalExpenses, salaries: totalSalaries, utilities: totalUtilities, profit: totalRevenue - allExpenses });

    // Build weekly breakdown
    const weeks: WeekData[] = [];
    const start = new Date(monthStart);
    const end = new Date(monthEnd);
    let weekStart = new Date(start);
    let weekNum = 1;

    while (weekStart < end) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      if (weekEnd > end) weekEnd.setTime(end.getTime());

      const ws = weekStart.toISOString().split("T")[0];
      const we = weekEnd.toISOString().split("T")[0];

      const weekRevenue =
        (bookingsRes.data?.filter((b) => b.check_in >= ws && b.check_in < we).reduce((s, b) => s + (b.total_amount || 0), 0) || 0) +
        (ordersRes.data?.filter((o) => o.created_at >= ws && o.created_at < we).reduce((s, o) => s + (o.total_amount || 0), 0) || 0);

      const weekExpense = expensesRes.data?.filter((e) => e.date >= ws && e.date < we).reduce((s, e) => s + (e.total_amount || 0), 0) || 0;

      weeks.push({
        label: `Week ${weekNum} (${formatDate(ws, { day: "numeric", month: "short" })} - ${formatDate(we, { day: "numeric", month: "short" })})`,
        revenue: weekRevenue,
        expenses: weekExpense,
        profit: weekRevenue - weekExpense,
      });

      weekStart = weekEnd;
      weekNum++;
    }

    setWeeklyData(weeks);
    setLoading(false);
  }

  const allExpenses = totals.expenses + totals.salaries + totals.utilities;

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Month-End Report</h2>
          <p className={dashStyles["page-header__subtitle"]}>
            {formatDate(`${selectedMonth}-01`, { month: "long", year: "numeric" })}
          </p>
        </div>
        <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{
          padding: "var(--space-3) var(--space-4)", background: "var(--bg-secondary)", border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "var(--text-sm)",
        }} />
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 400, borderRadius: "var(--radius-lg)" }} />
      ) : (
        <>
          {/* Top stats */}
          <div className={dashStyles["stats-grid"]}>
            <div className={dashStyles["stat-card"]} style={{ borderLeft: "4px solid var(--color-success)" }}>
              <div className={dashStyles["stat-card__icon"]}>💰</div>
              <div className={dashStyles["stat-card__label"]}>Total Revenue</div>
              <div className={dashStyles["stat-card__value"]}>{formatCurrency(totals.revenue)}</div>
            </div>
            <div className={dashStyles["stat-card"]} style={{ borderLeft: "4px solid var(--color-error)" }}>
              <div className={dashStyles["stat-card__icon"]}>🧾</div>
              <div className={dashStyles["stat-card__label"]}>Total Expenses</div>
              <div className={dashStyles["stat-card__value"]}>{formatCurrency(allExpenses)}</div>
            </div>
            <div className={dashStyles["stat-card"]} style={{ borderLeft: `4px solid ${totals.profit >= 0 ? "var(--color-success)" : "var(--color-error)"}` }}>
              <div className={dashStyles["stat-card__icon"]}>{totals.profit >= 0 ? "📈" : "📉"}</div>
              <div className={dashStyles["stat-card__label"]}>Net Profit/Loss</div>
              <div className={dashStyles["stat-card__value"]} style={{ color: totals.profit >= 0 ? "var(--color-success)" : "var(--color-error)" }}>
                {formatCurrency(totals.profit)}
              </div>
            </div>
          </div>

          {/* Revenue breakdown */}
          <div className={dashStyles["content-grid"]} style={{ marginBottom: "var(--space-6)" }}>
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-4)" }}>Revenue Breakdown</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
                  <span>🏨 Room Revenue</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(totals.roomRevenue)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
                  <span>🍽️ Restaurant Revenue</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(totals.restaurantRevenue)}</span>
                </div>
              </div>
            </div>
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-4)" }}>Expense Breakdown</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
                  <span>🧾 Purchases & Supplies</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(totals.expenses)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
                  <span>💰 Salaries</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(totals.salaries)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)" }}>
                  <span>⚡ Utility Bills</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(totals.utilities)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly breakdown */}
          <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-4)" }}>Weekly Breakdown</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {weeklyData.map((week) => (
                <div key={week.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "var(--space-3) var(--space-4)", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)",
                }}>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>{week.label}</span>
                  <div style={{ display: "flex", gap: "var(--space-6)", fontSize: "var(--text-sm)" }}>
                    <span style={{ color: "var(--color-success)" }}>↑ {formatCurrency(week.revenue)}</span>
                    <span style={{ color: "var(--color-error)" }}>↓ {formatCurrency(week.expenses)}</span>
                    <span style={{ fontWeight: 700, color: week.profit >= 0 ? "var(--color-success)" : "var(--color-error)" }}>
                      = {formatCurrency(week.profit)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
