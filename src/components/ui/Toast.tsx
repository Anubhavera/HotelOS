"use client";

import { useState, useEffect } from "react";
import styles from "./Toast.module.css";

export interface ToastData {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration?: number;
}

let toastListener: ((toast: ToastData) => void) | null = null;

export function showToast(
  message: string,
  type: ToastData["type"] = "info",
  duration = 4000
) {
  const toast: ToastData = {
    id: Date.now().toString(),
    message,
    type,
    duration,
  };
  toastListener?.(toast);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    toastListener = (toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.duration || 4000);
    };
    return () => {
      toastListener = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className={styles["toast-container"]}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[`toast--${toast.type}`]}`}
        >
          <span className={styles.toast__icon}>
            {toast.type === "success" && "✓"}
            {toast.type === "error" && "✕"}
            {toast.type === "warning" && "⚠"}
            {toast.type === "info" && "ℹ"}
          </span>
          <span className={styles.toast__message}>{toast.message}</span>
          <button
            className={styles.toast__close}
            onClick={() =>
              setToasts((prev) => prev.filter((t) => t.id !== toast.id))
            }
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
