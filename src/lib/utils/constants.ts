export const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
] as const;

export const ROOM_TYPES = [
  { value: "standard", label: "Standard" },
  { value: "deluxe", label: "Deluxe" },
  { value: "suite", label: "Suite" },
] as const;

export const ID_TYPES = [
  { value: "aadhar", label: "Aadhaar Card" },
  { value: "passport", label: "Passport" },
  { value: "driving_license", label: "Driving License" },
  { value: "voter_id", label: "Voter ID" },
  { value: "pan", label: "PAN Card" },
] as const;

export const ORDER_TYPES = [
  { value: "dine_in", label: "Dine In" },
  { value: "takeaway", label: "Takeaway" },
  { value: "delivery", label: "Delivery" },
] as const;

export const DEPARTMENTS = [
  { value: "front-desk", label: "Front Desk" },
  { value: "restaurant", label: "Restaurant" },
  { value: "kitchen", label: "Kitchen" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "maintenance", label: "Maintenance" },
  { value: "management", label: "Management" },
  { value: "security", label: "Security" },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "kitchen", label: "Kitchen Supplies" },
  { value: "maintenance", label: "Maintenance" },
  { value: "supplies", label: "Office Supplies" },
  { value: "laundry", label: "Laundry" },
  { value: "marketing", label: "Marketing" },
  { value: "transport", label: "Transport" },
] as const;

export const BILL_TYPES = [
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "gas", label: "Gas" },
  { value: "internet", label: "Internet" },
  { value: "other", label: "Other" },
] as const;

export const MENU_CATEGORIES = [
  "Starters",
  "Main Course",
  "Breads",
  "Rice & Biryani",
  "Chinese",
  "Beverages",
  "Desserts",
  "Snacks",
] as const;

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, "application/pdf"];
