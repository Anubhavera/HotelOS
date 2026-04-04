"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import dashStyles from "../dashboard.module.css";

export default function SettingsPage() {
  const { org } = useOrg();
  const [form, setForm] = useState({ name: "", whatsapp_number: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (org) setForm({ name: org.name || "", whatsapp_number: org.whatsapp_number || "" });
  }, [org]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!org?.id) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("organizations").update({
      name: form.name, whatsapp_number: form.whatsapp_number || null,
    }).eq("id", org.id);
    if (error) showToast("Failed: " + error.message, "error");
    else showToast("Settings updated!", "success");
    setLoading(false);
  }

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <h2 className={dashStyles["page-header__title"]}>Organization Settings</h2>
      </div>
      <div style={{ maxWidth: 600 }}>
        <form onSubmit={handleSave}>
          <div className={dashStyles["form-section"]}>
            <div className={dashStyles["form-section__title"]}>General</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <Input label="Organization Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input label="Owner WhatsApp Number" placeholder="+91 98765 43210" value={form.whatsapp_number}
                onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                helperText="Used for KOT cancellation notifications (Phase 2)" />
            </div>
          </div>
          <Button type="submit" loading={loading}>Save Changes</Button>
        </form>
      </div>
    </>
  );
}
