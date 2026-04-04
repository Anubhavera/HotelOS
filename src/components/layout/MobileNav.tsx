"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./MobileNav.module.css";

const navItems = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/dashboard/hotel", label: "Hotel", icon: "🏨" },
  { href: "/dashboard/restaurant", label: "Restaurant", icon: "🍽️" },
  { href: "/dashboard/expenses", label: "Expenses", icon: "🧾" },
  { href: "/dashboard/reports", label: "Reports", icon: "📈" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className={styles["mobile-nav"]}>
      <ul className={styles["mobile-nav__list"]}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <li key={item.href} className={styles["mobile-nav__item"]}>
              <Link
                href={item.href}
                className={`${styles["mobile-nav__link"]} ${
                  isActive ? styles["mobile-nav__link--active"] : ""
                }`}
              >
                <span className={styles["mobile-nav__icon"]}>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
