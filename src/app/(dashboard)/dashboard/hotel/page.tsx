"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/Button";
import { Badge, getStatusVariant } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Input";
import { showToast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/utils/formatters";
import { ROOM_TYPES } from "@/lib/utils/constants";
import type { Room } from "@/types/database";
import dashStyles from "../../dashboard.module.css";

export default function HotelPage() {
  const { org } = useOrg();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRoom, setNewRoom] = useState({
    room_number: "",
    room_type: "standard",
    rate_per_night: "",
    floor: "",
  });

  useEffect(() => {
    if (!org?.id) return;
    fetchRooms();
  }, [org?.id]);

  async function fetchRooms() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("org_id", org!.id)
      .order("room_number");

    if (!error && data) setRooms(data);
    setLoading(false);
  }

  async function addRoom() {
    if (!org?.id || !newRoom.room_number || !newRoom.rate_per_night) return;

    const supabase = createClient();
    const { error } = await supabase.from("rooms").insert({
      org_id: org.id,
      room_number: newRoom.room_number,
      room_type: newRoom.room_type,
      rate_per_night: parseFloat(newRoom.rate_per_night),
      floor: newRoom.floor ? parseInt(newRoom.floor) : null,
    });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Room added successfully!", "success");
    setShowAddModal(false);
    setNewRoom({ room_number: "", room_type: "standard", rate_per_night: "", floor: "" });
    fetchRooms();
  }

  const nextAvailable = rooms.find((r) => r.status === "available");

  const statusColors: Record<string, string> = {
    available: "#16a34a",
    occupied: "#2563eb",
    maintenance: "#dc2626",
  };

  return (
    <>
      <div className={dashStyles["page-header"]}>
        <div>
          <h2 className={dashStyles["page-header__title"]}>Hotel Rooms</h2>
          <p className={dashStyles["page-header__subtitle"]}>
            {rooms.filter((r) => r.status === "available").length} of {rooms.length} rooms available
          </p>
        </div>
        <div className={dashStyles["page-header__actions"]}>
          {nextAvailable && (
            <Button
              variant="secondary"
              onClick={() => {
                window.location.href = `/dashboard/hotel/check-in?room=${nextAvailable.id}`;
              }}
            >
              🏨 Next Empty: Room {nextAvailable.room_number}
            </Button>
          )}
          <Button onClick={() => setShowAddModal(true)}>+ Add Room</Button>
        </div>
      </div>

      {loading ? (
        <div className={dashStyles["stats-grid"]}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: "140px", borderRadius: "var(--radius-lg)" }}
            />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-16)", color: "var(--text-tertiary)" }}>
          <div style={{ fontSize: "3rem", marginBottom: "var(--space-4)" }}>🏨</div>
          <h3 style={{ color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>No rooms yet</h3>
          <p>Add your hotel rooms to get started with check-ins</p>
        </div>
      ) : (
        <div className={dashStyles["stats-grid"]} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {rooms.map((room) => (
            <div
              key={room.id}
              style={{
                background: "var(--bg-elevated)",
                border: `1px solid var(--border-default)`,
                borderLeft: `4px solid ${statusColors[room.status] || "#94a3b8"}`,
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-5)",
                cursor: room.status === "available" ? "pointer" : "default",
                transition: "all var(--transition-base)",
                animation: "slideUp var(--transition-slow) ease forwards",
              }}
              onClick={() => {
                if (room.status === "available") {
                  window.location.href = `/dashboard/hotel/check-in?room=${room.id}`;
                }
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                <span style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-primary)" }}>
                  {room.room_number}
                </span>
                <Badge variant={getStatusVariant(room.status)} dot pulse={room.status === "occupied"}>
                  {room.status}
                </Badge>
              </div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-1)" }}>
                {room.room_type.charAt(0).toUpperCase() + room.room_type.slice(1)}
              </div>
              <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--color-primary)" }}>
                {formatCurrency(room.rate_per_night)}/night
              </div>
              {room.floor && (
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--space-2)" }}>
                  Floor {room.floor}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Room"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={addRoom}>Add Room</Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <Input
            label="Room Number"
            placeholder="e.g., 101"
            value={newRoom.room_number}
            onChange={(e) => setNewRoom({ ...newRoom, room_number: e.target.value })}
            required
          />
          <Select
            label="Room Type"
            options={[...ROOM_TYPES]}
            value={newRoom.room_type}
            onChange={(e) => setNewRoom({ ...newRoom, room_type: e.target.value })}
          />
          <Input
            label="Rate per Night (₹)"
            type="number"
            placeholder="e.g., 2000"
            value={newRoom.rate_per_night}
            onChange={(e) => setNewRoom({ ...newRoom, rate_per_night: e.target.value })}
            required
          />
          <Input
            label="Floor"
            type="number"
            placeholder="e.g., 1"
            value={newRoom.floor}
            onChange={(e) => setNewRoom({ ...newRoom, floor: e.target.value })}
          />
        </div>
      </Modal>
    </>
  );
}
