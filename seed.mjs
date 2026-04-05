// Royal Hotels & Royal Restaurant — Database Seed Script
// Run: node seed.mjs
// Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ── Read .env.local ──────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, ".env.local");
const envContent = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => l.trim().split("=").map((s) => s.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join("=")])
);

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_ROLE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const log = (msg) => console.log(`  ${msg}`);
const ok = (msg) => console.log(`  ✅ ${msg}`);
const err = (msg, e) => console.error(`  ❌ ${msg}:`, e?.message || e);

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}
function monthStart(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  return d.toISOString().split("T")[0];
}
function dateStr(n = 0) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

// ── Main Seed ────────────────────────────────────────────────────────────────
async function seed() {
  console.log("\n🌱 HotelOS Seed Script — Royal Hotels & Royal Restaurant\n");

  // ── 1. Create test user ────────────────────────────────────────────────────
  console.log("📧 Creating owner account...");
  const email = "owner@royalhotels.in";
  const password = "Royal@1234";

  let userId;
  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === email);

  if (existing) {
    userId = existing.id;
    log(`User already exists (${email})`);
  } else {
    const { data: newUser, error: userErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Royal Admin" },
    });
    if (userErr) { err("Failed to create user", userErr); process.exit(1); }
    userId = newUser.user.id;
    ok(`Created user: ${email} / password: ${password}`);
  }

  // ── 2. Create Organization ─────────────────────────────────────────────────
  console.log("\n🏨 Setting up organisation...");
  let orgId;
  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "royal-hotels")
    .single();

  if (existingOrg) {
    orgId = existingOrg.id;
    log("Organisation already exists");
  } else {
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({
        name: "Royal Hotels",
        slug: "royal-hotels",
        owner_id: userId,
        whatsapp_number: "+919876543210",
        settings: { currency: "INR", timezone: "Asia/Kolkata" },
      })
      .select()
      .single();
    if (orgErr) { err("Failed to create org", orgErr); process.exit(1); }
    orgId = org.id;
    ok(`Created org: Royal Hotels (${orgId})`);
  }

  // ── 3. Create org membership ──────────────────────────────────────────────
  const { data: existingMember } = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .single();

  if (!existingMember) {
    await supabase.from("org_members").insert({
      org_id: orgId,
      user_id: userId,
      role: "owner",
      department: "management",
    });
    ok("Created owner membership");
  }

  // Create a staff user for testing role-based access
  let staffUserId;
  const staffEmail = "staff@royalhotels.in";
  const existingStaff = existingUsers?.users?.find((u) => u.email === staffEmail);
  if (existingStaff) {
    staffUserId = existingStaff.id;
  } else {
    const { data: staffUser } = await supabase.auth.admin.createUser({
      email: staffEmail,
      password: "Staff@1234",
      email_confirm: true,
      user_metadata: { full_name: "Ramesh Kumar" },
    });
    staffUserId = staffUser?.user?.id;
    if (staffUserId) {
      await supabase.from("org_members").insert({
        org_id: orgId,
        user_id: staffUserId,
        role: "staff",
        department: "front-desk",
      });
      ok(`Created staff: ${staffEmail} / Staff@1234`);
    }
  }

  // ── 4. Rooms ──────────────────────────────────────────────────────────────
  console.log("\n🛏  Seeding rooms...");
  const { data: existingRooms } = await supabase.from("rooms").select("id").eq("org_id", orgId);

  let rooms = existingRooms || [];
  if (rooms.length === 0) {
    const roomData = [
      // Floor 1 — Standard
      { room_number: "101", room_type: "standard", rate_per_night: 1500, floor: 1, status: "occupied" },
      { room_number: "102", room_type: "standard", rate_per_night: 1500, floor: 1, status: "available" },
      { room_number: "103", room_type: "standard", rate_per_night: 1500, floor: 1, status: "occupied" },
      { room_number: "104", room_type: "standard", rate_per_night: 1500, floor: 1, status: "available" },
      { room_number: "105", room_type: "standard", rate_per_night: 1500, floor: 1, status: "maintenance" },
      // Floor 2 — Deluxe
      { room_number: "201", room_type: "deluxe", rate_per_night: 2500, floor: 2, status: "occupied" },
      { room_number: "202", room_type: "deluxe", rate_per_night: 2500, floor: 2, status: "occupied" },
      { room_number: "203", room_type: "deluxe", rate_per_night: 2500, floor: 2, status: "available" },
      { room_number: "204", room_type: "deluxe", rate_per_night: 2500, floor: 2, status: "available" },
      // Floor 3 — Suite
      { room_number: "301", room_type: "suite", rate_per_night: 5000, floor: 3, status: "occupied" },
      { room_number: "302", room_type: "suite", rate_per_night: 5000, floor: 3, status: "available" },
      { room_number: "303", room_type: "suite", rate_per_night: 6000, floor: 3, status: "available" },
    ];

    const { data: insertedRooms, error: roomErr } = await supabase
      .from("rooms")
      .insert(roomData.map((r) => ({ ...r, org_id: orgId })))
      .select();

    if (roomErr) { err("Rooms insert failed", roomErr); }
    else { rooms = insertedRooms; ok(`Created ${rooms.length} rooms (Floors 1-3)`); }
  } else {
    log(`Rooms already exist (${rooms.length})`);
  }

  // ── 5. Bookings ───────────────────────────────────────────────────────────
  console.log("\n📋 Seeding bookings...");
  const { data: existingBookings } = await supabase.from("bookings").select("id").eq("org_id", orgId);

  if (!existingBookings || existingBookings.length === 0) {
    const occupiedRooms = rooms.filter((r) => r.status === "occupied");
    const bookings = [
      {
        room_id: occupiedRooms[0]?.id,
        guest_name: "Rajesh Sharma",
        guest_phone: "9876543201",
        guest_id_type: "aadhar",
        guest_id_number: "1234 5678 9012",
        check_in: daysAgo(2),
        expected_check_out: daysFromNow(1),
        rate_per_night: 1500,
        payment_mode: "upi",
        payment_status: "paid",
        status: "checked_in",
        notes: "Requested extra pillow",
        created_by: userId,
      },
      {
        room_id: occupiedRooms[1]?.id,
        guest_name: "Priya Mehta",
        guest_phone: "9876543202",
        guest_id_type: "passport",
        guest_id_number: "N1234567",
        check_in: daysAgo(1),
        expected_check_out: daysFromNow(3),
        rate_per_night: 2500,
        payment_mode: "card",
        payment_status: "paid",
        status: "checked_in",
        created_by: userId,
      },
      {
        room_id: occupiedRooms[2]?.id,
        guest_name: "Arjun Kapoor",
        guest_phone: "9876543203",
        guest_id_type: "driving_license",
        guest_id_number: "DL0420110012345",
        check_in: daysAgo(3),
        expected_check_out: daysFromNow(0),
        rate_per_night: 2500,
        payment_mode: "cash",
        payment_status: "partial",
        status: "checked_in",
        created_by: userId,
      },
      {
        room_id: occupiedRooms[3]?.id,
        guest_name: "Sunita Desai",
        guest_phone: "9876543204",
        guest_id_type: "aadhar",
        guest_id_number: "9876 5432 1098",
        check_in: daysAgo(0),
        expected_check_out: daysFromNow(2),
        rate_per_night: 5000,
        payment_mode: "bank_transfer",
        payment_status: "paid",
        status: "checked_in",
        created_by: userId,
      },
      // Past bookings (checked out)
      {
        room_id: rooms[0]?.id,
        guest_name: "Vikram Nair",
        guest_phone: "9876543205",
        guest_id_type: "aadhar",
        guest_id_number: "5555 6666 7777",
        check_in: daysAgo(10),
        check_out: daysAgo(7),
        expected_check_out: daysAgo(7),
        rate_per_night: 1500,
        total_amount: 4500,
        payment_mode: "upi",
        payment_status: "paid",
        status: "checked_out",
        created_by: userId,
      },
      {
        room_id: rooms[1]?.id,
        guest_name: "Kavita Singh",
        guest_phone: "9876543206",
        guest_id_type: "voter_id",
        guest_id_number: "XYZ1234567",
        check_in: daysAgo(15),
        check_out: daysAgo(12),
        expected_check_out: daysAgo(12),
        rate_per_night: 1500,
        total_amount: 4500,
        payment_mode: "cash",
        payment_status: "paid",
        status: "checked_out",
        created_by: userId,
      },
    ];

    const validBookings = bookings.filter((b) => b.room_id);
    const { error: bookErr } = await supabase.from("bookings").insert(
      validBookings.map((b) => ({ ...b, org_id: orgId }))
    );
    if (bookErr) err("Bookings insert failed", bookErr);
    else ok(`Created ${validBookings.length} bookings`);
  } else {
    log(`Bookings already exist (${existingBookings.length})`);
  }

  // ── 6. Menu Items ─────────────────────────────────────────────────────────
  console.log("\n🍽  Seeding Royal Restaurant menu...");
  const { data: existingMenu } = await supabase.from("menu_items").select("id").eq("org_id", orgId);

  let menuItems = [];
  if (!existingMenu || existingMenu.length === 0) {
    const menuData = [
      // Starters
      { name: "Paneer Tikka", category: "Starters", price: 280 },
      { name: "Chicken Tikka", category: "Starters", price: 320 },
      { name: "Veg Spring Roll", category: "Starters", price: 180 },
      { name: "Soup of the Day", category: "Starters", price: 120 },
      { name: "Fish Fingers", category: "Starters", price: 350 },
      // Main Course
      { name: "Butter Chicken", category: "Main Course", price: 380 },
      { name: "Dal Makhani", category: "Main Course", price: 250 },
      { name: "Palak Paneer", category: "Main Course", price: 260 },
      { name: "Mutton Rogan Josh", category: "Main Course", price: 450 },
      { name: "Kadai Chicken", category: "Main Course", price: 380 },
      { name: "Shahi Paneer", category: "Main Course", price: 280 },
      { name: "Veg Korma", category: "Main Course", price: 240 },
      // Breads
      { name: "Butter Naan", category: "Breads", price: 50 },
      { name: "Garlic Naan", category: "Breads", price: 60 },
      { name: "Tandoori Roti", category: "Breads", price: 35 },
      { name: "Butter Paratha", category: "Breads", price: 60 },
      // Rice & Biryani
      { name: "Chicken Biryani", category: "Rice & Biryani", price: 350 },
      { name: "Veg Biryani", category: "Rice & Biryani", price: 280 },
      { name: "Steamed Rice", category: "Rice & Biryani", price: 80 },
      { name: "Jeera Rice", category: "Rice & Biryani", price: 120 },
      // Beverages
      { name: "Masala Chai", category: "Beverages", price: 40 },
      { name: "Cold Coffee", category: "Beverages", price: 120 },
      { name: "Mango Lassi", category: "Beverages", price: 100 },
      { name: "Fresh Lime Soda", category: "Beverages", price: 80 },
      { name: "Water Bottle", category: "Beverages", price: 30 },
      // Desserts
      { name: "Gulab Jamun", category: "Desserts", price: 100 },
      { name: "Ice Cream (2 Scoops)", category: "Desserts", price: 120 },
      { name: "Rasmalai", category: "Desserts", price: 130 },
    ];

    const { data: inserted, error: menuErr } = await supabase
      .from("menu_items")
      .insert(menuData.map((m) => ({ ...m, org_id: orgId, is_available: true })))
      .select();

    if (menuErr) { err("Menu insert failed", menuErr); }
    else { menuItems = inserted; ok(`Created ${menuItems.length} menu items`); }
  } else {
    menuItems = existingMenu;
    log(`Menu already exists (${menuItems.length} items)`);
    // Fetch full menu for order creation
    const { data: fullMenu } = await supabase.from("menu_items").select("*").eq("org_id", orgId);
    menuItems = fullMenu || [];
  }

  // ── 7. Restaurant Orders ──────────────────────────────────────────────────
  console.log("\n🧾 Seeding restaurant orders...");
  const { data: existingOrders } = await supabase.from("restaurant_orders").select("id").eq("org_id", orgId);

  if (!existingOrders || existingOrders.length === 0) {
    const findItem = (name) => menuItems.find((m) => m.name === name);

    const ordersToCreate = [
      // Today — active
      {
        table_number: "3",
        order_type: "dine_in",
        status: "active",
        payment_mode: "cash",
        created_at: new Date().toISOString(),
        items: [
          { item: findItem("Butter Chicken"), qty: 2 },
          { item: findItem("Garlic Naan"), qty: 4 },
          { item: findItem("Mango Lassi"), qty: 2 },
        ],
      },
      {
        table_number: "7",
        order_type: "dine_in",
        status: "active",
        payment_mode: "upi",
        created_at: new Date().toISOString(),
        items: [
          { item: findItem("Chicken Biryani"), qty: 1 },
          { item: findItem("Masala Chai"), qty: 2 },
          { item: findItem("Gulab Jamun"), qty: 2 },
        ],
      },
      // Today — completed
      {
        table_number: "2",
        order_type: "dine_in",
        status: "completed",
        payment_mode: "upi",
        created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        completed_at: new Date(Date.now() - 1.5 * 3600000).toISOString(),
        items: [
          { item: findItem("Paneer Tikka"), qty: 1 },
          { item: findItem("Dal Makhani"), qty: 2 },
          { item: findItem("Butter Naan"), qty: 4 },
          { item: findItem("Fresh Lime Soda"), qty: 2 },
        ],
      },
      {
        table_number: "5",
        order_type: "dine_in",
        status: "completed",
        payment_mode: "card",
        created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
        completed_at: new Date(Date.now() - 3.5 * 3600000).toISOString(),
        items: [
          { item: findItem("Chicken Tikka"), qty: 1 },
          { item: findItem("Mutton Rogan Josh"), qty: 1 },
          { item: findItem("Garlic Naan"), qty: 3 },
          { item: findItem("Rasmalai"), qty: 2 },
        ],
      },
      {
        table_number: null,
        order_type: "takeaway",
        status: "completed",
        payment_mode: "cash",
        created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
        completed_at: new Date(Date.now() - 4.8 * 3600000).toISOString(),
        items: [
          { item: findItem("Veg Biryani"), qty: 2 },
          { item: findItem("Gulab Jamun"), qty: 2 },
        ],
      },
      // Today — cancelled
      {
        table_number: "1",
        order_type: "dine_in",
        status: "cancelled",
        cancel_reason: "Guest left without ordering",
        payment_mode: "cash",
        created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
        items: [
          { item: findItem("Butter Chicken"), qty: 1 },
          { item: findItem("Butter Naan"), qty: 2 },
        ],
      },
      // Yesterday
      {
        table_number: "4",
        order_type: "dine_in",
        status: "completed",
        payment_mode: "upi",
        created_at: daysAgo(1),
        completed_at: daysAgo(1),
        items: [
          { item: findItem("Chicken Biryani"), qty: 3 },
          { item: findItem("Masala Chai"), qty: 3 },
          { item: findItem("Ice Cream (2 Scoops)"), qty: 2 },
        ],
      },
      {
        table_number: "9",
        order_type: "dine_in",
        status: "completed",
        payment_mode: "cash",
        created_at: daysAgo(1),
        completed_at: daysAgo(1),
        items: [
          { item: findItem("Palak Paneer"), qty: 2 },
          { item: findItem("Shahi Paneer"), qty: 1 },
          { item: findItem("Garlic Naan"), qty: 6 },
          { item: findItem("Mango Lassi"), qty: 3 },
        ],
      },
    ];

    let ordersCreated = 0;
    for (const order of ordersToCreate) {
      const validItems = order.items.filter((i) => i.item);
      if (validItems.length === 0) continue;

      const totalAmount = validItems.reduce((sum, i) => sum + i.item.price * i.qty, 0);

      const { data: createdOrder, error: orderErr } = await supabase
        .from("restaurant_orders")
        .insert({
          org_id: orgId,
          table_number: order.table_number,
          order_type: order.order_type,
          status: order.status,
          cancel_reason: order.cancel_reason || null,
          payment_mode: order.payment_mode,
          total_amount: totalAmount,
          created_by: userId,
          created_at: order.created_at,
          completed_at: order.completed_at || null,
        })
        .select()
        .single();

      if (orderErr || !createdOrder) { err(`Order insert failed`, orderErr); continue; }

      const orderItems = validItems.map((i) => ({
        order_id: createdOrder.id,
        menu_item_id: i.item.id,
        item_name: i.item.name,
        quantity: i.qty,
        unit_price: i.item.price,
        total_price: i.item.price * i.qty,
      }));

      await supabase.from("order_items").insert(orderItems);
      ordersCreated++;
    }
    ok(`Created ${ordersCreated} restaurant orders with items`);
  } else {
    log(`Orders already exist (${existingOrders.length})`);
  }

  // ── 8. Salaries ───────────────────────────────────────────────────────────
  console.log("\n💰 Seeding salaries...");
  const thisMonth = monthStart(0);
  const { data: existingSalaries } = await supabase
    .from("salaries")
    .select("id")
    .eq("org_id", orgId)
    .eq("payment_month", thisMonth);

  if (!existingSalaries || existingSalaries.length === 0) {
    const salaryData = [
      { employee_name: "Ramesh Kumar", department: "front-desk", monthly_salary: 18000, payment_status: "paid", paid_at: daysAgo(2) },
      { employee_name: "Sunita Rao", department: "housekeeping", monthly_salary: 14000, payment_status: "paid", paid_at: daysAgo(2) },
      { employee_name: "Deepak Verma", department: "restaurant", monthly_salary: 16000, payment_status: "pending" },
      { employee_name: "Chef Mohan Lal", department: "kitchen", monthly_salary: 25000, payment_status: "pending" },
      { employee_name: "Raju Gupta", department: "security", monthly_salary: 13000, payment_status: "paid", paid_at: daysAgo(2) },
      { employee_name: "Anita Thakur", department: "restaurant", monthly_salary: 15000, payment_status: "pending" },
      { employee_name: "Prakash Singh", department: "maintenance", monthly_salary: 14500, payment_status: "pending" },
    ];

    const { error: salErr } = await supabase.from("salaries").insert(
      salaryData.map((s) => ({ ...s, org_id: orgId, payment_month: thisMonth }))
    );
    if (salErr) err("Salaries insert failed", salErr);
    else ok(`Created ${salaryData.length} salary entries for ${new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })}`);
  } else {
    log(`Salaries already exist (${existingSalaries.length})`);
  }

  // ── 9. Expenses ───────────────────────────────────────────────────────────
  console.log("\n🧾 Seeding expenses...");
  const { data: existingExpenses } = await supabase
    .from("expenses")
    .select("id")
    .eq("org_id", orgId)
    .gte("date", monthStart(0));

  if (!existingExpenses || existingExpenses.length === 0) {
    const expenseData = [
      { item_name: "Rice (50 kg)", category: "kitchen", price: 60, quantity: 50, date: dateStr(-2), vendor: "Aggarwal Traders" },
      { item_name: "Cooking Oil (15 L)", category: "kitchen", price: 160, quantity: 15, date: dateStr(-2), vendor: "Aggarwal Traders" },
      { item_name: "Chicken (20 kg)", category: "kitchen", price: 220, quantity: 20, date: dateStr(-1), vendor: "Fresh Farms" },
      { item_name: "Cleaning Supplies", category: "maintenance", price: 2800, quantity: 1, date: dateStr(-4), vendor: "CleanMart" },
      { item_name: "Toilet Rolls (48 pack)", category: "supplies", price: 1200, quantity: 2, date: dateStr(-4), vendor: "Metro Cash & Carry" },
      { item_name: "Paneer (10 kg)", category: "kitchen", price: 320, quantity: 10, date: dateStr(0), vendor: "Fresh Farms" },
      { item_name: "Vegetables (assorted)", category: "kitchen", price: 3500, quantity: 1, date: dateStr(0), vendor: "Vegetable Mandi" },
      { item_name: "Light Bulbs & Fixtures", category: "maintenance", price: 450, quantity: 4, date: dateStr(-6), vendor: "Electrical World" },
      { item_name: "Room Freshener", category: "supplies", price: 180, quantity: 6, date: dateStr(-5), vendor: "Metro Cash & Carry" },
      { item_name: "Office Stationery", category: "general", price: 650, quantity: 1, date: dateStr(-7), vendor: "Star Stationery" },
      { item_name: "Mutton (8 kg)", category: "kitchen", price: 680, quantity: 8, date: dateStr(-3), vendor: "Fresh Farms" },
      { item_name: "Bed Sheets (set of 6)", category: "supplies", price: 2200, quantity: 2, date: dateStr(-8), vendor: "Ravi Textiles" },
    ];

    const { error: expErr } = await supabase.from("expenses").insert(
      expenseData.map((e) => ({
        ...e,
        org_id: orgId,
        total_amount: e.price * e.quantity,
        created_by: userId,
      }))
    );
    if (expErr) err("Expenses insert failed", expErr);
    else ok(`Created ${expenseData.length} expense entries`);
  } else {
    log(`Expenses already exist (${existingExpenses.length})`);
  }

  // ── 10. Utility Bills ─────────────────────────────────────────────────────
  console.log("\n⚡ Seeding utility bills...");
  const { data: existingBills } = await supabase.from("utility_bills").select("id").eq("org_id", orgId);

  if (!existingBills || existingBills.length === 0) {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lm = lastMonth.toISOString().split("T")[0].slice(0, 7);

    const billData = [
      {
        bill_type: "electricity",
        amount: 18500,
        billing_period_start: `${lm}-01`,
        billing_period_end: `${lm}-${new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getDate()}`,
        due_date: dateStr(5),
        paid: false,
      },
      {
        bill_type: "water",
        amount: 4200,
        billing_period_start: `${lm}-01`,
        billing_period_end: `${lm}-${new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getDate()}`,
        due_date: dateStr(8),
        paid: true,
        paid_at: daysAgo(3),
      },
      {
        bill_type: "internet",
        amount: 2999,
        billing_period_start: `${lm}-01`,
        billing_period_end: dateStr(0),
        due_date: dateStr(2),
        paid: true,
        paid_at: daysAgo(5),
      },
      {
        bill_type: "gas",
        amount: 6800,
        billing_period_start: `${lm}-01`,
        billing_period_end: `${lm}-${new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getDate()}`,
        due_date: dateStr(10),
        paid: false,
      },
    ];

    const { error: billErr } = await supabase.from("utility_bills").insert(
      billData.map((b) => ({ ...b, org_id: orgId }))
    );
    if (billErr) err("Utility bills insert failed", billErr);
    else ok(`Created ${billData.length} utility bills`);
  } else {
    log(`Utility bills already exist (${existingBills.length})`);
  }

  // ── Done! ─────────────────────────────────────────────────────────────────
  console.log("\n🎉 Seed complete!\n");
  console.log("  Login credentials:");
  console.log("  📧 Owner:  owner@royalhotels.in  /  Royal@1234");
  console.log("  📧 Staff:  staff@royalhotels.in  /  Staff@1234");
  console.log("\n  Open: http://localhost:3001/login\n");
}

seed().catch((e) => { console.error("Seed failed:", e); process.exit(1); });
