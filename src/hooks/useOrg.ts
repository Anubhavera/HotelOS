"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { OrgMember, Organization } from "@/types/database";

interface OrgContext {
  org: Organization | null;
  membership: OrgMember | null;
  loading: boolean;
  error: string | null;
}

export function useOrg(): OrgContext {
  const [org, setOrg] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrgMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrg() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        // Get user's org membership
        const { data: memberData, error: memberError } = await supabase
          .from("org_members")
          .select("*, organizations(*)")
          .eq("user_id", user.id)
          .single();

        if (memberError) {
          setError("No organization found. Please contact your admin.");
          setLoading(false);
          return;
        }

        setMembership({
          id: memberData.id,
          org_id: memberData.org_id,
          user_id: memberData.user_id,
          role: memberData.role,
          department: memberData.department,
          joined_at: memberData.joined_at,
        });

        if (memberData.organizations) {
          setOrg(memberData.organizations as unknown as Organization);
        }
      } catch (err) {
        setError("Failed to load organization data.");
      } finally {
        setLoading(false);
      }
    }

    fetchOrg();
  }, []);

  return { org, membership, loading, error };
}
