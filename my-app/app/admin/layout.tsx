import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/utils/supabase/server";
import AdminShell from "./admin-shell";

export const instant = false;

type Profile = {
  full_name: string;
  email: string;
  role: string;
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authentication and its time-sensitive session checks must run per request.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && authError.name !== "AuthSessionMissingError")
    throw authError;
  if (!user) redirect("/");

  const readProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name,email,role")
      .eq("user_id", user.id)
      .maybeSingle();
    return { profile: data as Profile | null, error };
  };

  let { profile, error: profileError } = await readProfile();

  if (profileError) {
    throw new Error(
      `Supabase admin setup is missing (${profileError.message}). Run supabase/admin-dashboard.sql in the Supabase SQL Editor.`,
    );
  }

  // Self-heal accounts whose profile row was never created. The insert only
  // works when supabase/fix-profiles.sql has been run; otherwise we fall back
  // to the sign-in page instead of crashing the whole admin area.
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
        `Supabase admin setup is missing (${profileError.message}). Run supabase/admin-dashboard.sql in the Supabase SQL Editor.`,
      );
    }
  }

  if (!profile) redirect("/");
  if (profile.role !== "admin") redirect("/shop");

  return (
    <AdminShell
      adminName={profile.full_name || "Administrator"}
      adminEmail={profile.email || user.email || ""}
    >
      {children}
    </AdminShell>
  );
}
