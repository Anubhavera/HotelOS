"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Badge, getStatusVariant } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Table } from "@/components/ui/Table";
import { showToast } from "@/components/ui/Toast";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import { ID_TYPES, PAYMENT_MODES } from "@/lib/utils/constants";
import type { Booking, Room } from "@/types/database";
import dashStyles from "../../../dashboard.module.css";
import { ClipboardList } from "lucide-react";

function toDateValue(isoString: string | null) {
  if (!isoString) return "";
  return isoString.split("T")[0];
}

export default function BookingsPage() {
  const { org } = useOrg();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    room_id: "",
    guest_name: "",
    guest_phone: "",
    guest_id_type: "aadhar",
    guest_id_number: "",
    check_in_date: "",
    check_out_date: "",
    rate_per_night: "",
    payment_mode: "cash",
    notes: "",
  });

  useEffect(() => {
    if (!org?.id) return;
    fetchBookings();
  }, [org?.id]);

  async function fetchBookings() {
    const supabase = createClient();
    const [{ data: bookingsData }, { data: roomsData }] = await Promise.all([
      supabase
        .from("bookings")
        .select("*, rooms(room_number)")
        .eq("org_id", org!.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("rooms")
        .select("id, org_id, room_number, room_type, rate_per_night, status, floor, created_at")
        .eq("org_id", org!.id)
        .order("room_number"),
    ]);

    if (bookingsData) setBookings(bookingsData as unknown as Booking[]);
    if (roomsData) setRooms(roomsData as unknown as Room[]);
    setLoading(false);
  }

  async function handleCheckOut(booking: Booking) {
    const supabase = createClient();
    const checkOut = new Date();
    const checkIn = new Date(booking.check_in);
    const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86400000));
    const totalAmount = nights * booking.rate_per_night;

    const { error } = await supabase
      .from("bookings")
      .update({
        check_out: checkOut.toISOString(),
        total_amount: totalAmount,
        status: "checked_out",
        payment_status: "paid",
      })
      .eq("id", booking.id);

    if (!error) {
      await supabase.from("rooms").update({ status: "available" }).eq("id", booking.room_id);
      showToast(`Checked out! Total: ${formatCurrency(totalAmount)} (${nights} nights)`, "success");
      fetchBookings();
    } else {
      showToast("Check-out failed: " + error.message, "error");
    }
  }

  async function handleCheckInFromPrebooking(booking: Booking) {
    const supabase = createClient();
    const now = new Date().toISOString();

    const { error: bookingError } = await supabase
      .from("bookings")
      .update({ status: "checked_in", check_in: now, payment_status: "paid" })
      .eq("id", booking.id);

    if (bookingError) {
      showToast("Could not start stay: " + bookingError.message, "error");
      return;
    }

    await supabase
      .from("rooms")
      .update({ status: "occupied" })
      .eq("id", booking.room_id);

    showToast(`${booking.guest_name} has been checked in`, "success");
    fetchBookings();
  }

  function isCheckInDue(booking: Booking) {
    const scheduled = new Date(booking.check_in);
    const now = new Date();
    return scheduled <= now;
  }

  function isPrebookingEditable(booking: Booking) {
    if (booking.status !== "prebooked") return false;
    return new Date(booking.check_in) > new Date();
  }

  function openEditPrebooking(booking: Booking) {
    if (!isPrebookingEditable(booking)) {
      showToast("Pre-booking can be edited only before check-in time", "warning");
      return;
    }

    setEditingBooking(booking);
    setEditForm({
      room_id: booking.room_id,
      guest_name: booking.guest_name,
      guest_phone: booking.guest_phone,
      guest_id_type: booking.guest_id_type || "aadhar",
      guest_id_number: booking.guest_id_number || "",
      check_in_date: toDateValue(booking.check_in),
      check_out_date: toDateValue(booking.expected_check_out),
      rate_per_night: booking.rate_per_night.toString(),
      payment_mode: booking.payment_mode || "cash",
      notes: booking.notes || "",
    });
  }

  function updateEditForm(field: keyof typeof editForm, value: string) {
    setEditForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "room_id") {
        const selectedRoom = rooms.find((room) => room.id === value);
        if (selectedRoom) {
          updated.rate_per_night = selectedRoom.rate_per_night.toString();
        }
      }
      return updated;
    });
  }

  async function handleSaveEditedPrebooking() {
    if (!editingBooking || !org?.id) return;

    if (!isPrebookingEditable(editingBooking)) {
      showToast("Pre-booking can be edited only before check-in time", "warning");
      return;
    }

    if (!editForm.room_id || !editForm.guest_name.trim() || !editForm.guest_phone.trim()) {
      showToast("Room, guest name and phone are required", "warning");
      return;
    }

    if (!editForm.check_in_date || !editForm.check_out_date || editForm.check_out_date <= editForm.check_in_date) {
      showToast("Check-out date must be after check-in date", "warning");
      return;
    }

    const editedCheckInTime = new Date(`${editForm.check_in_date}T12:00:00`);
    if (editedCheckInTime <= new Date()) {
      showToast("Pre-booking check-in must be in the future", "warning");
      return;
    }

    const rate = parseFloat(editForm.rate_per_night);
    if (Number.isNaN(rate) || rate <= 0) {
      showToast("Rate per night must be a valid amount", "warning");
      return;
    }

    const supabase = createClient();
    const checkInAt = new Date(`${editForm.check_in_date}T12:00:00`).toISOString();
    const expectedCheckOutAt = new Date(`${editForm.check_out_date}T11:00:00`).toISOString();

    setSavingEdit(true);

    const { data: existingBookings, error: bookingFetchError } = await supabase
      .from("bookings")
      .select("id, check_in, check_out, expected_check_out, status")
      .eq("org_id", org.id)
      .eq("room_id", editForm.room_id)
      .in("status", ["checked_in", "prebooked"])
      .neq("id", editingBooking.id);

    if (bookingFetchError) {
      showToast("Unable to validate room availability", "error");
      setSavingEdit(false);
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
      setSavingEdit(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        room_id: editForm.room_id,
        guest_name: editForm.guest_name.trim(),
        guest_phone: editForm.guest_phone.trim(),
        guest_id_type: editForm.guest_id_type,
        guest_id_number: editForm.guest_id_number.trim() || null,
        check_in: checkInAt,
        expected_check_out: expectedCheckOutAt,
        rate_per_night: rate,
        payment_mode: editForm.payment_mode,
        payment_status: "paid",
        notes: editForm.notes.trim() || null,
      })
      .eq("id", editingBooking.id)
      .eq("org_id", org.id)
      .eq("status", "prebooked");

    if (updateError) {
      showToast("Could not update pre-booking: " + updateError.message, "error");
      setSavingEdit(false);
      return;
    }

    showToast("Pre-booking updated", "success");
    setSavingEdit(false);
    setEditingBooking(null);
    fetchBookings();
  }

  async function handleDeletePrebooking(booking: Booking) {
    if (!org?.id) return;

    if (!isPrebookingEditable(booking)) {
      showToast("Pre-booking can be deleted only before check-in time", "warning");
      return;
    }

    const shouldDelete = window.confirm(
      `Delete pre-booking for ${booking.guest_name}? This will mark it as cancelled and keep history.`
    );

    if (!shouldDelete) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id)
      .eq("org_id", org.id)
      .eq("status", "prebooked");

    if (error) {
      showToast("Could not delete pre-booking: " + error.message, "error");
      return;
    }

    showToast("Pre-booking deleted", "success");
    fetchBookings();
  }

  const roomOptions = rooms
    .filter((room) => room.status !== "maintenance" || room.id === editForm.room_id)
    .map((room) => ({
      value: room.id,
      label: `Room ${room.room_number} — ${room.room_type}${room.status !== "available" ? ` · ${room.status}` : ""}`,
    }));

  const columns = [
    {
      key: "rooms",
      header: "Room",
      render: (b: any) => b.rooms?.room_number || "—",
    },
    { key: "guest_name", header: "Guest" },
    { key: "guest_phone", header: "Phone" },
    {
      key: "check_in",
      header: "Check In",
      render: (b: Booking) => formatDateTime(b.check_in),
    },
    {
      key: "expected_check_out",
      header: "Check Out",
      render: (b: Booking) => (b.expected_check_out ? formatDateTime(b.expected_check_out) : "—"),
    },
    {
      key: "status",
      header: "Status",
      render: (b: Booking) => (
        <Badge variant={getStatusVariant(b.status)}>{b.status.replace("_", " ")}</Badge>
      ),
    },
    {
      key: "payment_mode",
      header: "Payment",
      render: (b: Booking) => b.payment_mode?.toUpperCase() || "—",
    },
    {
      key: "payment_status",
      header: "Payment Status",
      render: (b: Booking) => (
        <Badge variant={b.payment_status === "paid" ? "success" : "warning"}>
          {b.payment_status === "paid" ? "Done" : b.payment_status}
        </Badge>
      ),
    },
    {
      key: "total_amount",
      header: "Amount",
      render: (b: Booking) => (b.total_amount ? formatCurrency(b.total_amount) : "—"),
    },
    {
      key: "actions",
      header: "",
      render: (b: Booking) =>
        b.status === "checked_in" ? (
          <Button size="sm" variant="secondary" onClick={() => handleCheckOut(b)}>
            Check Out
          </Button>
        ) : b.status === "prebooked" ? (
          isPrebookingEditable(b) ? (
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button size="sm" variant="secondary" onClick={() => openEditPrebooking(b)}>
                Edit
              </Button>
              <Button size="sm" variant="danger" onClick={() => handleDeletePrebooking(b)}>
                Delete
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              disabled={!isCheckInDue(b)}
              onClick={() => handleCheckInFromPrebooking(b)}
            >
              {isCheckInDue(b) ? "Check In Guest" : "Upcoming"}
            </Button>
          )
        ) : null,
    },
  ];

  const checkedInCount = bookings.filter((b) => b.status === "checked_in").length;
  const prebookedCount = bookings.filter((b) => b.status === "prebooked").length;

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Booking History</h2>
          <p className={dashStyles["page-header__subtitle"]}>
            {checkedInCount} checked in · {prebookedCount} pre-booked
          </p>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: "var(--radius-lg)" }} />
      ) : (
        <Table
          columns={columns}
          data={bookings as unknown as Record<string, unknown>[]}
          emptyMessage="No bookings yet"
          emptyIcon={<ClipboardList size={48} className="opacity-50" />}
        />
      )}

      <Modal
        isOpen={!!editingBooking}
        onClose={() => !savingEdit && setEditingBooking(null)}
        title={editingBooking ? `Edit Pre-booking · ${editingBooking.guest_name}` : "Edit Pre-booking"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingBooking(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={handleSaveEditedPrebooking} loading={savingEdit}>
              Save Changes
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <Select
            label="Room"
            value={editForm.room_id}
            onChange={(e) => updateEditForm("room_id", e.target.value)}
            options={roomOptions}
            required
          />
          <Input
            label="Guest Name"
            value={editForm.guest_name}
            onChange={(e) => updateEditForm("guest_name", e.target.value)}
            required
          />
          <Input
            label="Guest Phone"
            value={editForm.guest_phone}
            onChange={(e) => updateEditForm("guest_phone", e.target.value)}
            required
          />
          <Select
            label="ID Type"
            value={editForm.guest_id_type}
            onChange={(e) => updateEditForm("guest_id_type", e.target.value)}
            options={[...ID_TYPES]}
          />
          <Input
            label="ID Number"
            value={editForm.guest_id_number}
            onChange={(e) => updateEditForm("guest_id_number", e.target.value)}
          />
          <Input
            label="Check-in Date"
            type="date"
            value={editForm.check_in_date}
            onChange={(e) => updateEditForm("check_in_date", e.target.value)}
            required
          />
          <Input
            label="Check-out Date"
            type="date"
            value={editForm.check_out_date}
            onChange={(e) => updateEditForm("check_out_date", e.target.value)}
            required
          />
          <Input
            label="Rate per Night"
            type="number"
            value={editForm.rate_per_night}
            onChange={(e) => updateEditForm("rate_per_night", e.target.value)}
            required
          />
          <Select
            label="Payment Mode"
            value={editForm.payment_mode}
            onChange={(e) => updateEditForm("payment_mode", e.target.value)}
            options={[...PAYMENT_MODES]}
          />
          <Textarea
            label="Notes"
            value={editForm.notes}
            onChange={(e) => updateEditForm("notes", e.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}
