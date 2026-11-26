import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/utils/supabase/server";
import CustomerShop from "./customer-shop";

export const instant = false;

type Profile = { role: string };

export default async function ShopPage() {
  // Supabase session checks are time-sensitive and must run on a request.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError?.name === "AuthRetryableFetchError") {
    return (
      <main style={{ maxWidth: 520, margin: "12vh auto", padding: 24, fontFamily: "sans-serif" }}>
        <h1>Unable to connect to SukiMart</h1>
        <p>We could not reach the sign-in service. Check your internet connection and try again.</p>
        <a href="/shop">Try again</a>
      </main>
    );
  }
  if (authError && authError.name !== "AuthSessionMissingError") throw authError;
  if (!user) redirect("/");

  const readProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    return { profile: data as Profile | null, error };
  };

  let { profile, error: profileError } = await readProfile();

  if (profileError) {
    throw new Error(
      `Supabase role setup is missing (${profileError.message}). Run supabase/setup.sql in the Supabase SQL Editor.`,
    );
  }

  // Self-heal a missing profile row instead of failing the whole shop page.
  if (!profile) {
    const metadata = (user.user_metadata ?? {}) as { full_name?: string };
    await supabase.from("profiles").insert({
      user_id: user.id,
      full_name: metadata.full_name ?? "",
      email: user.email ?? "",
      role: "customer",
    });
    ({ profile, error: profileError } = await readProfile());
    if (profileError) {
      throw new Error(
        `Supabase role setup is missing (${profileError.message}). Run supabase/setup.sql in the Supabase SQL Editor.`,
      );
    }
  }

  if (!profile) redirect("/");
  if (profile.role === "admin") redirect("/admin");

  return <CustomerShop />;
}
