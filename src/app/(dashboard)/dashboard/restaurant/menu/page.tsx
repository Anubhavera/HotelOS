"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { showToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils/formatters";
import { MENU_CATEGORIES } from "@/lib/utils/constants";
import type { MenuItem } from "@/types/database";
import dashStyles from "../../../dashboard.module.css";

export default function MenuPage() {
  const { org } = useOrg();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", category: "Main Course", price: "" });

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
      .order("category, name");
    if (data) setItems(data);
    setLoading(false);
  }

  async function addItem() {
    if (!org?.id || !newItem.name || !newItem.price) return;
    const supabase = createClient();
    const { error } = await supabase.from("menu_items").insert({
      org_id: org.id,
      name: newItem.name,
      category: newItem.category,
      price: parseFloat(newItem.price),
    });
    if (error) { showToast(error.message, "error"); return; }
    showToast("Item added!", "success");
    setShowAdd(false);
    setNewItem({ name: "", category: "Main Course", price: "" });
    fetchMenu();
  }

  async function toggleAvailability(item: MenuItem) {
    const supabase = createClient();
    await supabase.from("menu_items").update({ is_available: !item.is_available }).eq("id", item.id);
    fetchMenu();
  }

  async function deleteItem(id: string) {
    const supabase = createClient();
    await supabase.from("menu_items").delete().eq("id", id);
    showToast("Item deleted", "info");
    fetchMenu();
  }

  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Menu Management</h2>
          <p className={dashStyles["page-header__subtitle"]}>{items.length} items</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ Add Item</Button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: "var(--radius-lg)" }} />
      ) : (
        Object.entries(grouped).map(([category, catItems]) => (
          <div key={category} style={{ marginBottom: "var(--space-6)" }}>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-3)" }}>{category}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--space-3)" }}>
              {catItems.map((item) => (
                <div key={item.id} style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-4)",
                  opacity: item.is_available ? 1 : 0.5,
                  transition: "all var(--transition-base)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.name}</div>
                      <div style={{ color: "var(--color-primary)", fontWeight: 600, marginTop: "var(--space-1)" }}>{formatCurrency(item.price)}</div>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <Button size="sm" variant="ghost" onClick={() => toggleAvailability(item)}>
                        {item.is_available ? "✓" : "✕"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteItem(item.id)}>🗑</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Menu Item" footer={
        <>
          <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={addItem}>Add Item</Button>
        </>
      }>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input label="Item Name" placeholder="e.g., Butter Chicken" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} required />
          <Select label="Category" options={MENU_CATEGORIES.map((c) => ({ value: c, label: c }))} value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} />
          <Input label="Price (₹)" type="number" placeholder="e.g., 350" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} required />
        </div>
      </Modal>
    </>
  );
}
