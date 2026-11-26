import type { Metadata } from "next";
import AuthForm from "../auth-form";
import AuthLayout from "../auth-layout";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your Sukimart account.",
};

export default function UpdatePasswordPage() {
  return (
    <AuthLayout>
      <AuthForm mode="update" />
    </AuthLayout>
  );
}
