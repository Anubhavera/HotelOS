"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { showToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils/formatters";
import { PAYMENT_MODES, ID_TYPES } from "@/lib/utils/constants";
import type { Room } from "@/types/database";
import dashStyles from "../../../dashboard.module.css";

const BOOKING_MODES = [
  { value: "check_in_now", label: "Check-in Now" },
  { value: "pre_booking", label: "Pre-book Room" },
] as const;

function getTodayDateValue() {
  return new Date().toISOString().split("T")[0];
}

function getNextDateValue(dateString: string, days: number) {
  const next = new Date(`${dateString}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().split("T")[0];
}

function CheckInForm() {
  const { org } = useOrg();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRoom = searchParams.get("room");
  const preselectedMode = searchParams.get("mode");

  const defaultCheckIn = getTodayDateValue();
  const defaultCheckOut = getNextDateValue(defaultCheckIn, 1);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    room_id: preselectedRoom || "",
    guest_name: "",
    guest_phone: "",
    guest_id_type: "aadhar",
    guest_id_number: "",
    booking_mode: preselectedMode === "prebook" ? "pre_booking" : "check_in_now",
    check_in_date: defaultCheckIn,
    check_out_date: defaultCheckOut,
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
      .neq("status", "maintenance")
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

    const checkInDate = form.booking_mode === "pre_booking" ? form.check_in_date : getTodayDateValue();

    if (!form.check_out_date || form.check_out_date <= checkInDate) {
      showToast("Check-out date must be after check-in date", "warning");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const checkInAt =
      form.booking_mode === "pre_booking"
        ? new Date(`${form.check_in_date}T12:00:00`).toISOString()
        : new Date().toISOString();
    const expectedCheckOutAt = new Date(`${form.check_out_date}T11:00:00`).toISOString();

    // Validate room availability for selected stay window to prevent overlap bookings.
    const { data: existingBookings, error: bookingFetchError } = await supabase
      .from("bookings")
      .select("id, check_in, check_out, expected_check_out, status")
      .eq("org_id", org.id)
      .eq("room_id", form.room_id)
      .in("status", ["checked_in", "prebooked"]);

    if (bookingFetchError) {
      showToast("Unable to validate room availability", "error");
      setLoading(false);
      return;
    }

    const desiredStart = new Date(checkInAt);
    const desiredEnd = new Date(expectedCheckOutAt);
    const hasOverlap = (existingBookings || []).some((booking) => {
      const existingStart = new Date(booking.check_in);
      let existingEnd: Date;

      if (booking.check_out) {
        existingEnd = new Date(booking.check_out);
      } else if (booking.expected_check_out) {
        existingEnd = new Date(booking.expected_check_out);
      } else {
        existingEnd = new Date("9999-12-31T00:00:00.000Z");
      }

      return desiredStart < existingEnd && desiredEnd > existingStart;
    });

    if (hasOverlap) {
      showToast("Room is already booked for the selected dates", "error");
      setLoading(false);
      return;
    }

    // Create booking
    const { error: bookingError } = await supabase.from("bookings").insert({
      org_id: org.id,
      room_id: form.room_id,
      guest_name: form.guest_name,
      guest_phone: form.guest_phone,
      guest_id_type: form.guest_id_type,
      guest_id_number: form.guest_id_number || null,
      check_in: checkInAt,
      expected_check_out: expectedCheckOutAt,
      rate_per_night: parseFloat(form.rate_per_night),
      payment_mode: form.payment_mode,
      payment_status: "paid",
      status: form.booking_mode === "pre_booking" ? "prebooked" : "checked_in",
      notes: form.notes || null,
      created_by: user?.id,
    });

    if (bookingError) {
      showToast("Check-in failed: " + bookingError.message, "error");
      setLoading(false);
      return;
    }

    // Immediate check-in occupies the room now. Pre-booking keeps room state unchanged.
    if (form.booking_mode === "check_in_now") {
      await supabase
        .from("rooms")
        .update({ status: "occupied" })
        .eq("id", form.room_id);
    }

    if (form.booking_mode === "pre_booking") {
      showToast(
        `${form.guest_name} pre-booked from ${formatDate(checkInAt)} to ${formatDate(expectedCheckOutAt)}`,
        "success"
      );
      router.push("/dashboard/hotel/bookings");
    } else {
      showToast(`${form.guest_name} checked into room successfully!`, "success");
      router.push("/dashboard/hotel");
    }
  }

  const roomOptions = rooms
    .filter((room) => (form.booking_mode === "check_in_now" ? room.status === "available" : room.status !== "maintenance"))
    .map((room) => ({
      value: room.id,
      label: `Room ${room.room_number} — ${room.room_type} (INR ${room.rate_per_night}/night)${room.status !== "available" ? ` · ${room.status}` : ""}`,
    }));

  return (
    <form onSubmit={handleCheckIn}>
      <div className={dashStyles["form-section"]}>
        <div className={dashStyles["form-section__title"]}>Room Selection</div>
        <div className={dashStyles["form-grid"]}>
          <Select
            label="Booking Mode"
            options={[...BOOKING_MODES]}
            value={form.booking_mode}
            onChange={(e) => updateForm("booking_mode", e.target.value)}
          />
          <Select
            label="Room"
            required
            options={roomOptions}
            value={form.room_id}
            onChange={(e) => updateForm("room_id", e.target.value)}
            placeholder="Select a room"
          />
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: "var(--space-2)", gridColumn: "1 / -1" }}>
            {form.booking_mode === "pre_booking"
              ? "Select room and dates to reserve in advance"
              : "Only currently available rooms are shown for immediate check-in"}
          </p>
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
          {form.booking_mode === "pre_booking" ? (
            <Input
              label="Check-in Date"
              type="date"
              value={form.check_in_date}
              onChange={(e) => updateForm("check_in_date", e.target.value)}
              required
            />
          ) : (
            <Input
              label="Check-in Date"
              type="date"
              value={getTodayDateValue()}
              readOnly
            />
          )}
          <Input
            label="Check-out Date"
            type="date"
            value={form.check_out_date}
            onChange={(e) => updateForm("check_out_date", e.target.value)}
            required
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
        <Button variant="secondary" type="button" onClick={() => router.push("/dashboard/hotel/bookings")}>
          History
        </Button>
        <Button variant="secondary" type="button" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {form.booking_mode === "pre_booking" ? "Save Pre-Booking" : "Complete Check-In"}
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
