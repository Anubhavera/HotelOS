"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { showToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils/formatters";
import { PAYMENT_MODES, ORDER_TYPES } from "@/lib/utils/constants";
import type { MenuItem } from "@/types/database";
import dashStyles from "../../../dashboard.module.css";

interface CartItem {
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export default function NewOrderPage() {
  const { org } = useOrg();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    table_number: "",
    order_type: "dine_in",
    payment_mode: "cash",
  });

  useEffect(() => {
    if (!org?.id) return;
    fetchMenu();
  }, [org?.id]);

  async function fetchMenu() {
    const supabase = createClient();
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("org_id", org!.id)
      .eq("is_available", true)
      .order("category, name");

    if (data) setMenuItems(data);
  }

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_item_id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menu_item_id === item.id
            ? { ...c, quantity: c.quantity + 1, total_price: (c.quantity + 1) * c.unit_price }
            : c
        );
      }
      return [
        ...prev,
        { menu_item_id: item.id, item_name: item.name, quantity: 1, unit_price: item.price, total_price: item.price },
      ];
    });
  }

  function updateQuantity(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menu_item_id === menuItemId
            ? { ...c, quantity: c.quantity + delta, total_price: (c.quantity + delta) * c.unit_price }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.total_price, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!org?.id || cart.length === 0) {
      showToast("Add at least one item to the order", "warning");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: order, error: orderError } = await supabase
      .from("restaurant_orders")
      .insert({
        org_id: org.id,
        table_number: form.table_number || null,
        order_type: form.order_type,
        payment_mode: form.payment_mode,
        total_amount: cartTotal,
        status: "active",
        created_by: user?.id,
      })
      .select()
      .single();

    if (orderError || !order) {
      showToast("Failed to create order: " + orderError?.message, "error");
      setLoading(false);
      return;
    }

    const orderItems = cart.map((c) => ({
      order_id: order.id,
      menu_item_id: c.menu_item_id,
      item_name: c.item_name,
      quantity: c.quantity,
      unit_price: c.unit_price,
      total_price: c.total_price,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

    if (itemsError) {
      showToast("Order created but items failed: " + itemsError.message, "error");
    } else {
      showToast(`KOT created! Total: ${formatCurrency(cartTotal)}`, "success");
    }

    setLoading(false);
    window.location.href = "/dashboard/restaurant";
  }

  const groupedMenu = menuItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <form onSubmit={handleSubmit}>
      <div className={dashStyles["content-grid"]}>
        {/* Left: Menu */}
        <div>
          <div className={dashStyles["form-section"]}>
            <div className={dashStyles["form-section__title"]}>Order Details</div>
            <div className={dashStyles["form-grid"]}>
              <Input
                label="Table Number"
                placeholder="e.g., 5"
                value={form.table_number}
                onChange={(e) => setForm({ ...form, table_number: e.target.value })}
              />
              <Select
                label="Order Type"
                options={[...ORDER_TYPES]}
                value={form.order_type}
                onChange={(e) => setForm({ ...form, order_type: e.target.value })}
              />
            </div>
          </div>

          <div className={dashStyles["form-section"]}>
            <div className={dashStyles["form-section__title"]}>Menu Items</div>
            {Object.entries(groupedMenu).length === 0 ? (
              <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--text-tertiary)" }}>
                <p>No menu items found. <a href="/dashboard/restaurant/menu">Add menu items first</a></p>
              </div>
            ) : (
              Object.entries(groupedMenu).map(([category, items]) => (
                <div key={category} style={{ marginBottom: "var(--space-4)" }}>
                  <h4 style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: "var(--space-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {category}
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-2)" }}>
                    {items.map((item) => {
                      const inCart = cart.find((c) => c.menu_item_id === item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addToCart(item)}
                          style={{
                            padding: "var(--space-3)",
                            background: inCart ? "var(--color-primary-subtle)" : "var(--bg-secondary)",
                            border: `1px solid ${inCart ? "var(--color-primary)" : "var(--border-default)"}`,
                            borderRadius: "var(--radius-md)",
                            textAlign: "left",
                            cursor: "pointer",
                            transition: "all var(--transition-fast)",
                          }}
                        >
                          <div style={{ fontWeight: 500, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
                            {item.name}
                            {inCart && <span style={{ color: "var(--color-primary)", marginLeft: "var(--space-2)" }}>×{inCart.quantity}</span>}
                          </div>
                          <div style={{ color: "var(--color-primary)", fontSize: "var(--text-sm)", fontWeight: 600 }}>
                            {formatCurrency(item.price)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div>
          <div style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-5)",
            position: "sticky",
            top: "calc(var(--header-height) + var(--space-6))",
          }}>
            <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-4)" }}>
              🧾 Order Summary
            </h3>

            {cart.length === 0 ? (
              <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", textAlign: "center", padding: "var(--space-8)" }}>
                Tap on menu items to add them
              </p>
            ) : (
              <>
                {cart.map((item) => (
                  <div key={item.menu_item_id} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--space-3) 0",
                    borderBottom: "1px solid var(--border-default)",
                    fontSize: "var(--text-sm)",
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{item.item_name}</div>
                      <div style={{ color: "var(--text-tertiary)" }}>{formatCurrency(item.unit_price)} each</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <button type="button" onClick={() => updateQuantity(item.menu_item_id, -1)}
                        style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-sm)" }}>
                        −
                      </button>
                      <span style={{ fontWeight: 600, minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.menu_item_id, 1)}
                        style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-sm)" }}>
                        +
                      </button>
                    </div>
                    <div style={{ fontWeight: 600, marginLeft: "var(--space-3)", minWidth: 70, textAlign: "right" }}>
                      {formatCurrency(item.total_price)}
                    </div>
                  </div>
                ))}

                <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-4) 0", fontWeight: 700, fontSize: "var(--text-lg)" }}>
                  <span>Total</span>
                  <span style={{ color: "var(--color-primary)" }}>{formatCurrency(cartTotal)}</span>
                </div>

                <Select
                  label="Payment Mode"
                  options={[...PAYMENT_MODES]}
                  value={form.payment_mode}
                  onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
                />

                <Button type="submit" fullWidth loading={loading} style={{ marginTop: "var(--space-4)" }}>
                  Create KOT · {formatCurrency(cartTotal)}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
