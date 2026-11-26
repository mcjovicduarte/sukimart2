"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";

type AuthMode = "login" | "register" | "reset" | "update";
type FieldName = "name" | "email" | "password" | "confirmPassword";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GoogleMark() {
  return (
    <svg className="googleMark" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.61 24.5c0-1.44-.13-2.82-.38-4.17H24v7.9h11a9.42 9.42 0 0 1-4.08 6.18v5.06h6.6c3.86-3.56 6.09-8.8 6.09-14.97Z"
      />
      <path
        fill="#FF3D00"
        d="M24 44c5.52 0 10.15-1.83 13.53-4.96l-6.6-5.06c-1.83 1.23-4.17 1.96-6.93 1.96-5.33 0-9.85-3.6-11.47-8.44H5.72v5.2A20 20 0 0 0 24 44Z"
      />
      <path
        fill="#4CAF50"
        d="M12.53 27.5A12 12 0 0 1 11.9 24c0-1.21.21-2.38.63-3.5v-5.2H5.72A20 20 0 0 0 4 24c0 3.23.77 6.29 2.12 8.7l6.41-5.2Z"
      />
      <path
        fill="#1976D2"
        d="M24 12.06c3 0 5.7 1.03 7.82 3.06l5.87-5.88C34.14 5.98 29.51 4 24 4A20 20 0 0 0 5.72 15.3l6.8 5.2c1.63-4.84 6.15-8.44 11.48-8.44Z"
      />
    </svg>
  );
}

export default function AuthForm({ mode = "login" }: { mode?: AuthMode }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formMessage, setFormMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isUpdate = mode === "update";

  const navigateToRoleHome = async (userId: string) => {
    const supabase = createClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (error) {
      throw new Error(
        "Supabase role setup is missing. Run supabase/schema.sql in the Supabase SQL Editor, then try again.",
      );
    }

    router.replace(
      profile.role === "admin"
        ? "/admin"
        : profile.role === "delivery"
          ? "/delivery"
          : "/shop",
    );
  };

  const title = isLogin
    ? "Welcome to Sukimart"
    : isRegister
      ? "Create your account"
      : isUpdate
        ? "Choose a new password"
        : "Forgot your password?";
  const subtitle = isLogin
    ? "Sign in to shop your everyday favorites."
    : isRegister
      ? "Join your neighborhood store, online."
      : isUpdate
        ? "Enter and confirm your new password."
        : "Enter your email and we’ll help you get back in.";

  const validate = () => {
    const nextErrors: Partial<Record<FieldName, string>> = {};
    if (isRegister && !name.trim()) {
      nextErrors.name = "Please enter your name.";
    }
    if (!isUpdate) {
      if (!email.trim()) {
        nextErrors.email = "Please enter your email address.";
      } else if (!emailPattern.test(email.trim())) {
        nextErrors.email =
          "Enter a valid email address, like name@example.com.";
      }
    }
    if (mode !== "reset" && !password) {
      nextErrors.password = "Please enter your password.";
    } else if (mode !== "reset" && password.length < 8) {
      nextErrors.password = "Your password must be at least 8 characters.";
    }
    if (isUpdate && confirmPassword !== password) {
      nextErrors.confirmPassword = "Your passwords do not match.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage("");
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const supabase = createClient();

      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setFormMessage(error.message);
          return;
        }
        await navigateToRoleHome(data.user.id);
        return;
      }

      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/shop`,
          },
        });
        if (error) {
          setFormMessage(error.message);
          return;
        }
        if (data.session) {
          if (!data.user) {
            throw new Error("Supabase created a session without a user.");
          }
          await navigateToRoleHome(data.user.id);
          return;
        }
        setFormMessage("Check your email for a link to confirm your account.");
        return;
      }

      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
          },
        );
        if (error) {
          setFormMessage(error.message);
          return;
        }
        setFormMessage(
          "If an account exists for that email, a reset link is on its way.",
        );
        return;
      }

      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFormMessage(error.message);
        return;
      }
      await navigateToRoleHome(data.user.id);
    } catch (error) {
      setFormMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setFormMessage("");
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/shop`,
        },
      });
      if (error) setFormMessage(error.message);
    } catch (error) {
      setFormMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="formContent">
      <Link href="/" className="wordmark" aria-label="Sukimart home">
        <span className="wordmarkIcon">
          <Image src="/sukimart-logo.png" alt="" width={48} height={36} className="brandLogo" priority />
        </span>
        <span>
          Suki<span className="wordmarkAccent">mart</span>
        </span>
      </Link>

      <div className="formHeading">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <form className="authForm" onSubmit={handleSubmit} noValidate>
        {isRegister && (
          <div className="field">
            <label htmlFor="full-name">Your name</label>
            <input
              id="full-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrors((current) => ({ ...current, name: undefined }));
              }}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && (
              <span className="fieldError" id="name-error">
                {errors.name}
              </span>
            )}
          </div>
        )}

        {!isUpdate && (
          <div className="field">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((current) => ({ ...current, email: undefined }));
              }}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && (
              <span className="fieldError" id="email-error">
                {errors.email}
              </span>
            )}
          </div>
        )}

        {mode !== "reset" && (
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="passwordInput">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrors((current) => ({ ...current, password: undefined }));
                }}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
              />
              <button
                className="passwordToggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <span className="fieldError" id="password-error">
                {errors.password}
              </span>
            )}
          </div>
        )}

        {isUpdate && (
          <div className="field">
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setErrors((current) => ({
                  ...current,
                  confirmPassword: undefined,
                }));
              }}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={
                errors.confirmPassword ? "confirm-password-error" : undefined
              }
            />
            {errors.confirmPassword && (
              <span className="fieldError" id="confirm-password-error">
                {errors.confirmPassword}
              </span>
            )}
          </div>
        )}

        {isLogin && (
          <div className="forgotRow">
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
        )}

        {formMessage && (
          <p className="formMessage" role="alert">
            {formMessage}
          </p>
        )}

        <button className="submitButton" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Please wait…"
            : isLogin
              ? "Sign In"
              : isRegister
                ? "Create Account"
                : isUpdate
                  ? "Update password"
                  : "Send reset instructions"}
        </button>
      </form>

      {isLogin && (
        <>
          <div className="divider">
            <span>or</span>
          </div>
          <button
            className="googleButton"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            <GoogleMark />
            Continue with Google
          </button>
        </>
      )}

      <p className="formFooter">
        {isUpdate ? (
          <Link href="/" className="backLink">
            <ArrowLeft size={15} /> Back to sign in
          </Link>
        ) : isLogin ? (
          <>
            New to Sukimart? <Link href="/register">Create Account</Link>
          </>
        ) : isRegister ? (
          <>
            Already have an account? <Link href="/">Sign in</Link>
          </>
        ) : (
          <Link href="/" className="backLink">
            <ArrowLeft size={15} /> Back to sign in
          </Link>
        )}
      </p>
    </div>
  );
}
