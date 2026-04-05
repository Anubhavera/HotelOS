"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { showToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { BILL_TYPES } from "@/lib/utils/constants";
import type { UtilityBill } from "@/types/database";
import dashStyles from "../../../dashboard.module.css";
import { Zap, Droplet, Flame, Wifi, FileText } from "lucide-react";

export default function UtilitiesPage() {
  const { org } = useOrg();
  const [bills, setBills] = useState<UtilityBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newBill, setNewBill] = useState({
    bill_type: "electricity",
    amount: "",
    billing_period_start: "",
    billing_period_end: "",
    due_date: "",
  });

  useEffect(() => {
    if (!org?.id) return;
    fetchBills();
  }, [org?.id]);

  async function fetchBills() {
    const supabase = createClient();
    const { data } = await supabase
      .from("utility_bills")
      .select("*")
      .eq("org_id", org!.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setBills(data);
    setLoading(false);
  }

  async function addBill() {
    if (!org?.id || !newBill.amount) return;
    const supabase = createClient();
    const { error } = await supabase.from("utility_bills").insert({
      org_id: org.id,
      bill_type: newBill.bill_type,
      amount: parseFloat(newBill.amount),
      billing_period_start: newBill.billing_period_start || null,
      billing_period_end: newBill.billing_period_end || null,
      due_date: newBill.due_date || null,
    });
    if (error) { showToast(error.message, "error"); return; }
    showToast("Bill added!", "success");
    setShowAdd(false);
    setNewBill({ bill_type: "electricity", amount: "", billing_period_start: "", billing_period_end: "", due_date: "" });
    fetchBills();
  }

  async function togglePaid(bill: UtilityBill) {
    const supabase = createClient();
    await supabase.from("utility_bills").update({
      paid: !bill.paid,
      paid_at: !bill.paid ? new Date().toISOString() : null,
    }).eq("id", bill.id);
    fetchBills();
  }

  const billIcons: Record<string, React.ReactNode> = {
    electricity: <Zap className="inline-block mr-2" size={20}/>, 
    water: <Droplet className="inline-block mr-2" size={20}/>, 
    gas: <Flame className="inline-block mr-2" size={20}/>, 
    internet: <Wifi className="inline-block mr-2" size={20}/>, 
    other: <FileText className="inline-block mr-2" size={20}/>,
  };

  const totalPending = bills.filter((b) => !b.paid).reduce((s, b) => s + b.amount, 0);
  const totalPaid = bills.filter((b) => b.paid).reduce((s, b) => s + b.amount, 0);

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Utility Bills</h2>
          <p className={dashStyles["page-header__subtitle"]}>Electricity, Water, Gas & Internet</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ Add Bill</Button>
      </div>

      <div className={dashStyles["stats-grid"]} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Pending</div>
          <div className={dashStyles["stat-card__value"]} style={{ color: "var(--color-warning)" }}>{formatCurrency(totalPending)}</div>
        </div>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Paid</div>
          <div className={dashStyles["stat-card__value"]} style={{ color: "var(--color-success)" }}>{formatCurrency(totalPaid)}</div>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />
      ) : bills.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-16)", color: "var(--text-tertiary)" }}>
          <div style={{ fontSize: "3rem", marginBottom: "var(--space-4)" }}><Zap size={24}/></div>
          <h3 style={{ color: "var(--text-primary)" }}>No utility bills yet</h3>
        </div>
      ) : (
        <div className={dashStyles["stats-grid"]} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {bills.map((bill) => (
            <div key={bill.id} style={{
              background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)", padding: "var(--space-5)",
              opacity: bill.paid ? 0.7 : 1,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "var(--space-3)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ fontSize: "var(--text-xl)" }}>{billIcons[bill.bill_type]}</span>
                  <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{bill.bill_type}</span>
                </div>
                <Badge variant={bill.paid ? "success" : "warning"}>{bill.paid ? "Paid" : "Pending"}</Badge>
              </div>
              <div style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--color-primary)", marginBottom: "var(--space-2)" }}>
                {formatCurrency(bill.amount)}
              </div>
              {bill.billing_period_start && bill.billing_period_end && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: "var(--space-2)" }}>
                  {formatDate(bill.billing_period_start)} — {formatDate(bill.billing_period_end)}
                </div>
              )}
              {bill.due_date && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: "var(--space-3)" }}>
                  Due: {formatDate(bill.due_date)}
                </div>
              )}
              <Button size="sm" variant={bill.paid ? "ghost" : "secondary"} fullWidth onClick={() => togglePaid(bill)}>
                {bill.paid ? "Mark Unpaid" : "✓ Mark Paid"}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Utility Bill" footer={
        <>
          <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={addBill}>Add Bill</Button>
        </>
      }>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Select label="Bill Type" options={[...BILL_TYPES]} value={newBill.bill_type} onChange={(e) => setNewBill({ ...newBill, bill_type: e.target.value })} />
          <Input label="Amount (₹)" type="number" placeholder="Bill amount" value={newBill.amount} onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })} required />
          <div className={dashStyles["form-grid"]}>
            <Input label="Period Start" type="date" value={newBill.billing_period_start} onChange={(e) => setNewBill({ ...newBill, billing_period_start: e.target.value })} />
            <Input label="Period End" type="date" value={newBill.billing_period_end} onChange={(e) => setNewBill({ ...newBill, billing_period_end: e.target.value })} />
          </div>
          <Input label="Due Date" type="date" value={newBill.due_date} onChange={(e) => setNewBill({ ...newBill, due_date: e.target.value })} />
        </div>
      </Modal>
    </>
  );
}
