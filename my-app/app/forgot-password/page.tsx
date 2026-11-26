import type { Metadata } from "next";
import AuthForm from "../auth-form";
import AuthLayout from "../auth-layout";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Get help resetting your Sukimart password.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <AuthForm mode="reset" />
    </AuthLayout>
  );
}
