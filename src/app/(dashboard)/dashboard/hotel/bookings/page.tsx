"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Badge, getStatusVariant } from "@/components/ui/Badge";
import { Table } from "@/components/ui/Table";
import { showToast } from "@/components/ui/Toast";
import { formatCurrency, formatDateTime } from "@/lib/utils/formatters";
import type { Booking } from "@/types/database";
import dashStyles from "../../../dashboard.module.css";

export default function BookingsPage() {
  const { org } = useOrg();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org?.id) return;
    fetchBookings();
  }, [org?.id]);

  async function fetchBookings() {
    const supabase = createClient();
    const { data } = await supabase
      .from("bookings")
      .select("*, rooms(room_number)")
      .eq("org_id", org!.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setBookings(data as unknown as Booking[]);
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
        ) : null,
    },
  ];

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Booking History</h2>
          <p className={dashStyles["page-header__subtitle"]}>
            {bookings.filter((b) => b.status === "checked_in").length} currently checked in
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
          emptyIcon="📋"
        />
      )}
    </>
  );
}
