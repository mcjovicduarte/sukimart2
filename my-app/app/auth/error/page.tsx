import Link from "next/link";
import type { Metadata } from "next";
import AuthLayout from "../../auth-layout";

export const metadata: Metadata = {
  title: "Link verification failed",
  description: "The account verification link could not be completed.",
};

export default function AuthErrorPage() {
  return (
    <AuthLayout>
      <div className="formContent">
        <div className="formHeading">
          <h1>Link verification failed</h1>
          <p>
            This link may have expired or already been used. Please request a
            new one and try again.
          </p>
        </div>
        <p className="formFooter">
          <Link href="/" className="backLink">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
