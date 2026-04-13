"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge, getStatusVariant } from "@/components/ui/Badge";
import { showToast } from "@/components/ui/Toast";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { PAYMENT_MODES } from "@/lib/utils/constants";
import type { RestaurantOrder } from "@/types/database";
import dashStyles from "../../../dashboard.module.css";
import { ChefHat, Receipt, UtensilsCrossed } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

/** KOTs grouped by table number for display in the kitchen queue */
interface TableGroup {
  tableNumber: string | null; // null = takeaway/delivery
  label: string;              // e.g. "Table 5" or "Walk-in / Takeaway"
  kots: RestaurantOrder[];
  groupTotal: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CancellationsPage() {
  const { org } = useOrg();
  const [activeOrders, setActiveOrders] = useState<RestaurantOrder[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Cancel modal
  const [showCancel, setShowCancel] = useState<RestaurantOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Finalize bill modal — opened from any KOT in a table group
  const [showFinalize, setShowFinalize] = useState<TableGroup | null>(null);
  const [finalizeForm, setFinalizeForm] = useState({
    customer_name: "",
    payment_mode: "cash",
    payment_reference: "",
    notes: "",
  });
  const [finalizeLoading, setFinalizeLoading] = useState(false);

  useEffect(() => {
    if (!org?.id) return;
    fetchOrders();
  }, [org?.id]);

  // ── Data Fetching ───────────────────────────────────────────────────────────

  async function fetchOrders() {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const [activeRes, cancelledRes] = await Promise.all([
      supabase
        .from("restaurant_orders")
        .select("*, order_items(*)")
        .eq("org_id", org!.id)
        .in("status", ["active", "preparing"])
        .order("created_at", { ascending: true }), // oldest first in kitchen queue
      supabase
        .from("restaurant_orders")
        .select("*, order_items(*)")
        .eq("org_id", org!.id)
        .eq("status", "cancelled")
        .gte("created_at", today)
        .order("created_at", { ascending: false }),
    ]);

    if (activeRes.data) setActiveOrders(activeRes.data as unknown as RestaurantOrder[]);
    if (cancelledRes.data) setCancelledOrders(cancelledRes.data as unknown as RestaurantOrder[]);
    setLoading(false);
  }

  // ── Grouping Logic ──────────────────────────────────────────────────────────

  /**
   * Groups all active KOTs by table_number.
   * KOTs with no table_number (takeaway/delivery) each form their own group
   * since they are independent, single-KOT bills.
   */
  function buildTableGroups(orders: RestaurantOrder[]): TableGroup[] {
    const tableMap = new Map<string, RestaurantOrder[]>();

    for (const order of orders) {
      // Each no-table KOT is its own group (keyed by its own id to keep separate)
      const key = order.table_number ? `table:${order.table_number}` : `notbl:${order.id}`;
      if (!tableMap.has(key)) tableMap.set(key, []);
      tableMap.get(key)!.push(order);
    }

    const groups: TableGroup[] = [];
    for (const [key, kots] of tableMap.entries()) {
      const isTable = key.startsWith("table:");
      const tableNumber = isTable ? kots[0].table_number : null;
      groups.push({
        tableNumber,
        label: tableNumber ? `Table ${tableNumber}` : `Walk-in / Takeaway`,
        kots,
        groupTotal: kots.reduce((sum, k) => sum + (k.total_amount || 0), 0),
      });
    }

    // Dine-in tables first, then walk-in
    return groups.sort((a, b) => {
      if (a.tableNumber && !b.tableNumber) return -1;
      if (!a.tableNumber && b.tableNumber) return 1;
      return (a.tableNumber ?? "").localeCompare(b.tableNumber ?? "");
    });
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handlePrepare(order: RestaurantOrder) {
    const supabase = createClient();
    const { error } = await supabase
      .from("restaurant_orders")
      .update({
        status: "preparing",
        prepared_at: order.prepared_at || new Date().toISOString(),
      })
      .eq("id", order.id);

    if (error) {
      showToast("Unable to update kitchen status: " + error.message, "error");
      return;
    }
    showToast(`KOT #${order.kot_number} is now being prepared`, "info");
    fetchOrders();
  }

  async function handleCancel() {
    if (!showCancel || !cancelReason.trim()) {
      showToast("Please provide a reason for cancellation", "warning");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("restaurant_orders")
      .update({ status: "cancelled", cancel_reason: cancelReason.trim() })
      .eq("id", showCancel.id);

    if (error) {
      showToast("Cancellation failed: " + error.message, "error");
      return;
    }

    showToast(`KOT #${showCancel.kot_number} cancelled.`, "info");
    setShowCancel(null);
    setCancelReason("");
    fetchOrders();
  }

  function openFinalize(group: TableGroup) {
    // Pre-fill customer name from the first KOT that has one
    const existingName = group.kots.find((k) => k.customer_name)?.customer_name ?? "";
    setShowFinalize(group);
    setFinalizeForm({
      customer_name: existingName,
      payment_mode: "cash",
      payment_reference: "",
      notes: "",
    });
  }

  /**
   * Finalize checkout for all KOTs in a table group:
   * 1. Create a restaurant_bills row (single bill document)
   * 2. Mark all KOTs as completed + stamp bill_group_id
   */
  async function handleFinalize() {
    if (!showFinalize || !org?.id) return;

    if (!finalizeForm.customer_name.trim()) {
      showToast("Please enter customer name for the bill", "warning");
      return;
    }

    const needsReceiptRef = ["upi", "card"].includes(finalizeForm.payment_mode);
    if (needsReceiptRef && !finalizeForm.payment_reference.trim()) {
      showToast("UPI/Card payments require a receipt reference", "warning");
      return;
    }

    const kotIds = showFinalize.kots.map((k) => k.id);
    const totalAmount = showFinalize.groupTotal;

    setFinalizeLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Step 1 — Insert the bill record
    const { data: bill, error: billError } = await supabase
      .from("restaurant_bills")
      .insert({
        org_id: org.id,
        table_number: showFinalize.tableNumber,
        customer_name: finalizeForm.customer_name.trim(),
        payment_mode: finalizeForm.payment_mode,
        payment_reference: finalizeForm.payment_reference.trim() || null,
        notes: finalizeForm.notes.trim() || null,
        total_amount: totalAmount,
        created_by: user?.id,
      })
      .select()
      .single();

    if (billError || !bill) {
      showToast("Failed to create bill: " + billError?.message, "error");
      setFinalizeLoading(false);
      return;
    }

    // Step 2 — Mark all KOTs as completed + link to the bill
    const { error: updateError } = await supabase
      .from("restaurant_orders")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        customer_name: finalizeForm.customer_name.trim(),
        // Mirror payment info on KOTs for backward-compat queries
        payment_mode: finalizeForm.payment_mode,
        payment_reference: finalizeForm.payment_reference.trim() || null,
        bill_group_id: bill.id,
        notes: finalizeForm.notes.trim() || null,
      })
      .in("id", kotIds);

    if (updateError) {
      showToast("Bill created but KOTs failed to update: " + updateError.message, "error");
      setFinalizeLoading(false);
      return;
    }

    const kotList = showFinalize.kots.map((k) => `#${k.kot_number}`).join(", ");
    if (showFinalize.tableNumber) {
      showToast(
        `Table ${showFinalize.tableNumber} checked out · KOTs ${kotList} · ${formatCurrency(totalAmount)}`,
        "success"
      );
    } else {
      showToast(
        `Bill for ${finalizeForm.customer_name} · ${formatCurrency(totalAmount)}`,
        "success"
      );
    }

    setShowFinalize(null);
    setFinalizeLoading(false);
    fetchOrders();
  }

  // ── Derived State ────────────────────────────────────────────────────────────

  const tableGroups = buildTableGroups(activeOrders);

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Order Management</h2>
          <p className={dashStyles["page-header__subtitle"]}>
            {tableGroups.filter((g) => g.tableNumber).length} active tables
            &nbsp;·&nbsp;{activeOrders.length} KOTs in kitchen
            &nbsp;·&nbsp;{cancelledOrders.length} cancelled today
          </p>
        </div>
        <div className={dashStyles["page-header__actions"]}>
          <Button onClick={() => window.location.href = "/dashboard/restaurant/new-order"}>
            + New KOT
          </Button>
        </div>
      </div>

      {/* ── Kitchen Queue — grouped by table ──────────────────────────────── */}
      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />
      ) : activeOrders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-16)", color: "var(--text-tertiary)" }}>
          <UtensilsCrossed size={36} style={{ margin: "0 auto var(--space-4)" }} />
          <h3 style={{ color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>Kitchen queue is clear</h3>
          <p>No active orders right now</p>
        </div>
      ) : (
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
            <ChefHat size={18} /> Kitchen Queue
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {tableGroups.map((group) => (
              <div
                key={group.tableNumber ?? group.kots[0].id}
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                  overflow: "hidden",
                }}
              >
                {/* Group Header */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "var(--space-4) var(--space-5)",
                  background: "var(--bg-secondary)",
                  borderBottom: "1px solid var(--border-default)",
                }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>
                      {group.label}
                    </span>
                    <span style={{
                      marginLeft: "var(--space-3)",
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                      background: "var(--bg-tertiary)",
                      padding: "var(--space-1) var(--space-2)",
                      borderRadius: "var(--radius-full)",
                    }}>
                      {group.kots.length} KOT{group.kots.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <span style={{ fontWeight: 700, color: "var(--color-primary)", fontSize: "var(--text-lg)" }}>
                      {formatCurrency(group.groupTotal)}
                    </span>
                    <Button size="sm" onClick={() => openFinalize(group)}>
                      <Receipt size={14} style={{ marginRight: "var(--space-1)" }} />
                      Finalize Bill
                    </Button>
                  </div>
                </div>

                {/* Individual KOT rows inside the group */}
                <div style={{ padding: "var(--space-3) var(--space-5)" }}>
                  {group.kots.map((order, idx) => (
                    <div
                      key={order.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "var(--space-4)",
                        padding: "var(--space-3) 0",
                        borderBottom: idx < group.kots.length - 1 ? "1px dashed var(--border-default)" : "none",
                      }}
                    >
                      {/* KOT details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
                          <span style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                            KOT #{order.kot_number}
                          </span>
                          <Badge variant={getStatusVariant(order.status)}>
                            {order.status}
                          </Badge>
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                            {formatDateTime(order.created_at)}
                          </span>
                        </div>
                        <div style={{
                          fontSize: "var(--text-sm)",
                          color: "var(--text-secondary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {order.items?.map((i) => `${i.item_name} ×${i.quantity}`).join(" · ") || "—"}
                        </div>
                      </div>

                      {/* KOT sub-total + actions */}
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-primary)", minWidth: 70, textAlign: "right" }}>
                          {formatCurrency(order.total_amount)}
                        </span>
                        <div style={{ display: "flex", gap: "var(--space-1)" }}>
                          {order.status === "active" && (
                            <Button size="sm" variant="secondary" onClick={() => handlePrepare(order)}>
                              Prepare
                            </Button>
                          )}
                          <Button size="sm" variant="danger" onClick={() => { setShowCancel(order); setCancelReason(""); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cancelled Orders Log ───────────────────────────────────────────── */}
      <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-4)", color: "var(--text-primary)" }}>
        Cancelled KOTs (Today)
      </h3>

      {cancelledOrders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--text-tertiary)" }}>
          No cancellations today ✓
        </div>
      ) : (
        <div className={dashStyles["stats-grid"]} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {cancelledOrders.map((order) => (
            <div key={order.id} style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--color-error)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-5)",
              opacity: 0.8,
            }}>
              <div style={{ fontWeight: 700, color: "var(--color-error)", marginBottom: "var(--space-2)" }}>
                KOT #{order.kot_number}
                {order.table_number && <span style={{ fontWeight: 400, fontSize: "var(--text-sm)" }}> · Table {order.table_number}</span>}
                {" — CANCELLED"}
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
                {order.items?.map((i) => `${i.item_name} ×${i.quantity}`).join(", ") || "—"}
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", marginBottom: "var(--space-2)" }}>
                Reason: {order.cancel_reason || "—"}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-error)", fontWeight: 600 }}>{formatCurrency(order.total_amount)}</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{formatDateTime(order.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Cancel Modal ───────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!showCancel}
        onClose={() => setShowCancel(null)}
        title={`Cancel KOT #${showCancel?.kot_number}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCancel(null)}>Back</Button>
            <Button variant="danger" onClick={handleCancel}>Confirm Cancel</Button>
          </>
        }
      >
        <p style={{ marginBottom: "var(--space-4)", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
          This will cancel only this KOT. Other KOTs for the same table remain active.
          Please provide a reason.
        </p>
        <Textarea
          label="Cancellation Reason"
          placeholder="Why is this KOT being cancelled?"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          required
        />
      </Modal>

      {/* ── Finalize Bill Modal ────────────────────────────────────────────── */}
      <Modal
        isOpen={!!showFinalize}
        onClose={() => !finalizeLoading && setShowFinalize(null)}
        title={showFinalize?.tableNumber ? `Checkout · ${showFinalize.label}` : "Checkout · Walk-in"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowFinalize(null)} disabled={finalizeLoading}>Back</Button>
            <Button onClick={handleFinalize} loading={finalizeLoading}>
              Confirm & Print Bill
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: "var(--space-3)" }}>

          {/* Bill preview — show each KOT with its items */}
          <div style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3) var(--space-4)",
          }}>
            <div style={{
              fontWeight: 600,
              fontSize: "var(--text-sm)",
              color: "var(--text-primary)",
              marginBottom: "var(--space-2)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}>
              <Receipt size={14} />
              Final Bill — All KOTs for {showFinalize?.label}
            </div>

            {showFinalize?.kots.map((kot, idx) => (
              <div key={kot.id} style={{
                borderTop: idx > 0 ? "1px dashed var(--border-default)" : "none",
                padding: "var(--space-2) 0",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                    KOT #{kot.kot_number}
                    {" "}
                    <Badge variant={getStatusVariant(kot.status)}>
                      {kot.status}
                    </Badge>
                  </span>
                  <span style={{ fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                    {formatCurrency(kot.total_amount)}
                  </span>
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--space-1)" }}>
                  {kot.items?.map((i) => `${i.item_name} ×${i.quantity}`).join(" · ") || "—"}
                </div>
              </div>
            ))}

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: "2px solid var(--border-default)",
              paddingTop: "var(--space-2)",
              marginTop: "var(--space-2)",
              fontWeight: 700,
              fontSize: "var(--text-base)",
            }}>
              <span>Total ({showFinalize?.kots.length} KOT{(showFinalize?.kots.length ?? 0) > 1 ? "s" : ""})</span>
              <span style={{ color: "var(--color-primary)" }}>{formatCurrency(showFinalize?.groupTotal ?? 0)}</span>
            </div>
          </div>

          {/* Billing form fields */}
          <Input
            label="Customer Name *"
            value={finalizeForm.customer_name}
            onChange={(e) => setFinalizeForm((prev) => ({ ...prev, customer_name: e.target.value }))}
            placeholder="Name on the bill"
            required
          />
          <Select
            label="Payment Mode *"
            options={[...PAYMENT_MODES]}
            value={finalizeForm.payment_mode}
            onChange={(e) => setFinalizeForm((prev) => ({ ...prev, payment_mode: e.target.value }))}
          />
          {["upi", "card"].includes(finalizeForm.payment_mode) && (
            <Input
              label="UPI / Card Receipt Reference *"
              value={finalizeForm.payment_reference}
              onChange={(e) => setFinalizeForm((prev) => ({ ...prev, payment_reference: e.target.value }))}
              placeholder="UTR / card txn ID"
              helperText="Required for UPI and card payments"
            />
          )}
          <Textarea
            label="Bill Notes (optional)"
            value={finalizeForm.notes}
            onChange={(e) => setFinalizeForm((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="E.g. 10% discount applied, complimentary dessert, etc."
          />
        </div>
      </Modal>
    </>
  );
}
