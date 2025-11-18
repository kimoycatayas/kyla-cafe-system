"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { RoleProtectedRoute } from "@/components/auth/RoleProtectedRoute";
import { Logo } from "@/components/branding/Logo";
import { DashboardNavigation } from "@/components/dashboard/DashboardNavigation";
import { useAuth } from "@/components/auth/AuthSessionBoundary";
import { expireUserAccessToken, logoutUser } from "@/lib/authClient";
import { authStorage } from "@/lib/authStorage";
import {
  type DashboardMetrics,
  fetchDashboardMetrics,
} from "@/lib/dashboardClient";

const getNavigationLinks = (isSuperAdmin: boolean) => {
  const baseLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/sales-processing", label: "Sales Processing" },
    { href: "/orders", label: "Orders" },
    { href: "/inventory-management", label: "Inventory" },
    { href: "/product-management", label: "Products" },
  ];

  if (isSuperAdmin) {
    return [...baseLinks, { href: "/user-management", label: "Users" }];
  }

  return baseLinks;
};

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const navigationLinks = useMemo(
    () => getNavigationLinks(isSuperAdmin),
    [isSuperAdmin]
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isExpiringToken, setIsExpiringToken] = useState(false);
  const [tokenNotice, setTokenNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) {
        return;
      }

      if (!dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const profileInitials = useMemo(() => {
    if (!user) {
      return "U";
    }

    const source = user.profile?.fullName ?? user.email;
    return (
      source
        .split(/\s+/)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase())
        .join("")
        .slice(0, 2) || "U"
    );
  }, [user]);

  const displayName = useMemo(() => {
    if (!user) {
      return "Team member";
    }

    return user.profile?.fullName ?? user.email;
  }, [user]);

  const userSubtitle = useMemo(() => {
    if (!user) {
      return "Signed in";
    }

    return user.profile?.businessName ?? user.role ?? "Signed in";
  }, [user]);

  const pesoFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
      }),
    []
  );

  const countFormatter = useMemo(
    () => new Intl.NumberFormat("en-PH"),
    []
  );

  const formatCurrency = useCallback(
    (value: number | null | undefined) => pesoFormatter.format(value ?? 0),
    [pesoFormatter]
  );

  const formatCount = useCallback(
    (value: number | null | undefined) => countFormatter.format(value ?? 0),
    [countFormatter]
  );

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return "—";
    }
    return date.toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    let isMounted = true;

    const loadMetrics = async () => {
      setIsLoadingMetrics(true);
      try {
        const response = await fetchDashboardMetrics();
        if (isMounted) {
          setMetrics(response);
          setMetricsError(null);
        }
      } catch (err) {
        if (isMounted) {
          setMetricsError(
            err instanceof Error
              ? err.message
              : "Unable to load dashboard metrics right now."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingMetrics(false);
        }
      }
    };

    loadMetrics();

    return () => {
      isMounted = false;
    };
  }, []);

  const highlightCards = useMemo(() => {
    const summary = metrics?.salesSummary;

    return [
      {
        title: "Gross sales (today)",
        value: summary ? formatCurrency(summary.totalSalesToday) : "—",
        subtitle: summary
          ? `${formatCount(summary.ordersToday)} paid order${
              summary.ordersToday === 1 ? "" : "s"
            }`
          : "Awaiting sales data",
      },
      {
        title: "Average order value",
        value: summary ? formatCurrency(summary.averageOrderValueToday) : "—",
        subtitle: summary
          ? "Across paid orders today"
          : "Awaiting sales data",
      },
      {
        title: "Open orders",
        value: summary ? formatCount(summary.openOrders) : "—",
        subtitle: "Awaiting payment",
      },
    ];
  }, [metrics, formatCurrency, formatCount]);

  const topProducts = metrics?.topProducts ?? [];
  const lowStockItems = metrics?.lowStockItems ?? [];
  const recentOrders = metrics?.recentOrders ?? [];

  const handleOpenSettings = () => {
    setIsDropdownOpen(false);
    router.push("/user-settings");
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setIsDropdownOpen(false);

    try {
      const refreshToken = authStorage.getRefreshToken();
      if (refreshToken) {
        await logoutUser(refreshToken);
      }
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      authStorage.clear();
      router.replace("/login");
      setIsLoggingOut(false);
    }
  };

  const handleExpireToken = async () => {
    if (!user || isExpiringToken) {
      return;
    }

    setIsExpiringToken(true);
    setTokenNotice(null);
    setIsDropdownOpen(false);

    try {
      await expireUserAccessToken(user.id);
      setTokenNotice({
        type: "success",
        message:
          "Current access token expired. Perform any action to trigger re-login.",
      });
    } catch (err) {
      setTokenNotice({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Unable to expire the token right now.",
      });
    } finally {
      setIsExpiringToken(false);
    }
  };

  return (
    <RoleProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4">
            {tokenNotice ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                  tokenNotice.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {tokenNotice.message}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-6">
                <Logo
                  href="/dashboard"
                  size={40}
                  textClassName="text-lg font-semibold text-slate-900"
                  imageClassName="h-10 w-auto"
                  className="shrink-0"
                />
                <div className="hidden md:flex md:min-w-0 md:flex-1 md:justify-start">
                  <DashboardNavigation links={navigationLinks} />
                </div>
              </div>
              <div
                className="relative flex items-center gap-3"
                ref={dropdownRef}
              >
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-slate-900">
                    {displayName}
                  </p>
                  <p className="text-xs text-slate-500">{userSubtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={isDropdownOpen}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-slate-800"
                >
                  {profileInitials}
                </button>
                {isDropdownOpen ? (
                  <div className="absolute right-0 top-14 z-20 w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                    <button
                      type="button"
                      onClick={handleOpenSettings}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      User settings
                    </button>
                    <button
                      type="button"
                      onClick={handleExpireToken}
                      disabled={isExpiringToken || !user}
                      className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-amber-600 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isExpiringToken ? "Expiring…" : "Expire access token"}
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoggingOut ? "Signing out…" : "Logout"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="md:hidden">
              <DashboardNavigation links={navigationLinks} />
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
          {metricsError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {metricsError}
            </div>
          ) : null}

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {highlightCards.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <p className="text-sm font-medium text-slate-500">
                  {item.title}
                </p>
                <p className="mt-4 text-3xl font-semibold text-slate-900">
                  {item.value}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {isLoadingMetrics ? "Loading…" : item.subtitle}
                </p>
              </article>
            ))}
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Top products (7 days)
                  </h2>
                  <p className="text-sm text-slate-500">
                    Best-selling items across paid orders in the last week.
                  </p>
                </div>
                <Link
                  href="/sales-processing"
                  className="text-sm font-semibold text-sky-600 hover:text-sky-700"
                >
                  Start new sale
                </Link>
              </div>

              <div className="mt-6 space-y-4">
                {isLoadingMetrics ? (
                  <p className="text-sm text-slate-500">
                    Loading product performance…
                  </p>
                ) : topProducts.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No paid orders yet. Sales will appear here once you start
                    transacting.
                  </p>
                ) : (
                  topProducts.map((product) => (
                    <div
                      key={`${product.productId ?? "custom"}-${product.name}`}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {product.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatCount(product.quantity)} sold
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(product.sales)}
                        </p>
                        {product.productId ? (
                          <p className="text-xs text-slate-500">
                            SKU: {product.productId}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Low stock alerts
                  </h2>
                  <p className="text-sm text-slate-500">
                    Products nearing their stock threshold.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {isLoadingMetrics ? "Updating…" : "Live data"}
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {isLoadingMetrics ? (
                  <p className="text-sm text-slate-500">
                    Checking inventory levels…
                  </p>
                ) : lowStockItems.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    All products are above their low-stock threshold.
                  </p>
                ) : (
                  lowStockItems.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          Threshold: {formatCount(item.threshold)}
                        </p>
                      </div>
                      <p
                        className={`text-sm font-semibold ${
                          item.quantity === 0
                            ? "text-rose-600"
                            : "text-amber-600"
                        }`}
                      >
                        {formatCount(item.quantity)} on hand
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Latest transactions
                </h2>
                <p className="text-sm text-slate-500">
                  Real-time POS logs from all registers.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                {isLoadingMetrics ? "Syncing…" : "Synced just now"}
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Cashier</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoadingMetrics ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-sm text-slate-500"
                      >
                        Loading recent orders…
                      </td>
                    </tr>
                  ) : recentOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-sm text-slate-500"
                      >
                        No transactions recorded yet. Orders will appear here as
                        soon as you start selling.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr key={order.id} className="text-slate-700">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {order.orderNumber}
                        </td>
                        <td className="px-4 py-3">
                          {order.cashierName ?? "Unassigned"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              order.status === "PAID"
                                ? "bg-emerald-100 text-emerald-700"
                                : order.status === "OPEN"
                                ? "bg-amber-100 text-amber-700"
                                : order.status === "VOID"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-rose-100 text-rose-600"
                            }`}
                          >
                            {order.status.toLowerCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {formatCurrency(order.amount)}
                        </td>
                        <td className="px-4 py-3">
                          {formatTimestamp(order.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </RoleProtectedRoute>
  );
}
