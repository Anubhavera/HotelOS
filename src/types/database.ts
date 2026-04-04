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
  status: "checked_in" | "checked_out" | "cancelled";
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

export interface RestaurantOrder {
  id: string;
  org_id: string;
  kot_number: number;
  table_number: string | null;
  order_type: "dine_in" | "takeaway" | "delivery";
  status: "active" | "completed" | "cancelled";
  cancel_reason: string | null;
  payment_mode: PaymentMode | null;
  total_amount: number;
  notes: string | null;
  created_by: string;
  created_at: string;
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
