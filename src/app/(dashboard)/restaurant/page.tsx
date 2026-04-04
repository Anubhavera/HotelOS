"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, timeAgo } from "@/lib/utils/formatters";
import type { RestaurantOrder } from "@/types/database";
import dashStyles from "../dashboard.module.css";

export default function RestaurantPage() {
  const { org } = useOrg();
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;
    fetchOrders();
  }, [org?.id]);

  async function fetchOrders() {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("restaurant_orders")
      .select("*, order_items(*)")
      .eq("org_id", org!.id)
      .gte("created_at", today)
      .order("created_at", { ascending: false });

    if (data) setOrders(data as unknown as RestaurantOrder[]);
    setLoading(false);
  }

  const activeOrders = orders.filter((o) => o.status === "active");
  const completedOrders = orders.filter((o) => o.status === "completed");
  const todayTotal = completedOrders.reduce((sum, o) => sum + o.total_amount, 0);

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Restaurant</h2>
          <p className={dashStyles["page-header__subtitle"]}>
            {activeOrders.length} active orders · Today&apos;s total: {formatCurrency(todayTotal)}
          </p>
        </div>
        <div className={dashStyles["page-header__actions"]}>
          <Button variant="secondary" onClick={() => window.location.href = "/dashboard/restaurant/menu"}>
            📋 Menu
          </Button>
          <Button variant="secondary" onClick={() => window.location.href = "/dashboard/restaurant/sales"}>
            📊 Sales Report
          </Button>
          <Button onClick={() => window.location.href = "/dashboard/restaurant/new-order"}>
            + New Order
          </Button>
        </div>
      </div>

      <div className={dashStyles["stats-grid"]} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: "var(--space-6)" }}>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Active Orders</div>
          <div className={dashStyles["stat-card__value"]}>{activeOrders.length}</div>
        </div>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Completed</div>
          <div className={dashStyles["stat-card__value"]}>{completedOrders.length}</div>
        </div>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Today&apos;s Revenue</div>
          <div className={dashStyles["stat-card__value"]}>{formatCurrency(todayTotal)}</div>
        </div>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Cancelled</div>
          <div className={dashStyles["stat-card__value"]}>{orders.filter((o) => o.status === "cancelled").length}</div>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />
      ) : orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-16)", color: "var(--text-tertiary)" }}>
          <div style={{ fontSize: "3rem", marginBottom: "var(--space-4)" }}>🍽️</div>
          <h3 style={{ color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>No orders today</h3>
          <p>Create your first order to start tracking sales</p>
        </div>
      ) : (
        <div className={dashStyles["stats-grid"]} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {orders.map((order) => (
            <div
              key={order.id}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-5)",
                animation: "slideUp var(--transition-slow) ease forwards",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>KOT #{order.kot_number}</span>
                <Badge
                  variant={order.status === "active" ? "info" : order.status === "completed" ? "success" : "error"}
                  dot
                  pulse={order.status === "active"}
                >
                  {order.status}
                </Badge>
              </div>
              {order.table_number && (
                <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
                  Table {order.table_number} · {order.order_type.replace("_", " ")}
                </div>
              )}
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: "var(--space-3)" }}>
                {timeAgo(order.created_at)}
                {order.items && ` · ${order.items.length} items`}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>
                  {formatCurrency(order.total_amount)}
                </span>
                {order.payment_mode && (
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                    {order.payment_mode}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
