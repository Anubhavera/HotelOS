import styles from "./Card.module.css";

interface CardProps {
  children: React.ReactNode;
  variant?: "default" | "flat" | "glass";
  hoverable?: boolean;
  clickable?: boolean;
  className?: string;
  onClick?: () => void;
}

export function Card({
  children,
  variant = "default",
  hoverable = false,
  clickable = false,
  className = "",
  onClick,
}: CardProps) {
  const classes = [
    styles.card,
    variant !== "default" && styles[`card--${variant}`],
    hoverable && styles["card--hoverable"],
    clickable && styles["card--clickable"],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`${styles.card__header} ${className}`}>{children}</div>;
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className={styles.card__title}>{children}</h3>;
}

export function CardSubtitle({ children }: { children: React.ReactNode }) {
  return <p className={styles.card__subtitle}>{children}</p>;
}

export function CardBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`${styles.card__body} ${className}`}>{children}</div>;
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className={styles.card__footer}>{children}</div>;
}
