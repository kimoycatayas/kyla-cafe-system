"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Logo } from "@/components/branding/Logo";
import { fetchOrders } from "@/lib/orderClient";
import type { Order } from "@/lib/orderClient";

const statusStyles: Record<Order["status"], string> = {
  OPEN: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-600",
  VOID: "bg-slate-200 text-slate-600",
  REFUNDED: "bg-rose-100 text-rose-600",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pesoFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
      }),
    []
  );

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const orderList = await fetchOrders();
      setOrders(orderList);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load orders right now. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6">
            <div className="flex items-center gap-4">
              <Logo
                href="/orders"
                size={44}
                showText={false}
                imageClassName="h-11 w-auto"
                className="shrink-0"
              />
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  Orders
                </h1>
                <p className="text-sm text-slate-500">
                  Review the latest transactions processed in your store.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadOrders()}
                disabled={isLoading}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh
              </button>
              <Link
                href="/sales-processing"
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                Back to checkout
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  All orders
                </h2>
                <p className="text-sm text-slate-500">
                  {isLoading
                    ? "Fetching orders…"
                    : `${orders.length} order(s) in total.`}
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100">
              {isLoading ? (
                <div className="flex items-center justify-center px-6 py-12 text-sm text-slate-500">
                  Loading orders…
                </div>
              ) : orders.length === 0 ? (
                <div className="flex items-center justify-center px-6 py-12 text-sm text-slate-500">
                  No orders found yet. Process a sale to populate this list.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Order</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Total due</th>
                      <th className="px-4 py-3 text-left">Paid</th>
                      <th className="px-4 py-3 text-left">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {orders.map((order) => (
                      <tr key={order.id} className="text-slate-700">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">
                            {order.orderNumber}
                          </div>
                          <div className="text-xs text-slate-500">
                            Cashier: {order.cashierId.slice(0, 6)}…
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              statusStyles[order.status]
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {pesoFormatter.format(order.totalDue)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {pesoFormatter.format(order.totalPaid)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {new Date(order.updatedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}

