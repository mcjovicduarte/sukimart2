import type { Metadata } from "next";
import AuthForm from "../auth-form";
import AuthLayout from "../auth-layout";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create your Sukimart account.",
};

export default function RegisterPage() {
  return (
    <AuthLayout>
      <AuthForm mode="register" />
    </AuthLayout>
  );
}
