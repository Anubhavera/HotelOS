"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import { showToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { DEPARTMENTS } from "@/lib/utils/constants";
import type { Salary } from "@/types/database";
import dashStyles from "../../dashboard.module.css";
import { Banknote } from "lucide-react";

export default function SalariesPage() {
  const { org } = useOrg();
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [newSalary, setNewSalary] = useState({
    employee_name: "",
    department: "front-desk",
    monthly_salary: "",
  });

  useEffect(() => {
    if (!org?.id) return;
    fetchSalaries();
  }, [org?.id, selectedMonth]);

  async function fetchSalaries() {
    setLoading(true);
    const supabase = createClient();
    const monthStart = `${selectedMonth}-01`;
    const { data } = await supabase
      .from("salaries")
      .select("*")
      .eq("org_id", org!.id)
      .eq("payment_month", monthStart)
      .order("department, employee_name");
    if (data) setSalaries(data);
    setLoading(false);
  }

  async function addSalary() {
    if (!org?.id || !newSalary.employee_name || !newSalary.monthly_salary) return;
    const supabase = createClient();
    const { error } = await supabase.from("salaries").insert({
      org_id: org.id,
      employee_name: newSalary.employee_name,
      department: newSalary.department,
      monthly_salary: parseFloat(newSalary.monthly_salary),
      payment_month: `${selectedMonth}-01`,
    });
    if (error) { showToast(error.message, "error"); return; }
    showToast("Salary entry added!", "success");
    setShowAdd(false);
    setNewSalary({ employee_name: "", department: "front-desk", monthly_salary: "" });
    fetchSalaries();
  }

  async function markPaid(id: string) {
    const supabase = createClient();
    await supabase.from("salaries").update({ payment_status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    showToast("Marked as paid", "success");
    fetchSalaries();
  }

  const totalSalary = salaries.reduce((sum, s) => sum + s.monthly_salary, 0);
  const paidTotal = salaries.filter((s) => s.payment_status === "paid").reduce((sum, s) => sum + s.monthly_salary, 0);
  const pendingTotal = totalSalary - paidTotal;

  // Group by department
  const byDept = salaries.reduce<Record<string, number>>((acc, s) => {
    acc[s.department] = (acc[s.department] || 0) + s.monthly_salary;
    return acc;
  }, {});

  const columns = [
    { key: "employee_name", header: "Name" },
    { key: "department", header: "Department", render: (s: Salary) => s.department.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()) },
    { key: "monthly_salary", header: "Salary", render: (s: Salary) => formatCurrency(s.monthly_salary) },
    { key: "payment_status", header: "Status", render: (s: Salary) => (
      <Badge variant={s.payment_status === "paid" ? "success" : "warning"}>{s.payment_status}</Badge>
    )},
    { key: "actions", header: "", render: (s: Salary) => s.payment_status === "pending" ? (
      <Button size="sm" variant="secondary" onClick={() => markPaid(s.id)}>Mark Paid</Button>
    ) : null },
  ];

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Salaries</h2>
          <p className={dashStyles["page-header__subtitle"]}>
            {formatDate(`${selectedMonth}-01`, { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className={dashStyles["page-header__actions"]}>
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{
            padding: "var(--space-3) var(--space-4)", background: "var(--bg-secondary)", border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "var(--text-sm)",
          }} />
          <Button onClick={() => setShowAdd(true)}>+ Add Entry</Button>
        </div>
      </div>

      <div className={dashStyles["stats-grid"]}>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Total Salary</div>
          <div className={dashStyles["stat-card__value"]}>{formatCurrency(totalSalary)}</div>
        </div>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Paid</div>
          <div className={dashStyles["stat-card__value"]} style={{ color: "var(--color-success)" }}>{formatCurrency(paidTotal)}</div>
        </div>
        <div className={dashStyles["stat-card"]}>
          <div className={dashStyles["stat-card__label"]}>Pending</div>
          <div className={dashStyles["stat-card__value"]} style={{ color: "var(--color-warning)" }}>{formatCurrency(pendingTotal)}</div>
        </div>
        {Object.entries(byDept).map(([dept, total]) => (
          <div key={dept} className={dashStyles["stat-card"]}>
            <div className={dashStyles["stat-card__label"]}>{dept.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</div>
            <div className={dashStyles["stat-card__value"]}>{formatCurrency(total)}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />
      ) : (
        <Table columns={columns} data={salaries as unknown as Record<string, unknown>[]} emptyMessage="No salary entries for this month" emptyIcon={<Banknote size={48} className="opacity-50" />} />
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Salary Entry" footer={
        <>
          <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={addSalary}>Add Entry</Button>
        </>
      }>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input label="Employee Name" placeholder="Full name" value={newSalary.employee_name} onChange={(e) => setNewSalary({ ...newSalary, employee_name: e.target.value })} required />
          <Select label="Department" options={[...DEPARTMENTS]} value={newSalary.department} onChange={(e) => setNewSalary({ ...newSalary, department: e.target.value })} />
          <Input label="Monthly Salary (₹)" type="number" placeholder="e.g., 15000" value={newSalary.monthly_salary} onChange={(e) => setNewSalary({ ...newSalary, monthly_salary: e.target.value })} required />
        </div>
      </Modal>
    </>
  );
}
