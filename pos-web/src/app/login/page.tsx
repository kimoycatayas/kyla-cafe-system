"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { login, toAuthPayload } from "../../lib/authClient";
import { authStorage } from "../../lib/authStorage";
import { Logo } from "@/components/branding/Logo";

type FormState = {
  email: string;
  password: string;
  rememberMe: boolean;
};

const initialFormState: FormState = {
  email: "",
  password: "",
  rememberMe: false,
};

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await login({
        email: form.email,
        password: form.password,
      });

      authStorage.save(toAuthPayload(response));

      // Optional: implement refresh token rotation logic based on rememberMe flag later.
      if (!form.rememberMe) {
        // Session-only tokens can be cleared on tab close using the Storage API if needed.
      }

      // Redirect cashiers to sales processing, others to dashboard
      const redirectPath = response.user.role === "CASHIER" 
        ? "/sales-processing" 
        : "/dashboard";
      
      router.replace(redirectPath);
      router.refresh();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to log in. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-stretch bg-slate-900">
      <div className="flex w-full flex-col justify-center bg-white px-8 py-16 sm:px-16">
        <div className="mx-auto w-full max-w-lg space-y-10">
          <div>
            <Logo
              showText
              size={40}
              textClassName="text-lg font-semibold text-slate-900"
              imageClassName="h-10 w-auto"
              className="mb-6"
            />
            <p className="text-sm font-medium uppercase tracking-wide text-sky-600">
              Welcome back
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              Log in to your account
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              Continue to manage inventory, staff, and real-time sales insights.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-700"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="business@email.com"
                autoComplete="email"
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
                required
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <Link
                  href="#"
                  className="text-xs font-medium text-sky-600 hover:text-sky-700"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                required
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  name="remember"
                  checked={form.rememberMe}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      rememberMe: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                Keep me signed in for 30 days
              </label>
              <span className="text-xs text-slate-400">POS v2.6</span>
            </div>

            {error ? (
              <p className="text-sm font-medium text-red-600">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 focus:ring-2 focus:ring-sky-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Signing in..." : "Log in"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-600">
            Need a Kyla Cafe System account?{" "}
            <Link href="/signup" className="font-semibold text-sky-600">
              Create one now
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
