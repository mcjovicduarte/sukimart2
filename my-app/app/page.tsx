import type { Metadata } from "next";
import AuthForm from "./auth-form";
import AuthLayout from "./auth-layout";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Sukimart and shop Filipino neighborhood favorites, snacks, groceries, and everyday essentials.",
};

export default function Home() {
  return (
    <AuthLayout>
      <AuthForm />
    </AuthLayout>
  );
}
