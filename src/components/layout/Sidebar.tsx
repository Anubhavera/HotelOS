"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Hotel, 
  UtensilsCrossed, 
  Banknote, 
  Receipt, 
  Zap, 
  LineChart, 
  CalendarDays, 
  Settings, 
  Users 
} from "lucide-react";
import { IconBox, IconBoxColor } from "@/components/ui/IconBox";
import styles from "./Sidebar.module.css";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  color: IconBoxColor;
}

interface NavSection {
  title: string;
  items: NavItem[];
  requiredRole?: string[];
}

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "blue" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/dashboard/hotel", label: "Hotel Rooms", icon: Hotel, color: "gold" },
      { href: "/dashboard/restaurant", label: "Restaurant", icon: UtensilsCrossed, color: "orange" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/dashboard/salaries", label: "Salaries", icon: Banknote, color: "green" },
      { href: "/dashboard/expenses", label: "Expenses", icon: Receipt, color: "red" },
      { href: "/dashboard/expenses/utilities", label: "Utility Bills", icon: Zap, color: "blue" },
    ],
    requiredRole: ["owner", "manager"],
  },
  {
    title: "Reports",
    items: [
      { href: "/dashboard/reports", label: "Month End", icon: LineChart, color: "purple" },
      { href: "/dashboard/reports/calendar", label: "Calendar", icon: CalendarDays, color: "red" },
    ],
    requiredRole: ["owner", "manager"],
  },
  {
    title: "Settings",
    items: [
      { href: "/dashboard/settings", label: "Organization", icon: Settings, color: "slate" },
      { href: "/dashboard/settings/staff", label: "Staff", icon: Users, color: "blue" },
    ],
    requiredRole: ["owner"],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  orgName?: string;
  userName?: string;
  userRole?: string;
}

export function Sidebar({
  isOpen,
  onClose,
  orgName = "Royal Hotels",
  userName = "Owner",
  userRole = "owner",
}: SidebarProps) {
  const pathname = usePathname();

  const filteredSections = navSections.filter(
    (section) =>
      !section.requiredRole || section.requiredRole.includes(userRole)
  );

  return (
    <>
      {isOpen && (
        <div
          className={styles["sidebar-backdrop"]}
          onClick={onClose}
        />
      )}
      <aside
        className={`${styles.sidebar} ${isOpen ? styles["sidebar--open"] : ""}`}
      >
        <div className={styles.sidebar__brand}>
          <div className={styles.sidebar__logo}>H</div>
          <div>
            <div className={styles["sidebar__brand-name"]}>HotelOS</div>
            <div className={styles["sidebar__brand-org"]}>{orgName}</div>
          </div>
        </div>

        <nav className={styles.sidebar__nav}>
          {filteredSections.map((section) => (
            <div key={section.title} className={styles.sidebar__section}>
              <div className={styles["sidebar__section-title"]}>
                {section.title}
              </div>
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.sidebar__link} ${
                      isActive ? styles["sidebar__link--active"] : ""
                    }`}
                    onClick={onClose}
                  >
                    <span className={styles["sidebar__link-icon"]}>
                      <IconBox icon={item.icon} color={item.color} size="sm" />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={styles.sidebar__footer}>
          <div className={styles.sidebar__user}>
            <div className={styles.sidebar__avatar}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className={styles["sidebar__user-info"]}>
              <div className={styles["sidebar__user-name"]}>{userName}</div>
              <div className={styles["sidebar__user-role"]}>{userRole}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
