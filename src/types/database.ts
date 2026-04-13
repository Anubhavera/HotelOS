/* ═══════════════════════════════════════════
   DATABASE TYPES — mirrors Supabase schema
   ═══════════════════════════════════════════ */

// ── Core ──

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  logo_url: string | null;
  whatsapp_number: string | null;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: "owner" | "manager" | "staff";
  department: string | null;
  joined_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
}

// ── Hotel ──

export interface Room {
  id: string;
  org_id: string;
  room_number: string;
  room_type: "standard" | "deluxe" | "suite";
  rate_per_night: number;
  status: "available" | "occupied" | "maintenance";
  floor: number | null;
  created_at: string;
}

export interface Booking {
  id: string;
  org_id: string;
  room_id: string;
  guest_name: string;
  guest_phone: string;
  guest_id_type: string | null;
  guest_id_number: string | null;
  guest_id_proof_url: string | null;
  check_in: string;
  check_out: string | null;
  expected_check_out: string | null;
  rate_per_night: number;
  total_amount: number | null;
  payment_mode: PaymentMode | null;
  payment_proof_url: string | null;
  payment_status: "pending" | "partial" | "paid";
  status: "prebooked" | "checked_in" | "checked_out" | "cancelled";
  notes: string | null;
  created_by: string;
  created_at: string;
  // Joined fields
  room?: Room;
}

// ── Restaurant ──

export interface MenuItem {
  id: string;
  org_id: string;
  name: string;
  category: string | null;
  price: number;
  is_available: boolean;
  created_at: string;
}

/**
 * RestaurantOrder = one KOT (Kitchen Order Ticket).
 *
 * A single table session can produce MANY KOTs (each time new items are
 * ordered, a fresh KOT is created and sent to the kitchen).
 *
 * At checkout, all open KOTs for the same table are grouped into one
 * RestaurantBill (referenced via bill_group_id → restaurant_bills.id).
 *
 * Payment info lives on RestaurantBill, NOT on individual KOTs.
 */
export interface RestaurantOrder {
  id: string;
  org_id: string;
  /** Auto-incrementing kitchen ticket number, unique per org */
  kot_number: number;
  table_number: string | null;
  customer_name: string | null;
  order_type: "dine_in" | "takeaway" | "delivery";
  /** active → kitchen preparing → completed (or cancelled) */
  status: "active" | "preparing" | "completed" | "cancelled";
  cancel_reason: string | null;
  /**
   * @deprecated Kept for backward-compat. Payment mode now belongs on
   * RestaurantBill. Filled in on existing records only.
   */
  payment_mode: PaymentMode | null;
  /**
   * @deprecated Kept for backward-compat. Now on RestaurantBill.
   */
  payment_reference: string | null;
  /** FK → restaurant_bills.id. Null until the table is checked out. */
  bill_group_id: string | null;
  /** Sum of order_items.total_price for this KOT only. */
  total_amount: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  prepared_at: string | null;
  completed_at: string | null;
  // Joined fields
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

/**
 * RestaurantBill = the final checkout document.
 *
 * Created when the waiter finalizes checkout for a table.
 * Multiple KOTs (RestaurantOrder rows) share the same bill_group_id,
 * which points to this table's row.
 */
export interface RestaurantBill {
  id: string;
  org_id: string;
  table_number: string | null;
  customer_name: string;
  payment_mode: PaymentMode;
  payment_reference: string | null;
  notes: string | null;
  /** Sum of all KOT total_amounts under this bill */
  total_amount: number;
  created_by: string;
  created_at: string;
  // Joined fields (when fetched with KOTs)
  kots?: RestaurantOrder[];
}

// ── Finance ──

export interface Salary {
  id: string;
  org_id: string;
  employee_name: string;
  department: string;
  monthly_salary: number;
  payment_month: string;
  payment_status: "pending" | "paid";
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  org_id: string;
  item_name: string;
  category: string;
  price: number;
  quantity: number;
  total_amount: number;
  date: string;
  bill_proof_url: string | null;
  vendor: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface UtilityBill {
  id: string;
  org_id: string;
  bill_type: "electricity" | "water" | "gas" | "internet" | "other";
  amount: number;
  billing_period_start: string | null;
  billing_period_end: string | null;
  due_date: string | null;
  paid: boolean;
  paid_at: string | null;
  bill_proof_url: string | null;
  notes: string | null;
  created_at: string;
}

// ── Shared ──

export type PaymentMode = "cash" | "upi" | "card" | "bank_transfer";

export type UserRole = "owner" | "manager" | "staff";

// ── Dashboard Stats ──
export interface DashboardStats {
  totalRooms: number;
  occupiedRooms: number;
  todayRevenue: number;
  todayOrders: number;
  monthExpenses: number;
  monthRevenue: number;
}
