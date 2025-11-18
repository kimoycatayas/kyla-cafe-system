"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { register, toAuthPayload } from "../../lib/authClient";
import { authStorage } from "../../lib/authStorage";
import { Logo } from "@/components/branding/Logo";

type SignupFormState = {
  businessName: string;
  industry: string;
  fullName: string;
  contactNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
};

const initialState: SignupFormState = {
  businessName: "",
  industry: "Retail",
  fullName: "",
  contactNumber: "",
  email: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<SignupFormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordMismatch = useMemo(
    () =>
      form.password.length > 0 &&
      form.confirmPassword.length > 0 &&
      form.password !== form.confirmPassword,
    [form.password, form.confirmPassword]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (passwordMismatch) {
      setError("Passwords do not match.");
      return;
    }

    if (!form.termsAccepted) {
      setError("Please accept the Terms of Service and Privacy Policy.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await register({
        email: form.email,
        password: form.password,
        businessName: form.businessName,
        industry: form.industry,
        fullName: form.fullName,
        contactNumber: form.contactNumber,
      });

      authStorage.save(toAuthPayload(response));
      
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
        setError("Unable to create your account. Please try again.");
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
              Create your Kyla Cafe System account
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              Start selling in-store and online today
            </h2>
            <p className="mt-3 text-sm text-slate-600">
              No credit card required. Enjoy a 14-day free trial with instant
              access to the dashboard and onboarding concierge.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="businessName"
                  className="text-sm font-medium text-slate-700"
                >
                  Business name
                </label>
                <input
                  id="businessName"
                  name="businessName"
                  placeholder="Kyla Cafe"
                  value={form.businessName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      businessName: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="industry"
                  className="text-sm font-medium text-slate-700"
                >
                  Industry
                </label>
                <select
                  id="industry"
                  name="industry"
                  value={form.industry}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      industry: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                >
                  <option>Retail</option>
                  <option>Food & Beverage</option>
                  <option>Service</option>
                  <option>Pharmacy</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="fullName"
                  className="text-sm font-medium text-slate-700"
                >
                  Full name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  placeholder="Juan Dela Cruz"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      fullName: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="contactNumber"
                  className="text-sm font-medium text-slate-700"
                >
                  Contact number
                </label>
                <input
                  id="contactNumber"
                  name="contactNumber"
                  type="tel"
                  placeholder="+63 917 000 0000"
                  autoComplete="tel"
                  value={form.contactNumber}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      contactNumber: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-700"
              >
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@business.ph"
                autoComplete="email"
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
                required
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Create a password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-slate-700"
                >
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      confirmPassword: event.target.value,
                    }))
                  }
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 text-xs text-slate-600">
                <input
                  type="checkbox"
                  name="terms"
                  checked={form.termsAccepted}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      termsAccepted: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                I agree to the{" "}
                <Link href="#" className="font-semibold text-sky-600">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="#" className="font-semibold text-sky-600">
                  Privacy Policy
                </Link>
                .
              </label>
              <p className="text-xs text-slate-400">
                During your trial, you get full access to premium features and
                local onboarding support.
              </p>
            </div>

            {error ? (
              <p className="text-sm font-medium text-red-600">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 focus:ring-2 focus:ring-sky-200 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-sky-600">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
