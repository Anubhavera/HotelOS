"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table } from "@/components/ui/Table";
import { showToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { EXPENSE_CATEGORIES } from "@/lib/utils/constants";
import type { Expense } from "@/types/database";
import dashStyles from "../../dashboard.module.css";

export default function ExpensesPage() {
  const { org } = useOrg();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 7));
  const [newExpense, setNewExpense] = useState({
    item_name: "", category: "general", price: "", quantity: "1", vendor: "", notes: "", date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (!org?.id) return;
    fetchExpenses();
  }, [org?.id, dateFilter]);

  async function fetchExpenses() {
    setLoading(true);
    const supabase = createClient();
    const monthStart = `${dateFilter}-01`;
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("org_id", org!.id)
      .gte("date", monthStart)
      .lt("date", nextMonth.toISOString().split("T")[0])
      .order("date", { ascending: false });
    if (data) setExpenses(data);
    setLoading(false);
  }

  async function addExpense() {
    if (!org?.id || !newExpense.item_name || !newExpense.price) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const price = parseFloat(newExpense.price);
    const qty = parseInt(newExpense.quantity) || 1;

    const { error } = await supabase.from("expenses").insert({
      org_id: org.id,
      item_name: newExpense.item_name,
      category: newExpense.category,
      price,
      quantity: qty,
      total_amount: price * qty,
      date: newExpense.date,
      vendor: newExpense.vendor || null,
      notes: newExpense.notes || null,
      created_by: user?.id,
    });
    if (error) { showToast(error.message, "error"); return; }
    showToast("Expense added!", "success");
    setShowAdd(false);
    setNewExpense({ item_name: "", category: "general", price: "", quantity: "1", vendor: "", notes: "", date: new Date().toISOString().split("T")[0] });
    fetchExpenses();
  }

  const totalExpense = expenses.reduce((sum, e) => sum + e.total_amount, 0);
  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.total_amount;
    return acc;
  }, {});

  const columns = [
    { key: "date", header: "Date", render: (e: Expense) => formatDate(e.date) },
    { key: "item_name", header: "Item" },
    { key: "category", header: "Category", render: (e: Expense) => e.category.charAt(0).toUpperCase() + e.category.slice(1) },
    { key: "price", header: "Price", render: (e: Expense) => formatCurrency(e.price) },
    { key: "quantity", header: "Qty" },
    { key: "total_amount", header: "Total", render: (e: Expense) => formatCurrency(e.total_amount) },
    { key: "vendor", header: "Vendor", render: (e: Expense) => e.vendor || "—" },
  ];

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Expenses</h2>
          <p className={dashStyles["page-header__subtitle"]}>
            Total: {formatCurrency(totalExpense)}
          </p>
        </div>
        <div className={dashStyles["page-header__actions"]}>
          <Button variant="secondary" onClick={() => window.location.href = "/dashboard/expenses/utilities"}>
            ⚡ Utility Bills
          </Button>
          <input type="month" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={{
            padding: "var(--space-3) var(--space-4)", background: "var(--bg-secondary)", border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "var(--text-sm)",
          }} />
          <Button onClick={() => setShowAdd(true)}>+ Add Expense</Button>
        </div>
      </div>

      <div className={dashStyles["stats-grid"]}>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Total Expenses</div>
          <div className={dashStyles["stat-card__value"]}>{formatCurrency(totalExpense)}</div>
          <div className={dashStyles["stat-card__change"]}>{expenses.length} entries</div>
        </div>
        {Object.entries(byCategory).slice(0, 5).map(([cat, total]) => (
          <div key={cat} className={dashStyles["stat-card"]}>
            <div className={dashStyles["stat-card__label"]}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</div>
            <div className={dashStyles["stat-card__value"]}>{formatCurrency(total)}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />
      ) : (
        <Table columns={columns} data={expenses as unknown as Record<string, unknown>[]} emptyMessage="No expenses this month" emptyIcon="🧾" />
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Expense" footer={
        <>
          <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={addExpense}>Add Expense</Button>
        </>
      }>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input label="Item Name" placeholder="What was purchased?" value={newExpense.item_name} onChange={(e) => setNewExpense({ ...newExpense, item_name: e.target.value })} required />
          <div className={dashStyles["form-grid"]}>
            <Select label="Category" options={[...EXPENSE_CATEGORIES]} value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })} />
            <Input label="Date" type="date" value={newExpense.date} onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })} />
          </div>
          <div className={dashStyles["form-grid"]}>
            <Input label="Price (₹)" type="number" placeholder="Unit price" value={newExpense.price} onChange={(e) => setNewExpense({ ...newExpense, price: e.target.value })} required />
            <Input label="Quantity" type="number" value={newExpense.quantity} onChange={(e) => setNewExpense({ ...newExpense, quantity: e.target.value })} />
          </div>
          <Input label="Vendor" placeholder="Where was it purchased?" value={newExpense.vendor} onChange={(e) => setNewExpense({ ...newExpense, vendor: e.target.value })} />
          <Textarea label="Notes" placeholder="Additional details..." value={newExpense.notes} onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })} />
        </div>
      </Modal>
    </>
  );
}
