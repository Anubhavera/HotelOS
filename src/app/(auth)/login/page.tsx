"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { slugify } from "@/lib/utils/formatters";
import styles from "../auth.module.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      const pendingOrgName = authData.user?.user_metadata?.pending_org_name;
      if (typeof pendingOrgName === "string" && pendingOrgName.trim()) {
        const { error: setupError } = await supabase.rpc("create_owner_organization", {
          org_name: pendingOrgName.trim(),
          org_slug: slugify(pendingOrgName) || "hotel",
        });
        if (setupError) {
          setError("Unable to finish organization setup: " + setupError.message);
          return;
        }
        await supabase.auth.updateUser({ data: { pending_org_name: null } });
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles["auth-layout"]}>
      <div className={styles["auth-card"]}>
        <div className={styles["auth-brand"]}>
          <div className={styles["auth-brand__logo"]}>H</div>
          <div>
            <div className={styles["auth-brand__name"]}>HotelOS</div>
            <div className={styles["auth-brand__tagline"]}>
              Management Platform
            </div>
          </div>
        </div>

        <h1 className={styles["auth-title"]}>Welcome back</h1>
        <p className={styles["auth-subtitle"]}>
          Sign in to your account to continue
        </p>

        {error && <div className={styles["auth-error"]}>{error}</div>}

        <form className={styles["auth-form"]} onSubmit={handleLogin}>
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Button type="submit" fullWidth loading={loading}>
            Sign In
          </Button>
        </form>

        <p className={styles["auth-footer"]}>
          Don&apos;t have an account?{" "}
          <Link href="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
