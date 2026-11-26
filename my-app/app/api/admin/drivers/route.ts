import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

function validPhone(value: unknown): value is string {
  return typeof value === "string" && value.trim().length <= 25 &&
    /^[+0-9 ()-]+$/.test(value.trim()) && value.replace(/\D/g, "").length >= 7;
}

async function authorize(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return { error: Response.json({ error: "Invalid request origin." }, { status: 403 }) };
  }
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: Response.json({ error: "Please sign in as an administrator." }, { status: 401 }) };
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  if (profileError || profile?.role !== "admin") return { error: Response.json({ error: "Administrator access required." }, { status: 403 }) };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { error: Response.json({ error: "Server configuration is missing the Supabase service role key." }, { status: 503 }) };
  return { admin: createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) };
}

async function removeDriver(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  const admin = auth.admin!;
  let body: { userId?: unknown };
  try {
    body = await request.json();
    if (!body || typeof body !== "object") throw new Error();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body.userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.userId)) {
    return Response.json({ error: "Invalid driver." }, { status: 400 });
  }
  const { data: driver, error: lookupError } = await admin.from("profiles").select("user_id,role").eq("user_id", body.userId).maybeSingle();
  if (lookupError) return Response.json({ error: "Could not load the driver." }, { status: 500 });
  if (!driver || driver.role !== "delivery") return Response.json({ error: "Delivery driver not found." }, { status: 404 });

    const { count, error: ordersError } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("delivery_man_id", body.userId);
    if (ordersError) return Response.json({ error: "Could not check the driver's orders." }, { status: 500 });
    if (count) return Response.json({ error: "This driver has assigned orders and cannot be removed, to preserve order history." }, { status: 409 });
    const { error } = await admin.auth.admin.deleteUser(body.userId);
    if (error) return Response.json({ error: "Could not remove the driver. They may be referenced by existing records." }, { status: 500 });
  return Response.json({ success: true });
}

export async function DELETE(request: Request) { return removeDriver(request); }

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: "Please sign in as an administrator." }, { status: 401 });
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  if (profileError || profile?.role !== "admin") {
    return Response.json({ error: "Administrator access required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const { fullName, email, password, phone } = body as Record<string, unknown>;
  if (typeof fullName !== "string" || !fullName.trim() || fullName.trim().length > 100 ||
      typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== "string" || password.length < 8 || password.length > 72) {
    return Response.json({ error: "Enter a name, a valid email, and a password of 8–72 characters." }, { status: 400 });
  }
  if (!validPhone(phone)) return Response.json({ error: "Enter a valid contact number with at least 7 digits." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return Response.json({ error: "Server configuration is missing the Supabase service role key." }, { status: 503 });
  }
  const admin = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const name = fullName.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error || !data.user) {
    return Response.json({ error: error?.message || "Could not create the account." }, { status: 400 });
  }
  const { error: setupError } = await admin.from("profiles").upsert({
    user_id: data.user.id, full_name: name, email: normalizedEmail, phone: phone.trim(), role: "delivery",
  });
  if (setupError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id);
    if (cleanupError) {
      console.error("Failed to remove incomplete delivery account", data.user.id, cleanupError);
      return Response.json({ error: "Profile setup failed and the account could not be removed. Contact the project administrator before retrying." }, { status: 500 });
    }
    return Response.json({ error: "Could not set up the delivery profile. Make sure supabase/delivery.sql has been applied." }, { status: 500 });
  }
  return Response.json({ success: true });
}
