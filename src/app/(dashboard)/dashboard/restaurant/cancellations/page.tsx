"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { showToast } from "@/components/ui/Toast";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import type { RestaurantOrder } from "@/types/database";
import dashStyles from "../../../dashboard.module.css";

export default function CancellationsPage() {
  const { org } = useOrg();
  const [activeOrders, setActiveOrders] = useState<RestaurantOrder[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState<RestaurantOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (!org?.id) return;
    fetchOrders();
  }, [org?.id]);

  async function fetchOrders() {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    const [activeRes, cancelledRes] = await Promise.all([
      supabase
        .from("restaurant_orders")
        .select("*, order_items(*)")
        .eq("org_id", org!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
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

  async function handleCancel() {
    if (!showCancel || !cancelReason) {
      showToast("Please provide a reason for cancellation", "warning");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("restaurant_orders")
      .update({ status: "cancelled", cancel_reason: cancelReason })
      .eq("id", showCancel.id);

    if (error) {
      showToast("Cancellation failed: " + error.message, "error");
      return;
    }

    showToast(`KOT #${showCancel.kot_number} cancelled. Owner will be notified.`, "info");
    setShowCancel(null);
    setCancelReason("");
    fetchOrders();
  }

  async function handleComplete(order: RestaurantOrder) {
    const supabase = createClient();
    await supabase
      .from("restaurant_orders")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", order.id);

    showToast(`KOT #${order.kot_number} completed!`, "success");
    fetchOrders();
  }

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Order Management</h2>
          <p className={dashStyles["page-header__subtitle"]}>
            {activeOrders.length} active · {cancelledOrders.length} cancelled today
          </p>
        </div>
      </div>

      {/* Active Orders that can be completed or cancelled */}
      {activeOrders.length > 0 && (
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-4)", color: "var(--text-primary)" }}>
            Active Orders
          </h3>
          <div className={dashStyles["stats-grid"]} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {activeOrders.map((order) => (
              <div key={order.id} style={{
                background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-lg)", padding: "var(--space-5)",
              }}>
                <div style={{ fontWeight: 700, marginBottom: "var(--space-2)" }}>KOT #{order.kot_number}</div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-2)" }}>
                  {order.items?.map((i) => `${i.item_name} ×${i.quantity}`).join(", ") || "—"}
                </div>
                <div style={{ fontWeight: 600, color: "var(--color-primary)", marginBottom: "var(--space-4)" }}>
                  {formatCurrency(order.total_amount)}
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <Button size="sm" onClick={() => handleComplete(order)}>✓ Complete</Button>
                  <Button size="sm" variant="danger" onClick={() => setShowCancel(order)}>✕ Cancel</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancelled Orders Log */}
      <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-4)", color: "var(--text-primary)" }}>
        Cancelled Orders (Today)
      </h3>

      {cancelledOrders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--text-tertiary)" }}>
          No cancellations today ✓
        </div>
      ) : (
        <div className={dashStyles["stats-grid"]} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {cancelledOrders.map((order) => (
            <div key={order.id} style={{
              background: "var(--bg-elevated)", border: "1px solid var(--color-error)",
              borderRadius: "var(--radius-lg)", padding: "var(--space-5)", opacity: 0.8,
            }}>
              <div style={{ fontWeight: 700, color: "var(--color-error)", marginBottom: "var(--space-2)" }}>
                KOT #{order.kot_number} — CANCELLED
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

      <Modal isOpen={!!showCancel} onClose={() => setShowCancel(null)} title={`Cancel KOT #${showCancel?.kot_number}`} footer={
        <>
          <Button variant="secondary" onClick={() => setShowCancel(null)}>Back</Button>
          <Button variant="danger" onClick={handleCancel}>Confirm Cancel</Button>
        </>
      }>
        <p style={{ marginBottom: "var(--space-4)", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
          This will cancel the order and notify the owner. Please provide a reason.
        </p>
        <Textarea
          label="Cancellation Reason"
          placeholder="Why is this order being cancelled?"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          required
        />
      </Modal>
    </>
  );
}
