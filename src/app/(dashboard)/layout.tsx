"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { ToastContainer } from "@/components/ui/Toast";
import { useOrg } from "@/hooks/useOrg";
import { createClient } from "@/lib/supabase/client";
import styles from "./dashboard.module.css";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/hotel": "Hotel Rooms",
  "/dashboard/hotel/check-in": "Check In",
  "/dashboard/hotel/bookings": "Bookings",
  "/dashboard/restaurant": "Restaurant",
  "/dashboard/restaurant/new-order": "New Order",
  "/dashboard/restaurant/menu": "Menu",
  "/dashboard/restaurant/sales": "Sales Report",
  "/dashboard/restaurant/cancellations": "Cancellations",
  "/dashboard/salaries": "Salaries",
  "/dashboard/expenses": "Expenses",
  "/dashboard/expenses/utilities": "Utility Bills",
  "/dashboard/reports": "Month End Report",
  "/dashboard/reports/calendar": "Calendar",
  "/dashboard/settings": "Settings",
  "/dashboard/settings/staff": "Staff Management",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("Owner");
  const pathname = usePathname();
  const { org, membership } = useOrg();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name =
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "Owner";
        setUserName(name);
      }
    });
  }, []);

  const title = pageTitles[pathname] || "Dashboard";

  return (
    <div className={styles["dashboard-layout"]}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        orgName={org?.name || "Royal Hotels"}
        userName={userName}
        userRole={membership?.role || "staff"}
      />
      <Header
        title={title}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />
      <main className={styles["dashboard-content"]}>
        <div className={styles["dashboard-page"]}>{children}</div>
      </main>
      <MobileNav />
      <ToastContainer />
    </div>
  );
}
