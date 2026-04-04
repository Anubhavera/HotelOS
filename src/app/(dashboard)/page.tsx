import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils/formatters";
import styles from "./dashboard.module.css";

async function getDashboardStats(orgId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0];

  // Parallel queries for performance
  const [roomsRes, occupiedRes, todayOrdersRes, monthExpensesRes, monthBookingsRes] =
    await Promise.all([
      supabase.from("rooms").select("id", { count: "exact" }).eq("org_id", orgId),
      supabase
        .from("rooms")
        .select("id", { count: "exact" })
        .eq("org_id", orgId)
        .eq("status", "occupied"),
      supabase
        .from("restaurant_orders")
        .select("total_amount")
        .eq("org_id", orgId)
        .gte("created_at", today)
        .eq("status", "completed"),
      supabase
        .from("expenses")
        .select("total_amount")
        .eq("org_id", orgId)
        .gte("date", monthStart),
      supabase
        .from("bookings")
        .select("total_amount")
        .eq("org_id", orgId)
        .gte("created_at", monthStart)
        .eq("payment_status", "paid"),
    ]);

  const todayRevenue =
    todayOrdersRes.data?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
  const monthExpenses =
    monthExpensesRes.data?.reduce((sum, e) => sum + (e.total_amount || 0), 0) || 0;
  const monthRevenue =
    monthBookingsRes.data?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;

  return {
    totalRooms: roomsRes.count || 0,
    occupiedRooms: occupiedRes.count || 0,
    todayRevenue,
    todayOrders: todayOrdersRes.data?.length || 0,
    monthExpenses,
    monthRevenue: monthRevenue + todayRevenue,
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get user's org
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  const orgId = membership?.org_id;

  // Default stats if no org yet
  let stats = {
    totalRooms: 0,
    occupiedRooms: 0,
    todayRevenue: 0,
    todayOrders: 0,
    monthExpenses: 0,
    monthRevenue: 0,
  };

  if (orgId) {
    try {
      stats = await getDashboardStats(orgId);
    } catch {
      // Tables may not exist yet
    }
  }

  const occupancyRate =
    stats.totalRooms > 0
      ? Math.round((stats.occupiedRooms / stats.totalRooms) * 100)
      : 0;

  return (
    <>
      <div className={styles["stats-grid"]}>
        <div className={styles["stat-card"]}>
          <div className={styles["stat-card__icon"]}>🏨</div>
          <div className={styles["stat-card__label"]}>Room Occupancy</div>
          <div className={styles["stat-card__value"]}>
            {stats.occupiedRooms}/{stats.totalRooms}
          </div>
          <div
            className={`${styles["stat-card__change"]} ${
              occupancyRate > 70
                ? styles["stat-card__change--positive"]
                : styles["stat-card__change--negative"]
            }`}
          >
            {occupancyRate}% occupied
          </div>
        </div>

        <div className={styles["stat-card"]}>
          <div className={styles["stat-card__icon"]}>🍽️</div>
          <div className={styles["stat-card__label"]}>Today&apos;s Orders</div>
          <div className={styles["stat-card__value"]}>{stats.todayOrders}</div>
          <div
            className={`${styles["stat-card__change"]} ${styles["stat-card__change--positive"]}`}
          >
            {formatCurrency(stats.todayRevenue)} revenue
          </div>
        </div>

        <div className={styles["stat-card"]}>
          <div className={styles["stat-card__icon"]}>📈</div>
          <div className={styles["stat-card__label"]}>Month Revenue</div>
          <div className={styles["stat-card__value"]}>
            {formatCurrency(stats.monthRevenue)}
          </div>
          <div
            className={`${styles["stat-card__change"]} ${styles["stat-card__change--positive"]}`}
          >
            Rooms + Restaurant
          </div>
        </div>

        <div className={styles["stat-card"]}>
          <div className={styles["stat-card__icon"]}>🧾</div>
          <div className={styles["stat-card__label"]}>Month Expenses</div>
          <div className={styles["stat-card__value"]}>
            {formatCurrency(stats.monthExpenses)}
          </div>
          <div
            className={`${styles["stat-card__change"]} ${
              stats.monthRevenue > stats.monthExpenses
                ? styles["stat-card__change--positive"]
                : styles["stat-card__change--negative"]
            }`}
          >
            {stats.monthRevenue > stats.monthExpenses ? "Profit ↑" : "Loss ↓"}{" "}
            {formatCurrency(Math.abs(stats.monthRevenue - stats.monthExpenses))}
          </div>
        </div>
      </div>

      <div className={styles["content-grid"]}>
        <div className={styles["stat-card"]}>
          <div className={styles["stat-card__label"]}>Quick Actions</div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              marginTop: "var(--space-4)",
            }}
          >
            <a
              href="/dashboard/hotel/check-in"
              style={{
                padding: "var(--space-3) var(--space-4)",
                background: "var(--color-primary-subtle)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-primary)",
                fontWeight: 500,
                fontSize: "var(--text-sm)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
              }}
            >
              🏨 New Check-In
            </a>
            <a
              href="/dashboard/restaurant/new-order"
              style={{
                padding: "var(--space-3) var(--space-4)",
                background: "var(--color-accent-subtle)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-accent)",
                fontWeight: 500,
                fontSize: "var(--text-sm)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
              }}
            >
              🍽️ New Restaurant Order
            </a>
            <a
              href="/dashboard/expenses"
              style={{
                padding: "var(--space-3) var(--space-4)",
                background: "var(--color-info-subtle)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-info)",
                fontWeight: 500,
                fontSize: "var(--text-sm)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
              }}
            >
              🧾 Add Expense
            </a>
          </div>
        </div>

        <div className={styles["stat-card"]}>
          <div className={styles["stat-card__label"]}>Profit Overview</div>
          <div style={{ marginTop: "var(--space-4)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "var(--space-3)",
                fontSize: "var(--text-sm)",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>Revenue</span>
              <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
                {formatCurrency(stats.monthRevenue)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "var(--space-3)",
                fontSize: "var(--text-sm)",
              }}
            >
              <span style={{ color: "var(--text-secondary)" }}>Expenses</span>
              <span style={{ color: "var(--color-error)", fontWeight: 600 }}>
                {formatCurrency(stats.monthExpenses)}
              </span>
            </div>
            <div
              style={{
                height: "1px",
                background: "var(--border-default)",
                margin: "var(--space-3) 0",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "var(--text-base)",
                fontWeight: 700,
              }}
            >
              <span style={{ color: "var(--text-primary)" }}>Net Profit</span>
              <span
                style={{
                  color:
                    stats.monthRevenue > stats.monthExpenses
                      ? "var(--color-success)"
                      : "var(--color-error)",
                }}
              >
                {formatCurrency(stats.monthRevenue - stats.monthExpenses)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
