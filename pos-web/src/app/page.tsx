import Link from "next/link";

import { Logo } from "@/components/branding/Logo";
import { HeaderAuthButtons } from "./_components/HeaderAuthButtons";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col bg-linear-to-b from-sky-50 via-white to-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.2),transparent_55%)]" />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
        <Logo
          href="/"
          size={44}
          className="text-sky-700"
          textClassName="text-xl font-semibold text-slate-900"
          priority
        />
        <HeaderAuthButtons />
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-14 px-6 py-12 md:py-24">
        <div className="max-w-2xl space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-4 py-1 text-sm font-medium text-sky-700">
            Filipino retailers&apos; favourite POS
          </span>
          <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
            Run your entire store from one intuitive dashboard.
          </h1>
          <p className="text-lg leading-relaxed text-slate-600 md:text-xl">
            Manage sales, inventory, and daily totals with tools made for
            growing businesses in the Philippines. Seamless onboarding,
            real-time analytics, and peso-ready reports included with Kyla Cafe
            System.
          </p>
        </div>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              title: "Inventory that updates itself",
              description:
                "Track stock levels by branch and get alerts before you run out of bestsellers.",
            },
            {
              title: "Peso-first reporting",
              description:
                "Daily sales summaries, X/Z readings, and payouts in ₱ to keep your books ready for BIR.",
            },
            {
              title: "Works offline",
              description:
                "Process transactions even without internet - your data syncs the moment you're back online.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-sky-200"
            >
              <h2 className="text-lg font-semibold text-slate-900">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {item.description}
              </p>
            </article>
          ))}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-col justify-between gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 md:flex-row">
          <p>
            © {new Date().getFullYear()} Kyla Cafe System. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-sky-600">
              Support
            </Link>
            <Link href="/login" className="hover:text-sky-600">
              Contact sales
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
