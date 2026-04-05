import React from "react";
import styles from "./IconBox.module.css";

export type IconBoxColor = "blue" | "orange" | "green" | "purple" | "slate" | "gold" | "red";
export type IconBoxSize = "sm" | "md" | "lg" | "xl";

interface IconBoxProps {
  icon: React.ElementType;
  color?: IconBoxColor;
  size?: IconBoxSize;
  className?: string;
}

export function IconBox({
  icon: Icon,
  color = "blue",
  size = "md",
  className = "",
}: IconBoxProps) {
  // Map size prop to icon render size
  const iconSizeMap = {
    sm: 16,
    md: 20,
    lg: 26,
    xl: 32,
  };

  return (
    <div
      className={`${styles.iconBox} ${styles[color]} ${styles[size]} ${className}`}
    >
      <Icon size={iconSizeMap[size]} strokeWidth={2.5} />
    </div>
  );
}
