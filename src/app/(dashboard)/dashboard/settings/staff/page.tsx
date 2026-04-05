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
import { DEPARTMENTS } from "@/lib/utils/constants";
import type { OrgMember } from "@/types/database";
import dashStyles from "../../../dashboard.module.css";
import { Users } from "lucide-react";

export default function StaffPage() {
  const { org } = useOrg();
  const [members, setMembers] = useState<(OrgMember & { email?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newStaff, setNewStaff] = useState({ email: "", password: "", role: "staff", department: "front-desk" });

  useEffect(() => {
    if (!org?.id) return;
    fetchMembers();
  }, [org?.id]);

  async function fetchMembers() {
    const supabase = createClient();
    const { data } = await supabase
      .from("org_members")
      .select("*")
      .eq("org_id", org!.id)
      .order("role, joined_at");
    if (data) setMembers(data);
    setLoading(false);
  }

  async function addStaff() {
    if (!org?.id || !newStaff.email || !newStaff.password) return;
    const supabase = createClient();

    // Create auth user for staff
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newStaff.email,
      password: newStaff.password,
    });
    if (authError || !authData.user) {
      showToast("Failed to create user: " + (authError?.message || "Unknown error"), "error");
      return;
    }

    const { error } = await supabase.from("org_members").insert({
      org_id: org.id,
      user_id: authData.user.id,
      role: newStaff.role,
      department: newStaff.department,
    });
    if (error) { showToast(error.message, "error"); return; }

    showToast("Staff member added!", "success");
    setShowAdd(false);
    setNewStaff({ email: "", password: "", role: "staff", department: "front-desk" });
    fetchMembers();
  }

  const roleColors: Record<string, "primary" | "info" | "neutral"> = {
    owner: "primary", manager: "info", staff: "neutral",
  };

  const columns = [
    { key: "user_id", header: "User ID", render: (m: OrgMember) => m.user_id.slice(0, 8) + "..." },
    { key: "role", header: "Role", render: (m: OrgMember) => <Badge variant={roleColors[m.role]}>{m.role}</Badge> },
    { key: "department", header: "Department", render: (m: OrgMember) => m.department?.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "—" },
  ];

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Staff Management</h2>
          <p className={dashStyles["page-header__subtitle"]}>{members.length} members</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>+ Add Staff</Button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />
      ) : (
        <Table columns={columns} data={members as unknown as Record<string, unknown>[]} emptyMessage="No staff members" emptyIcon={<Users size={48} className="opacity-50" />} />
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Staff Member" footer={
        <>
          <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button onClick={addStaff}>Add Staff</Button>
        </>
      }>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input label="Email" type="email" placeholder="staff@example.com" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} required />
          <Input label="Password" type="password" placeholder="Min 6 characters" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} required />
          <Select label="Role" options={[{ value: "staff", label: "Staff" }, { value: "manager", label: "Manager" }]} value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })} />
          <Select label="Department" options={[...DEPARTMENTS]} value={newStaff.department} onChange={(e) => setNewStaff({ ...newStaff, department: e.target.value })} />
        </div>
      </Modal>
    </>
  );
}
