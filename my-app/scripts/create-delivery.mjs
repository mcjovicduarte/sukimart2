// Run after delivery.sql. Requires a server-only Supabase service role key.
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

let env = {};
try {
  for (const line of (await readFile(".env.local", "utf8")).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
} catch { /* Environment variables can also be supplied by the shell. */ }
env = { ...env, ...process.env };
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error("Set the Supabase URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
const client = createClient(url, key, { auth: { persistSession: false } });
const { error: schemaError } = await client.from("orders").select("delivery_man_id,delivery_status,delivery_lat,delivery_lng").limit(1);
if (schemaError) throw new Error(`Could not verify the delivery database: ${schemaError.message}. Check the project URL and service-role key, and make sure supabase/delivery.sql has been run.`);
const { data, error } = await client.auth.admin.createUser({ email: "delivery@gmail.com", password: "delivery123", email_confirm: true, user_metadata: { full_name: "Delivery Man" } });
if (error) throw new Error(`Account not created: ${error.message}. Existing accounts are not modified.`);
const { error: profileError } = await client.from("profiles").upsert({ user_id: data.user.id, email: "delivery@gmail.com", full_name: "Delivery Man", role: "delivery" });
if (profileError) throw new Error(`Auth account created, but profile setup failed: ${profileError.message}. Promote the account manually after applying delivery.sql.`);
console.log("Delivery account created. Change its demo password before production use.");
