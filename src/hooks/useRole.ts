"use client";

import { useOrg } from "./useOrg";
import type { UserRole } from "@/types/database";

interface RoleContext {
  role: UserRole | null;
  isOwner: boolean;
  isManager: boolean;
  isStaff: boolean;
  canAccessSalaries: boolean;
  canAccessSettings: boolean;
  canAccessReports: boolean;
  canManageStaff: boolean;
  loading: boolean;
}

export function useRole(): RoleContext {
  const { membership, loading } = useOrg();
  const role = membership?.role ?? null;

  return {
    role,
    isOwner: role === "owner",
    isManager: role === "manager",
    isStaff: role === "staff",
    canAccessSalaries: role === "owner",
    canAccessSettings: role === "owner",
    canAccessReports: role === "owner" || role === "manager",
    canManageStaff: role === "owner",
    loading,
  };
}
