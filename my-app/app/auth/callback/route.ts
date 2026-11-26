import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedPath = requestUrl.searchParams.get("next");
  const requestedNextPath =
    requestedPath?.startsWith("/") &&
    !requestedPath.startsWith("//") &&
    !requestedPath.startsWith("/\\")
      ? requestedPath
      : null;

  if (!code) {
    return NextResponse.redirect(new URL("/auth/error", requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/auth/error", requestUrl.origin));
  }

  if (requestedNextPath === "/update-password") {
    return NextResponse.redirect(new URL(requestedNextPath, requestUrl.origin));
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.redirect(new URL("/auth/error", requestUrl.origin));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profileError) {
    return NextResponse.redirect(new URL("/auth/error", requestUrl.origin));
  }

  const nextPath = profile.role === "admin" ? "/admin" : "/shop";
  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
