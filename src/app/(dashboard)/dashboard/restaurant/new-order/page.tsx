"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { showToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils/formatters";
import { ORDER_TYPES } from "@/lib/utils/constants";
import type { MenuItem, RestaurantOrder } from "@/types/database";
import dashStyles from "../../../dashboard.module.css";
import { Receipt, ChefHat, Info } from "lucide-react";

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
  // Used only for informational display of open KOTs for the entered table
  const [tableKotCount, setTableKotCount] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    table_number: "",
    customer_name: "",
    order_type: "dine_in",
  });

  useEffect(() => {
    if (!org?.id) return;
    fetchMenu();
  }, [org?.id]);

  // Whenever table_number changes, look up how many open KOTs already exist
  useEffect(() => {
    if (!org?.id || !form.table_number.trim()) {
      setTableKotCount(0);
      return;
    }
    fetchTableKotCount(form.table_number.trim());
  }, [org?.id, form.table_number]);

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

  async function fetchTableKotCount(tableNumber: string) {
    const supabase = createClient();
    const { count } = await supabase
      .from("restaurant_orders")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org!.id)
      .eq("table_number", tableNumber)
      .in("status", ["active", "preparing"]);

    setTableKotCount(count ?? 0);
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

    // Always create a fresh KOT — never mutate existing KOTs.
    // Multiple KOTs for the same table are intentional and will be
    // grouped together into one final bill at checkout time.
    const { data: order, error: orderError } = await supabase
      .from("restaurant_orders")
      .insert({
        org_id: org.id,
        table_number: form.table_number.trim() || null,
        customer_name: form.customer_name.trim() || null,
        order_type: form.order_type,
        // payment_mode is NOT collected here — it belongs on the final bill,
        // not on the kitchen ticket. Set a default for DB non-null constraint.
        payment_mode: null,
        total_amount: cartTotal,
        status: "active",
        created_by: user?.id,
      })
      .select()
      .single();

    if (orderError || !order) {
      showToast("Failed to create KOT: " + orderError?.message, "error");
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
      showToast("KOT created but items failed to save: " + itemsError.message, "error");
    } else {
      const tableMsg = form.table_number ? ` for Table ${form.table_number}` : "";
      showToast(`KOT #${order.kot_number} sent to kitchen${tableMsg} · ${formatCurrency(cartTotal)}`, "success");
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

  const showTableHint = form.order_type === "dine_in" && form.table_number.trim() && tableKotCount > 0;

  return (
    <form onSubmit={handleSubmit}>
      <div className={dashStyles["content-grid"]}>
        {/* Left: Order Details + Menu */}
        <div>
          <div className={dashStyles["form-section"]}>
            <div className={dashStyles["form-section__title"]}>
              <ChefHat size={16} style={{ display: "inline", marginRight: "var(--space-2)" }} />
              New Kitchen Order (KOT)
            </div>

            {/* Informational banner explaining the KOT model */}
            <div style={{
              background: "var(--color-info-subtle, var(--bg-secondary))",
              border: "1px solid var(--color-info, var(--border-default))",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3) var(--space-4)",
              marginBottom: "var(--space-4)",
              display: "flex",
              gap: "var(--space-2)",
              alignItems: "flex-start",
              fontSize: "var(--text-xs)",
              color: "var(--text-secondary)",
            }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Each submission creates a <strong>new KOT</strong> and sends it to the kitchen.
                If a table orders again later, just submit another KOT — all KOTs for the same
                table are automatically combined into one final bill at checkout.
              </span>
            </div>

            <div className={dashStyles["form-grid"]}>
              <div style={{ position: "relative" }}>
                <Input
                  label="Table Number"
                  placeholder="e.g., 5  (leave blank for takeaway/delivery)"
                  value={form.table_number}
                  onChange={(e) => setForm({ ...form, table_number: e.target.value })}
                />
                {/* Show hint when there are already open KOTs for this table */}
                {showTableHint && (
                  <div style={{
                    marginTop: "var(--space-1)",
                    fontSize: "var(--text-xs)",
                    color: "var(--color-warning, #f59e0b)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                  }}>
                    <Info size={11} />
                    Table {form.table_number} already has {tableKotCount} open KOT{tableKotCount > 1 ? "s" : ""}.
                    This will be KOT #{tableKotCount + 1} for this table — all will be billed together at checkout.
                  </div>
                )}
              </div>
              <Input
                label="Customer Name (optional)"
                placeholder="Walk-in customer"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
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
                  <h4 style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--text-tertiary)",
                    fontWeight: 600,
                    marginBottom: "var(--space-2)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}>
                    {category}
                  </h4>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "var(--space-2)",
                  }}>
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

        {/* Right: Cart / KOT Preview */}
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
              <Receipt className="inline-block mr-2" size={20} />
              KOT Preview
            </h3>

            {cart.length === 0 ? (
              <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", textAlign: "center", padding: "var(--space-8)" }}>
                Tap on menu items to add them to this KOT
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
                        style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-sm)", border: "1px solid var(--border-default)", cursor: "pointer" }}>
                        −
                      </button>
                      <span style={{ fontWeight: 600, minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.menu_item_id, 1)}
                        style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-sm)", border: "1px solid var(--border-default)", cursor: "pointer" }}>
                        +
                      </button>
                    </div>
                    <div style={{ fontWeight: 600, marginLeft: "var(--space-3)", minWidth: 70, textAlign: "right" }}>
                      {formatCurrency(item.total_price)}
                    </div>
                  </div>
                ))}

                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "var(--space-4) 0",
                  fontWeight: 700,
                  fontSize: "var(--text-lg)",
                }}>
                  <span>This KOT Total</span>
                  <span style={{ color: "var(--color-primary)" }}>{formatCurrency(cartTotal)}</span>
                </div>

                {/* Only show "table running total" hint if data is available */}
                {showTableHint && (
                  <div style={{
                    background: "var(--bg-secondary)",
                    borderRadius: "var(--radius-sm)",
                    padding: "var(--space-2) var(--space-3)",
                    marginBottom: "var(--space-3)",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-tertiary)",
                  }}>
                    Table {form.table_number} session — KOT #{tableKotCount + 1} of {tableKotCount + 1}
                    &nbsp;(payment collected at checkout)
                  </div>
                )}

                <Button
                  type="submit"
                  fullWidth
                  loading={loading}
                  style={{ marginTop: "var(--space-2)" }}
                >
                  <ChefHat size={16} style={{ marginRight: "var(--space-2)" }} />
                  Send to Kitchen · {formatCurrency(cartTotal)}
                </Button>
                <p style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-tertiary)",
                  textAlign: "center",
                  marginTop: "var(--space-2)",
                }}>
                  Payment is collected at checkout, not here
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
