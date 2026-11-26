import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/utils/supabase/server";
import Dashboard from "./dashboard";

export const instant = false;

export default async function DeliveryPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/delivery/login");
  const { data: profile } = await supabase.from("profiles").select("role,full_name").eq("user_id", user.id).maybeSingle();
  if (profile?.role !== "delivery") redirect("/");
  const { data: store } = await supabase.from("store_settings").select("latitude,longitude").eq("id", true).maybeSingle();
  return <Dashboard name={profile.full_name || "Delivery person"} email={user.email || ""} storeLocation={store ? [store.latitude, store.longitude] : null} />;
}
