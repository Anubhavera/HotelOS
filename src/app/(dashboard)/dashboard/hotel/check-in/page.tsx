"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { showToast } from "@/components/ui/Toast";
import { PAYMENT_MODES, ID_TYPES } from "@/lib/utils/constants";
import type { Room } from "@/types/database";
import dashStyles from "../../../dashboard.module.css";

function CheckInForm() {
  const { org } = useOrg();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRoom = searchParams.get("room");

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    room_id: preselectedRoom || "",
    guest_name: "",
    guest_phone: "",
    guest_id_type: "aadhar",
    guest_id_number: "",
    expected_check_out: "",
    rate_per_night: "",
    payment_mode: "cash",
    notes: "",
  });

  useEffect(() => {
    if (!org?.id) return;
    fetchAvailableRooms();
  }, [org?.id]);

  async function fetchAvailableRooms() {
    const supabase = createClient();
    const { data } = await supabase
      .from("rooms")
      .select("*")
      .eq("org_id", org!.id)
      .eq("status", "available")
      .order("room_number");

    if (data) {
      setRooms(data);
      if (preselectedRoom) {
        const selected = data.find((r) => r.id === preselectedRoom);
        if (selected) {
          setForm((f) => ({ ...f, rate_per_night: selected.rate_per_night.toString() }));
        }
      }
    }
  }

  function updateForm(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === "room_id") {
      const room = rooms.find((r) => r.id === value);
      if (room) {
        setForm((f) => ({ ...f, room_id: value, rate_per_night: room.rate_per_night.toString() }));
      }
    }
  }

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault();
    if (!org?.id || !form.room_id || !form.guest_name || !form.guest_phone) return;

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Create booking
    const { error: bookingError } = await supabase.from("bookings").insert({
      org_id: org.id,
      room_id: form.room_id,
      guest_name: form.guest_name,
      guest_phone: form.guest_phone,
      guest_id_type: form.guest_id_type,
      guest_id_number: form.guest_id_number || null,
      check_in: new Date().toISOString(),
      expected_check_out: form.expected_check_out || null,
      rate_per_night: parseFloat(form.rate_per_night),
      payment_mode: form.payment_mode,
      payment_status: "pending",
      status: "checked_in",
      notes: form.notes || null,
      created_by: user?.id,
    });

    if (bookingError) {
      showToast("Check-in failed: " + bookingError.message, "error");
      setLoading(false);
      return;
    }

    // Update room status
    await supabase
      .from("rooms")
      .update({ status: "occupied" })
      .eq("id", form.room_id);

    showToast(`${form.guest_name} checked into room successfully!`, "success");
    router.push("/dashboard/hotel");
  }

  return (
    <form onSubmit={handleCheckIn}>
      <div className={dashStyles["form-section"]}>
        <div className={dashStyles["form-section__title"]}>Room Selection</div>
        <div className={dashStyles["form-grid"]}>
          <Select
            label="Room"
            required
            options={rooms.map((r) => ({
              value: r.id,
              label: `Room ${r.room_number} — ${r.room_type} (₹${r.rate_per_night}/night)`,
            }))}
            value={form.room_id}
            onChange={(e) => updateForm("room_id", e.target.value)}
            placeholder="Select a room"
          />
          <Input
            label="Rate per Night (₹)"
            type="number"
            value={form.rate_per_night}
            onChange={(e) => updateForm("rate_per_night", e.target.value)}
            required
          />
        </div>
      </div>

      <div className={dashStyles["form-section"]}>
        <div className={dashStyles["form-section__title"]}>Guest Details</div>
        <div className={dashStyles["form-grid"]}>
          <Input
            label="Guest Name"
            placeholder="Full name"
            value={form.guest_name}
            onChange={(e) => updateForm("guest_name", e.target.value)}
            required
          />
          <Input
            label="Phone Number"
            type="tel"
            placeholder="+91 98765 43210"
            value={form.guest_phone}
            onChange={(e) => updateForm("guest_phone", e.target.value)}
            required
          />
          <Select
            label="ID Type"
            options={[...ID_TYPES]}
            value={form.guest_id_type}
            onChange={(e) => updateForm("guest_id_type", e.target.value)}
          />
          <Input
            label="ID Number"
            placeholder="ID document number"
            value={form.guest_id_number}
            onChange={(e) => updateForm("guest_id_number", e.target.value)}
          />
        </div>
      </div>

      <div className={dashStyles["form-section"]}>
        <div className={dashStyles["form-section__title"]}>Payment & Stay</div>
        <div className={dashStyles["form-grid"]}>
          <Input
            label="Expected Check-out"
            type="datetime-local"
            value={form.expected_check_out}
            onChange={(e) => updateForm("expected_check_out", e.target.value)}
          />
          <Select
            label="Payment Mode"
            options={[...PAYMENT_MODES]}
            value={form.payment_mode}
            onChange={(e) => updateForm("payment_mode", e.target.value)}
          />
        </div>
        <div style={{ marginTop: "var(--space-4)" }}>
          <Textarea
            label="Notes"
            placeholder="Any special requests or notes..."
            value={form.notes}
            onChange={(e) => updateForm("notes", e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
        <Button variant="secondary" type="button" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          ✓ Complete Check-In
        </Button>
      </div>
    </form>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 400, borderRadius: "var(--radius-lg)" }} />}>
      <CheckInForm />
    </Suspense>
  );
}
