"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import type { RestaurantOrder } from "@/types/database";
import dashStyles from "../../dashboard.module.css";

export default function SalesPage() {
  const { org } = useOrg();
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    if (!org?.id) return;
    fetchSales();
  }, [org?.id, dateFilter]);

  async function fetchSales() {
    setLoading(true);
    const supabase = createClient();
    const nextDay = new Date(dateFilter);
    nextDay.setDate(nextDay.getDate() + 1);

    const { data } = await supabase
      .from("restaurant_orders")
      .select("*, order_items(*)")
      .eq("org_id", org!.id)
      .gte("created_at", dateFilter)
      .lt("created_at", nextDay.toISOString().split("T")[0])
      .in("status", ["completed", "cancelled"])
      .order("created_at", { ascending: false });

    if (data) setOrders(data as unknown as RestaurantOrder[]);
    setLoading(false);
  }

  const completed = orders.filter((o) => o.status === "completed");
  const cancelled = orders.filter((o) => o.status === "cancelled");
  const totalSales = completed.reduce((s, o) => s + o.total_amount, 0);
  const cancelledTotal = cancelled.reduce((s, o) => s + o.total_amount, 0);

  const cashTotal = completed.filter((o) => o.payment_mode === "cash").reduce((s, o) => s + o.total_amount, 0);
  const upiTotal = completed.filter((o) => o.payment_mode === "upi").reduce((s, o) => s + o.total_amount, 0);
  const cardTotal = completed.filter((o) => o.payment_mode === "card").reduce((s, o) => s + o.total_amount, 0);

  const columns = [
    { key: "kot_number", header: "KOT #", render: (o: RestaurantOrder) => `#${o.kot_number}` },
    { key: "items", header: "Items", render: (o: RestaurantOrder) => o.items?.map((i) => `${i.item_name} ×${i.quantity}`).join(", ") || "—" },
    { key: "payment_mode", header: "Payment", render: (o: RestaurantOrder) => o.payment_mode?.toUpperCase() || "—" },
    { key: "total_amount", header: "Amount", render: (o: RestaurantOrder) => formatCurrency(o.total_amount) },
    { key: "status", header: "Status", render: (o: RestaurantOrder) => (
      <Badge variant={o.status === "completed" ? "success" : "error"}>{o.status}</Badge>
    )},
  ];

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Sales Report</h2>
          <p className={dashStyles["page-header__subtitle"]}>{formatDate(dateFilter)}</p>
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          style={{
            padding: "var(--space-3) var(--space-4)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-primary)",
            fontSize: "var(--text-sm)",
          }}
        />
      </div>

      <div className={dashStyles["stats-grid"]}>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Total Sales</div>
          <div className={dashStyles["stat-card__value"]}>{formatCurrency(totalSales)}</div>
          <div className={`${dashStyles["stat-card__change"]} ${dashStyles["stat-card__change--positive"]}`}>
            {completed.length} orders
          </div>
        </div>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Cash</div>
          <div className={dashStyles["stat-card__value"]}>{formatCurrency(cashTotal)}</div>
        </div>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>UPI</div>
          <div className={dashStyles["stat-card__value"]}>{formatCurrency(upiTotal)}</div>
        </div>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Card</div>
          <div className={dashStyles["stat-card__value"]}>{formatCurrency(cardTotal)}</div>
        </div>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Cancelled</div>
          <div className={dashStyles["stat-card__value"]} style={{ color: "var(--color-error)" }}>{formatCurrency(cancelledTotal)}</div>
          <div className={`${dashStyles["stat-card__change"]} ${dashStyles["stat-card__change--negative"]}`}>
            {cancelled.length} orders
          </div>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />
      ) : (
        <Table columns={columns} data={orders as unknown as Record<string, unknown>[]} emptyMessage="No sales for this date" emptyIcon="📊" />
      )}
    </>
  );
}
