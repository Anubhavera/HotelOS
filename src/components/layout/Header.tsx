"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils/formatters";
import styles from "./Header.module.css";

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className={styles.header}>
      <div className={styles.header__left}>
        <button
          className={styles["header__menu-btn"]}
          onClick={onMenuClick}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <h1 className={styles.header__title}>{title}</h1>
      </div>
      <div className={styles.header__right}>
        <span className={styles.header__date}>
          {formatDate(new Date(), {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
        <button className={styles.header__logout} onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
