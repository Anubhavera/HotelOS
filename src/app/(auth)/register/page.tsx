"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { slugify } from "@/lib/utils/formatters";
import styles from "../auth.module.css";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();

      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (!authData.user) {
        setError("Registration failed. Please try again.");
        return;
      }

      // 2. Create organization
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: orgName,
          slug: slugify(orgName),
          owner_id: authData.user.id,
        })
        .select()
        .single();

      if (orgError) {
        setError("Failed to create organization: " + orgError.message);
        return;
      }

      // 3. Create org membership (owner role)
      const { error: memberError } = await supabase.from("org_members").insert({
        org_id: orgData.id,
        user_id: authData.user.id,
        role: "owner",
        department: "management",
      });

      if (memberError) {
        setError("Failed to set up membership: " + memberError.message);
        return;
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
              Get started in minutes
            </div>
          </div>
        </div>

        <h1 className={styles["auth-title"]}>Create your account</h1>
        <p className={styles["auth-subtitle"]}>
          Set up your hotel or restaurant in under 2 minutes
        </p>

        {error && <div className={styles["auth-error"]}>{error}</div>}

        <form className={styles["auth-form"]} onSubmit={handleRegister}>
          <Input
            label="Full Name"
            type="text"
            placeholder="Anubhav Hooda"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <Input
            label="Organization Name"
            type="text"
            placeholder="Royal Hotels"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
            helperText="This is your hotel or restaurant name"
          />
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
            placeholder="Min 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <Button type="submit" fullWidth loading={loading}>
            Create Account
          </Button>
        </form>

        <p className={styles["auth-footer"]}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
