// Run RLS fix directly via Supabase REST API
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, ".env.local"), "utf8");
const env = Object.fromEntries(
  envContent.split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => l.trim().split("=").map(s => s.trim())).filter(([k]) => k).map(([k, ...v]) => [k, v.join("=")])
);

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_ROLE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];

const sql = readFileSync(join(__dirname, "supabase/migrations/002_fix_rls_recursion.sql"), "utf8");

// Split into individual statements and run each
const statements = sql
  .split(";")
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith("--"));

console.log(`🔧 Running ${statements.length} SQL statements...\n`);

for (const stmt of statements) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "apikey": SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ query: stmt }),
  });
  if (!res.ok && res.status !== 404) {
    console.error(`  ❌ Failed: ${stmt.slice(0, 60)}...`);
  }
}

// Use pg-based approach via Supabase Management API
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
console.log(`\n📡 Project ref: ${projectRef}`);

// Run via Management API
const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

if (mgmtRes.ok) {
  console.log("✅ RLS fix applied via Management API!");
} else {
  const body = await mgmtRes.text();
  console.log(`Failed (${mgmtRes.status}): ${body.slice(0, 200)}`);
  console.log("\n⚠️  Please run supabase/migrations/002_fix_rls_recursion.sql manually in your Supabase SQL Editor:");
  console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new`);
}
