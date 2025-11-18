"use client";

import Link from "next/link";

import { RoleProtectedRoute } from "@/components/auth/RoleProtectedRoute";
import { Logo } from "@/components/branding/Logo";
import { useAuth } from "@/components/auth/AuthSessionBoundary";

const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) {
    return value;
  }
  return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
};

export default function UserSettingsPage() {
  const { user } = useAuth();

  const profile = {
    fullName: user?.profile?.fullName ?? "Kyla Reyes",
    email: user?.email ?? "owner@kylacafe.ph",
    contactNumber: user?.profile?.contactNumber ?? "+63 917 123 4567",
    businessName: user?.profile?.businessName ?? "Kyla Cafe System",
    industry: user?.profile?.industry ?? "Food & Beverage",
    role: user?.role ?? "MANAGER",
  };

  return (
    <RoleProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
            <div className="flex flex-wrap items-center gap-4">
              <Logo
                href="/user-settings"
                size={36}
                textClassName="text-lg font-semibold text-slate-900"
                imageClassName="h-9 w-auto"
                className="shrink-0"
              />
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-sky-600">
                  User Settings
                </p>
                <h1 className="text-3xl font-semibold text-slate-900">
                  Configure your POS preferences
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Manage your account, security, notifications, and terminal preferences from one place.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
            >
              Back to dashboard
            </Link>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Account profile</h2>
              <p className="mt-1 text-sm text-slate-500">
                These details will eventually sync with your receipts, invoices, and staff directory.
              </p>

              <dl className="mt-6 grid grid-cols-1 gap-4 text-sm text-slate-600 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Full name
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-slate-900">
                    {profile.fullName}
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Email address
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-slate-900">
                    {profile.email}
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact number
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-slate-900">
                    {formatPhoneNumber(profile.contactNumber)}
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role & access level
                  </dt>
                  <dd className="mt-1 text-base font-semibold text-slate-900">
                    {profile.role ?? "MANAGER"}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Business identity</h2>
              <p className="mt-1 text-sm text-slate-500">
                Static preview of the data that will eventually drive receipt headers and tax reports.
              </p>

              <div className="mt-6 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Legal / trading name
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {profile.businessName}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Once backend is wired, you&apos;ll be able to maintain your BIR registration details, branch codes, and OR series from here.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Industry
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {profile.industry}
                  </p>
                </div>
              </div>
            </article>
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[0.8fr,1.2fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Security preferences</h2>
              <p className="mt-1 text-sm text-slate-500">
                Coming soon: enforce 2-factor authentication and manager PIN approvals for sensitive actions.
              </p>

              <ul className="mt-6 space-y-4 text-sm text-slate-600">
                <li className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div>
                    <p className="text-base font-semibold text-slate-900">Device approvals</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Restrict logins to whitelisted POS tablets. We&apos;ll store device fingerprints once the endpoint lands.
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-600">
                    Planned
                  </span>
                </li>
                <li className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div>
                    <p className="text-base font-semibold text-slate-900">Manager PIN</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Configure approval overrides for voids, refunds, and discounts. Static badge mirrors your current plan.
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-600">
                    Enabled
                  </span>
                </li>
                <li className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div>
                    <p className="text-base font-semibold text-slate-900">Password hygiene</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Force rotation every 90 days, plus email alerts for suspicious sign-ins. All static for now.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                    Monitoring
                  </span>
                </li>
              </ul>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">POS configuration overview</h2>
              <p className="mt-1 text-sm text-slate-500">
                These toggles describe the defaults we plan to expose via upcoming settings APIs.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 text-sm text-slate-600 lg:grid-cols-2">
                {[{
                  title: "Auto-close shift reminders",
                  description: "Send the cashier a push notification 5 minutes before closing time.",
                  state: "Enabled",
                  badgeClass: "bg-emerald-100 text-emerald-600",
                },
                {
                  title: "Auto-print receipts",
                  description: "Automatically print after successful payment. Manual override stays available per order.",
                  state: "Disabled",
                  badgeClass: "bg-slate-200 text-slate-600",
                },
                {
                  title: "Barcode scanner sound",
                  description: "Play an audible tone whenever a barcode scans successfully.",
                  state: "Enabled",
                  badgeClass: "bg-emerald-100 text-emerald-600",
                },
                {
                  title: "Low-stock push alerts",
                  description: "Notify the assigned manager once a SKU dips below its threshold.",
                  state: "Enabled",
                  badgeClass: "bg-emerald-100 text-emerald-600",
                }].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">
                          {item.title}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          {item.description}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.badgeClass}`}>
                        {item.state}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr,1fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Notification channels</h2>
              <p className="mt-1 text-sm text-slate-500">
                Target channels are static placeholders that we&apos;ll replace with real preferences once the messaging service is wired.
              </p>

              <div className="mt-6 space-y-4 text-sm text-slate-600">
                {[
                  {
                    label: "Email summaries",
                    description: "Daily sales digest every 10:00 PM PH time with branch breakdowns.",
                    status: "Scheduled",
                    badge: "bg-emerald-100 text-emerald-600",
                  },
                  {
                    label: "SMS alerts",
                    description: "Instant SMS when voids, refunds, or manager overrides happen.",
                    status: "Planned",
                    badge: "bg-amber-100 text-amber-600",
                  },
                  {
                    label: "Slack integration",
                    description: "Post low-stock and large-transaction alerts to #ops channel.",
                    status: "Planned",
                    badge: "bg-amber-100 text-amber-600",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">
                          {item.label}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          {item.description}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${item.badge}`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Connected devices & sessions</h2>
              <p className="mt-1 text-sm text-slate-500">
                Static table to visualise future session management API responses.
              </p>

              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Device</th>
                      <th className="px-4 py-3 text-left">Location</th>
                      <th className="px-4 py-3 text-left">Last active</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {[
                      {
                        name: "iPad Mini 6 (Counter 1)",
                        location: "Makati Avenue",
                        lastActive: "Today, 10:24 AM",
                        status: "Active",
                        badgeClass: "bg-emerald-100 text-emerald-600",
                      },
                      {
                        name: "Sunmi V2 Handheld",
                        location: "BGC Central",
                        lastActive: "Yesterday, 9:02 PM",
                        status: "Idle",
                        badgeClass: "bg-slate-200 text-slate-600",
                      },
                      {
                        name: "MacBook Pro (Back office)",
                        location: "Quezon City",
                        lastActive: "2 days ago",
                        status: "Needs review",
                        badgeClass: "bg-amber-100 text-amber-600",
                      },
                    ].map((device) => (
                      <tr key={device.name} className="text-slate-700">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {device.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{device.location}</td>
                        <td className="px-4 py-3 text-slate-600">{device.lastActive}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${device.badgeClass}`}
                          >
                            {device.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </main>
      </div>
    </RoleProtectedRoute>
  );
}
