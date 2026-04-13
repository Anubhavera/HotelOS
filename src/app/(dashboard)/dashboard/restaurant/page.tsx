"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Badge, getStatusVariant } from "@/components/ui/Badge";
import { formatCurrency, timeAgo } from "@/lib/utils/formatters";
import type { RestaurantOrder } from "@/types/database";
import dashStyles from "../../dashboard.module.css";
import { ClipboardList, BarChart3, ChefHat, UtensilsCrossed, Receipt } from "lucide-react";

function formatDuration(ms: number) {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${totalMinutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Represents one table's session with all its KOTs */
interface TableSession {
  tableNumber: string | null;
  label: string;
  kots: RestaurantOrder[];
  sessionTotal: number;
  /** Is any KOT in this session still actively being prepared? */
  isActive: boolean;
}

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
    const now = new Date();
    const todayIST = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayUTC = new Date(todayIST.getTime() - 5.5 * 60 * 60 * 1000);

    const { data } = await supabase
      .from("restaurant_orders")
      .select("*, order_items(*)")
      .eq("org_id", org!.id)
      .gte("created_at", todayUTC.toISOString())
      .order("created_at", { ascending: false });

    if (data) setOrders(data as unknown as RestaurantOrder[]);
    setLoading(false);
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const activeOrders = orders.filter((o) => ["active", "preparing"].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === "completed");
  const cancelledOrders = orders.filter((o) => o.status === "cancelled");

  // Revenue: sum from completed KOTs (each KOT's total_amount is its own slice)
  const todayRevenue = completedOrders.reduce((sum, o) => sum + o.total_amount, 0);

  /**
   * Build table sessions from active KOTs.
   * - Dine-in KOTs with the same table_number → one session card
   * - No-table KOTs → individual session per KOT
   */
  function buildActiveSessions(): TableSession[] {
    const tableMap = new Map<string, RestaurantOrder[]>();

    for (const order of activeOrders) {
      const key = order.table_number ? `table:${order.table_number}` : `notbl:${order.id}`;
      if (!tableMap.has(key)) tableMap.set(key, []);
      tableMap.get(key)!.push(order);
    }

    const sessions: TableSession[] = [];
    for (const [, kots] of tableMap.entries()) {
      const tableNumber = kots[0].table_number;
      sessions.push({
        tableNumber,
        label: tableNumber ? `Table ${tableNumber}` : "Walk-in / Takeaway",
        kots,
        sessionTotal: kots.reduce((s, k) => s + (k.total_amount || 0), 0),
        isActive: kots.some((k) => k.status === "active"),
      });
    }

    return sessions.sort((a, b) => {
      if (a.tableNumber && !b.tableNumber) return -1;
      if (!a.tableNumber && b.tableNumber) return 1;
      return (a.tableNumber ?? "").localeCompare(b.tableNumber ?? "");
    });
  }

  /**
   * Group TODAY'S completed KOTs by bill_group_id so we can show them
   * as single "bill" entries on the completed section.
   */
  function buildCompletedBills() {
    const billMap = new Map<string, RestaurantOrder[]>();
    for (const order of completedOrders) {
      const key = order.bill_group_id ?? order.id; // fallback for legacy orders
      if (!billMap.has(key)) billMap.set(key, []);
      billMap.get(key)!.push(order);
    }
    return Array.from(billMap.values()).sort(
      (a, b) => new Date(b[0].completed_at ?? b[0].created_at).getTime()
              - new Date(a[0].completed_at ?? a[0].created_at).getTime()
    );
  }

  const activeSessions = buildActiveSessions();
  const completedBills = buildCompletedBills();
  const activeTables = activeSessions.filter((s) => s.tableNumber).length;

  function summarizeBillItems(kots: RestaurantOrder[]) {
    const itemTotals = new Map<string, number>();
    for (const kot of kots) {
      for (const item of kot.items || []) {
        itemTotals.set(item.item_name, (itemTotals.get(item.item_name) || 0) + item.quantity);
      }
    }

    const items = [...itemTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, qty]) => `${name} x${qty}`);

    if (items.length === 0) return "—";
    return `${items.slice(0, 3).join(", ")}${items.length > 3 ? ` +${items.length - 3} more` : ""}`;
  }

  function getBillDurations(kots: RestaurantOrder[]) {
    const createdAtList = kots.map((k) => new Date(k.created_at).getTime());
    const completedAtList = kots.map((k) => new Date(k.completed_at ?? k.created_at).getTime());
    const preparedAtList = kots
      .map((k) => (k.prepared_at ? new Date(k.prepared_at).getTime() : null))
      .filter((value): value is number => value !== null);

    const openedAtMs = Math.min(...createdAtList);
    const servedAtMs = preparedAtList.length > 0 ? Math.max(...preparedAtList) : Math.max(...createdAtList);
    const closedAtMs = Math.max(...completedAtList);

    return {
      serviceDurationMs: Math.max(0, servedAtMs - openedAtMs),
      closeDurationMs: Math.max(0, closedAtMs - servedAtMs),
      timingEstimated: preparedAtList.length === 0,
    };
  }

  return (
    <>
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Restaurant</h2>
          <p className={dashStyles["page-header__subtitle"]}>
            {activeTables} active table{activeTables !== 1 ? "s" : ""}
            &nbsp;·&nbsp;{activeOrders.length} KOTs in kitchen
            &nbsp;·&nbsp;Today&apos;s revenue: {formatCurrency(todayRevenue)}
          </p>
        </div>
        <div className={dashStyles["page-header__actions"]}>
          <Button variant="secondary" onClick={() => window.location.href = "/dashboard/restaurant/menu"}>
            <ClipboardList className="inline-block mr-2" size={18} /> Menu
          </Button>
          <Button variant="secondary" onClick={() => window.location.href = "/dashboard/restaurant/sales"}>
            <BarChart3 className="inline-block mr-2" size={18} /> Sales Report
          </Button>
          <Button variant="secondary" onClick={() => window.location.href = "/dashboard/restaurant/cancellations"}>
            <ChefHat className="inline-block mr-2" size={18} /> Kitchen &amp; Orders
          </Button>
          <Button onClick={() => window.location.href = "/dashboard/restaurant/new-order"}>
            + New KOT
          </Button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className={dashStyles["stats-grid"]} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: "var(--space-6)" }}>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Active Tables</div>
          <div className={dashStyles["stat-card__value"]}>{activeTables}</div>
        </div>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>KOTs in Kitchen</div>
          <div className={dashStyles["stat-card__value"]}>{activeOrders.length}</div>
        </div>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Bills Closed</div>
          <div className={dashStyles["stat-card__value"]}>{completedBills.length}</div>
        </div>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Today&apos;s Revenue</div>
          <div className={dashStyles["stat-card__value"]}>{formatCurrency(todayRevenue)}</div>
        </div>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Cancelled KOTs</div>
          <div className={dashStyles["stat-card__value"]}>{cancelledOrders.length}</div>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />
      ) : (
        <>
          {/* ── Active Table Sessions ──────────────────────────────────────── */}
          {activeSessions.length > 0 && (
            <div style={{ marginBottom: "var(--space-8)" }}>
              <h3 style={{
                fontSize: "var(--text-base)",
                fontWeight: 600,
                marginBottom: "var(--space-4)",
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
              }}>
                <ChefHat size={18} /> Active Sessions
              </h3>
              <div className={dashStyles["stats-grid"]} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
                {activeSessions.map((session) => (
                  <div
                    key={session.tableNumber ?? session.kots[0].id}
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-lg)",
                      padding: "var(--space-5)",
                      animation: "slideUp var(--transition-slow) ease forwards",
                    }}
                  >
                    {/* Session header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>
                          {session.label}
                        </span>
                        <span style={{
                          marginLeft: "var(--space-2)",
                          fontSize: "var(--text-xs)",
                          color: "var(--text-tertiary)",
                          background: "var(--bg-tertiary)",
                          padding: "2px var(--space-2)",
                          borderRadius: "var(--radius-full)",
                        }}>
                          {session.kots.length} KOT{session.kots.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <Badge variant={session.isActive ? "warning" : "info"} dot pulse={session.isActive}>
                        {session.isActive ? "active" : "preparing"}
                      </Badge>
                    </div>

                    {/* KOT list */}
                    <div style={{ marginBottom: "var(--space-3)" }}>
                      {session.kots.map((kot, idx) => (
                        <div key={kot.id} style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "var(--space-2) 0",
                          borderTop: idx > 0 ? "1px dashed var(--border-default)" : "none",
                          fontSize: "var(--text-sm)",
                        }}>
                          <div>
                            <span style={{ fontWeight: 600, marginRight: "var(--space-2)" }}>
                              KOT #{kot.kot_number}
                            </span>
                            <Badge variant={getStatusVariant(kot.status)}>
                              {kot.status}
                            </Badge>
                            <div style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginTop: 2 }}>
                              {kot.items?.slice(0, 2).map((i) => `${i.item_name} ×${i.quantity}`).join(", ")}
                              {(kot.items?.length ?? 0) > 2 && ` +${(kot.items?.length ?? 0) - 2} more`}
                            </div>
                          </div>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)", flexShrink: 0 }}>
                            {formatCurrency(kot.total_amount)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Session total + action */}
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderTop: "1px solid var(--border-default)",
                      paddingTop: "var(--space-3)",
                    }}>
                      <div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                          Session total ({session.kots.length} KOT{session.kots.length > 1 ? "s" : ""})
                        </div>
                        <div style={{ fontWeight: 700, fontSize: "var(--text-lg)", color: "var(--color-primary)" }}>
                          {formatCurrency(session.sessionTotal)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => window.location.href = "/dashboard/restaurant/cancellations"}
                      >
                        <Receipt size={14} style={{ marginRight: "var(--space-1)" }} />
                        Manage
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Completed Bills Today ─────────────────────────────────────── */}
          {completedBills.length > 0 && (
            <div>
              <h3 style={{
                fontSize: "var(--text-base)",
                fontWeight: 600,
                marginBottom: "var(--space-4)",
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
              }}>
                <Receipt size={18} /> Completed Bills Today
              </h3>
              <div className={dashStyles["stats-grid"]} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                {completedBills.map((billKots) => {
                  const billTotal = billKots.reduce((s, k) => s + k.total_amount, 0);
                  const firstKot = billKots[0];
                  const itemsSummary = summarizeBillItems(billKots);
                  const { serviceDurationMs, closeDurationMs, timingEstimated } = getBillDurations(billKots);
                  return (
                    <div key={firstKot.bill_group_id ?? firstKot.id} style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-lg)",
                      padding: "var(--space-5)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                        <div>
                          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                            {firstKot.table_number ? `Table ${firstKot.table_number}` : "Walk-in"}
                          </span>
                          {firstKot.customer_name && (
                            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginLeft: "var(--space-2)" }}>
                              · {firstKot.customer_name}
                            </span>
                          )}
                        </div>
                        <Badge variant="success">paid</Badge>
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: "var(--space-2)" }}>
                        {billKots.length} KOT{billKots.length > 1 ? "s" : ""} · {timeAgo(firstKot.completed_at ?? firstKot.created_at)}
                        &nbsp;·&nbsp;{firstKot.payment_mode?.toUpperCase()}
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
                        {itemsSummary}
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: "var(--space-2)" }}>
                        Served in {formatDuration(serviceDurationMs)} · Closed in {formatDuration(closeDurationMs)}
                        {timingEstimated ? " · est." : ""}
                      </div>
                      <div style={{ fontWeight: 700, color: "var(--color-primary)", fontSize: "var(--text-lg)" }}>
                        {formatCurrency(billTotal)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Empty State ───────────────────────────────────────────────── */}
          {activeSessions.length === 0 && completedBills.length === 0 && (
            <div style={{ textAlign: "center", padding: "var(--space-16)", color: "var(--text-tertiary)" }}>
              <UtensilsCrossed size={36} style={{ margin: "0 auto var(--space-4)" }} />
              <h3 style={{ color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>No orders today</h3>
              <p>Create your first KOT to start tracking orders</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
