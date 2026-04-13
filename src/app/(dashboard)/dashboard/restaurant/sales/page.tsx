"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/formatters";
import type { RestaurantOrder } from "@/types/database";
import dashStyles from "../../../dashboard.module.css";
import { BarChart3, Receipt } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A bill row displayed in the sales table = 1 bill_group_id + its KOTs */
interface BillRow {
  billId: string;           // bill_group_id (or KOT id for legacy rows)
  billRef: string;          // Display label e.g. "Bill A", "Bill B"
  tableNumber: string | null;
  customerName: string;
  paymentMode: string;
  paymentReference: string | null;
  kotNumbers: number[];
  kotCount: number;
  itemsSummary: string;
  itemCount: number;
  serviceDurationMs: number;
  closeDurationMs: number;
  timingEstimated: boolean;
  totalAmount: number;
  openedAt: string;
  completedAt: string;
  status: "completed" | "cancelled";
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${totalMinutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const { org } = useOrg();
  const [completedOrders, setCompletedOrders] = useState<RestaurantOrder[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<RestaurantOrder[]>([]);
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

    if (data) {
      const rows = data as unknown as RestaurantOrder[];
      setCompletedOrders(rows.filter((o) => o.status === "completed"));
      setCancelledOrders(rows.filter((o) => o.status === "cancelled"));
    }
    setLoading(false);
  }

  // ── Group completed KOTs into bills ──────────────────────────────────────────

  /**
   * Collapse completed KOTs into bill-level display rows.
   * KOTs sharing the same bill_group_id → single row.
   * Legacy KOTs with no bill_group_id → each gets its own row.
   */
  function buildBillRows(orders: RestaurantOrder[]): BillRow[] {
    const billMap = new Map<string, RestaurantOrder[]>();
    for (const o of orders) {
      const key = o.bill_group_id ?? o.id;
      if (!billMap.has(key)) billMap.set(key, []);
      billMap.get(key)!.push(o);
    }

    const rows: BillRow[] = [];
    let billCounter = 0;
    for (const [billId, kots] of billMap.entries()) {
      billCounter++;
      const first = kots[0];
      const createdAtList = kots.map((k) => new Date(k.created_at).getTime());
      const completedAtList = kots.map((k) => new Date(k.completed_at ?? k.created_at).getTime());
      const preparedAtList = kots
        .map((k) => (k.prepared_at ? new Date(k.prepared_at).getTime() : null))
        .filter((value): value is number => value !== null);

      const openedAtMs = Math.min(...createdAtList);
      const servedAtMs = preparedAtList.length > 0 ? Math.max(...preparedAtList) : Math.max(...createdAtList);
      const closedAtMs = Math.max(...completedAtList);

      const itemTotals = new Map<string, number>();
      let itemCount = 0;
      for (const kot of kots) {
        for (const item of kot.items || []) {
          itemTotals.set(item.item_name, (itemTotals.get(item.item_name) || 0) + item.quantity);
          itemCount += item.quantity;
        }
      }
      const itemParts = [...itemTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, qty]) => `${name} x${qty}`);
      const itemsSummary = itemParts.length > 0
        ? `${itemParts.slice(0, 4).join(", ")}${itemParts.length > 4 ? ` +${itemParts.length - 4} more` : ""}`
        : "—";

      // Each KOT in the same bill shares the same payment details
      rows.push({
        billId,
        billRef: `Bill ${String.fromCharCode(64 + billCounter)}`, // Bill A, Bill B, …
        tableNumber: first.table_number,
        customerName: first.customer_name ?? "Walk-in",
        paymentMode: first.payment_mode ?? "—",
        paymentReference: first.payment_reference,
        kotNumbers: kots.map((k) => k.kot_number).sort((a, b) => a - b),
        kotCount: kots.length,
        itemsSummary,
        itemCount,
        serviceDurationMs: Math.max(0, servedAtMs - openedAtMs),
        closeDurationMs: Math.max(0, closedAtMs - servedAtMs),
        timingEstimated: preparedAtList.length === 0,
        totalAmount: kots.reduce((s, k) => s + k.total_amount, 0),
        openedAt: new Date(openedAtMs).toISOString(),
        completedAt: new Date(closedAtMs).toISOString(),
        status: "completed",
      });
    }
    return rows.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }

  // ── Summaries ─────────────────────────────────────────────────────────────────

  const billRows = buildBillRows(completedOrders);
  const totalSales = billRows.reduce((s, b) => s + b.totalAmount, 0);
  const cancelledTotal = cancelledOrders.reduce((s, o) => s + o.total_amount, 0);

  const cashTotal = billRows.filter((b) => b.paymentMode === "cash").reduce((s, b) => s + b.totalAmount, 0);
  const upiTotal  = billRows.filter((b) => b.paymentMode === "upi").reduce((s, b) => s + b.totalAmount, 0);
  const cardTotal = billRows.filter((b) => b.paymentMode === "card").reduce((s, b) => s + b.totalAmount, 0);

  // ── Table columns ─────────────────────────────────────────────────────────────

  const billColumns = [
    {
      key: "billRef",
      header: "Bill",
      render: (b: BillRow) => (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Receipt size={14} style={{ flexShrink: 0, color: "var(--color-primary)" }} />
          <span style={{ fontWeight: 600 }}>{b.billRef}</span>
        </div>
      ),
    },
    {
      key: "tableNumber",
      header: "Table",
      render: (b: BillRow) => b.tableNumber ? `Table ${b.tableNumber}` : "Walk-in",
    },
    {
      key: "customerName",
      header: "Customer",
      render: (b: BillRow) => b.customerName,
    },
    {
      key: "itemsSummary",
      header: "Items Ordered",
      render: (b: BillRow) => (
        <div>
          <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{b.itemsSummary}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            {b.itemCount} item{b.itemCount !== 1 ? "s" : ""}
          </div>
        </div>
      ),
    },
    {
      key: "kots",
      header: "KOTs",
      render: (b: BillRow) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {b.kotNumbers.map((n) => `#${n}`).join(", ")}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            {b.kotCount} ticket{b.kotCount > 1 ? "s" : ""}
          </div>
        </div>
      ),
    },
    {
      key: "serviceDurationMs",
      header: "Served In",
      render: (b: BillRow) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{formatDuration(b.serviceDurationMs)}</div>
          {b.timingEstimated && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>estimated</div>
          )}
        </div>
      ),
    },
    {
      key: "closeDurationMs",
      header: "Closed In",
      render: (b: BillRow) => (
        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
          {formatDuration(b.closeDurationMs)}
        </span>
      ),
    },
    {
      key: "paymentMode",
      header: "Payment",
      render: (b: BillRow) => (
        <div>
          <Badge variant={b.paymentMode === "cash" ? "neutral" : "info"}>
            {b.paymentMode.toUpperCase()}
          </Badge>
          {b.paymentReference && (
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>
              {b.paymentReference}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "totalAmount",
      header: "Bill Total",
      render: (b: BillRow) => (
        <span style={{ fontWeight: 700, color: "var(--color-primary)" }}>
          {formatCurrency(b.totalAmount)}
        </span>
      ),
    },
    {
      key: "completedAt",
      header: "Closed At",
      render: (b: BillRow) => (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
          Opened {formatDateTime(b.openedAt)}
          <br />
          {formatDateTime(b.completedAt)}
        </span>
      ),
    },
  ];

  const cancelColumns = [
    { key: "kot_number", header: "KOT #", render: (o: RestaurantOrder) => `#${o.kot_number}` },
    { key: "table_number", header: "Table", render: (o: RestaurantOrder) => o.table_number ? `Table ${o.table_number}` : "Walk-in" },
    { key: "items", header: "Items", render: (o: RestaurantOrder) => o.items?.map((i) => `${i.item_name} ×${i.quantity}`).join(", ") || "—" },
    { key: "cancel_reason", header: "Reason", render: (o: RestaurantOrder) => o.cancel_reason || "—" },
    { key: "total_amount", header: "Amount", render: (o: RestaurantOrder) => formatCurrency(o.total_amount) },
    {
      key: "created_at",
      header: "Time",
      render: (o: RestaurantOrder) => (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
          {formatDateTime(o.created_at)}
        </span>
      ),
    },
  ];

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
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

      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      <div className={dashStyles["stats-grid"]}>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Total Revenue</div>
          <div className={dashStyles["stat-card__value"]}>{formatCurrency(totalSales)}</div>
          <div className={`${dashStyles["stat-card__change"]} ${dashStyles["stat-card__change--positive"]}`}>
            {billRows.length} bill{billRows.length !== 1 ? "s" : ""} · {completedOrders.length} KOTs
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
          <div className={dashStyles["stat-card__label"]}>Cancelled KOTs</div>
          <div className={dashStyles["stat-card__value"]} style={{ color: "var(--color-error)" }}>
            {formatCurrency(cancelledTotal)}
          </div>
          <div className={`${dashStyles["stat-card__change"]} ${dashStyles["stat-card__change--negative"]}`}>
            {cancelledOrders.length} KOTs
          </div>
        </div>
      </div>

      {/* ── Completed Bills Table ─────────────────────────────────────────── */}
      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius-lg)", marginTop: "var(--space-6)" }} />
      ) : (
        <>
          <h3 style={{
            fontSize: "var(--text-base)",
            fontWeight: 600,
            margin: "var(--space-6) 0 var(--space-3)",
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}>
            <Receipt size={18} /> Closed Bills
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontWeight: 400 }}>
              (each bill groups all KOTs for that table)
            </span>
          </h3>
          <Table
            columns={billColumns}
            data={billRows as unknown as Record<string, unknown>[]}
            emptyMessage="No bills for this date"
            emptyIcon={<BarChart3 size={48} className="opacity-50" />}
          />

          {cancelledOrders.length > 0 && (
            <>
              <h3 style={{
                fontSize: "var(--text-base)",
                fontWeight: 600,
                margin: "var(--space-6) 0 var(--space-3)",
                color: "var(--color-error)",
              }}>
                Cancelled KOTs
              </h3>
              <Table
                columns={cancelColumns}
                data={cancelledOrders as unknown as Record<string, unknown>[]}
                emptyMessage="No cancellations"
              />
            </>
          )}
        </>
      )}
    </>
  );
}
