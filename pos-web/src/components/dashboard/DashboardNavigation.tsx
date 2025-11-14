"use client";

import Link from "next/link";

type NavigationLink = {
  href: string;
  label: string;
};

type DashboardNavigationProps = {
  links: NavigationLink[];
};

export function DashboardNavigation({ links }: DashboardNavigationProps) {
  return (
    <nav className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
      {links.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-full border border-transparent px-4 py-2 transition hover:border-sky-200 hover:text-sky-700"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

