import styles from "./Badge.module.css";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "error" | "warning" | "info" | "neutral" | "primary";
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = "neutral",
  dot = false,
  pulse = false,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`${styles.badge} ${styles[`badge--${variant}`]} ${className}`}
    >
      {dot && (
        <span
          className={`${styles.badge__dot} ${pulse ? styles["badge__dot--pulse"] : ""}`}
        />
      )}
      {children}
    </span>
  );
}

/** Helper: map booking/room status to badge variant */
export function getStatusVariant(
  status: string
): "success" | "error" | "warning" | "info" | "neutral" {
  switch (status) {
    case "available":
    case "paid":
    case "completed":
    case "checked_out":
      return "success";
    case "occupied":
    case "checked_in":
    case "active":
      return "info";
    case "prebooked":
    case "preparing":
    case "pending":
    case "partial":
      return "warning";
    case "cancelled":
    case "maintenance":
      return "error";
    default:
      return "neutral";
  }
}
