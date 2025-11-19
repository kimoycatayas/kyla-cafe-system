"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { RoleProtectedRoute } from "@/components/auth/RoleProtectedRoute";
import { Logo } from "@/components/branding/Logo";
import { fetchOrders, getOrder, deleteOrder } from "@/lib/orderClient";
import type { Order, OrderItem } from "@/lib/orderClient";
import { fetchProducts } from "@/lib/productClient";
import type { Product } from "@/lib/productClient";

const statusStyles: Record<Order["status"], string> = {
  OPEN: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-600",
  VOID: "bg-slate-200 text-slate-600",
  REFUNDED: "bg-rose-100 text-rose-600",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [isDeletingOpenOrders, setIsDeletingOpenOrders] = useState(false);

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
      setAllOrders(orderList);
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

  const loadProducts = useCallback(async () => {
    try {
      const productList = await fetchProducts();
      setProducts(productList);
    } catch (err) {
      console.error("Failed to load products:", err);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    void loadProducts();
  }, [loadOrders, loadProducts]);

  // Filter orders based on selected filters
  useEffect(() => {
    let filtered = [...allOrders];

    // Filter by product
    if (selectedProductId) {
      filtered = filtered.filter((order) => {
        // Check if order has items loaded, otherwise we need to check by productId
        if (order.items && order.items.length > 0) {
          return order.items.some(
            (item) =>
              item.productId === selectedProductId ||
              item.nameSnapshot
                .toLowerCase()
                .includes(
                  products.find((p) => p.id === selectedProductId)?.name.toLowerCase() || ""
                )
          );
        }
        // If items not loaded, we can't filter by product
        return false;
      });
    }

    // Filter by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((order) => {
        const orderDate = new Date(order.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate <= toDate;
      });
    }

    setOrders(filtered);
  }, [allOrders, selectedProductId, dateFrom, dateTo, products]);

  const handleViewOrder = async (orderId: string) => {
    setViewingOrderId(orderId);
    setIsLoadingItems(true);
    try {
      const order = await getOrder(orderId);
      setOrderItems(order.items || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load order details. Please try again."
      );
      setViewingOrderId(null);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleCloseModal = () => {
    setViewingOrderId(null);
    setOrderItems([]);
  };

  const handleDeleteAllOpenOrders = async () => {
    const openOrders = allOrders.filter((order) => order.status === "OPEN");
    
    if (openOrders.length === 0) {
      setError("No open orders to delete.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${openOrders.length} open order(s)? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingOpenOrders(true);
    setError(null);

    try {
      // Delete all open orders in parallel
      await Promise.all(openOrders.map((order) => deleteOrder(order.id)));
      
      // Reload orders to refresh the list
      await loadOrders();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete some orders. Please try again."
      );
    } finally {
      setIsDeletingOpenOrders(false);
    }
  };

  return (
    <RoleProtectedRoute>
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
              <button
                type="button"
                onClick={handleDeleteAllOpenOrders}
                disabled={isLoading || isDeletingOpenOrders}
                className="rounded-full border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingOpenOrders
                  ? "Deleting…"
                  : `Delete Open Orders (${allOrders.filter((o) => o.status === "OPEN").length})`}
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
                    : `${orders.length} order(s)${selectedProductId || dateFrom || dateTo ? " (filtered)" : ""} of ${allOrders.length} total.`}
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              {/* Product Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Filter by Product
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                >
                  <option value="">All Products</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Filters */}
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Quick Date Filters
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const todayStr = today.toISOString().split("T")[0];
                        setDateFrom(todayStr);
                        setDateTo(todayStr);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const weekStart = new Date(today);
                        weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
                        weekStart.setHours(0, 0, 0, 0);
                        const weekEnd = new Date(today);
                        weekEnd.setHours(23, 59, 59, 999);
                        setDateFrom(weekStart.toISOString().split("T")[0]);
                        setDateTo(weekEnd.toISOString().split("T")[0]);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                    >
                      This Week
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                        monthStart.setHours(0, 0, 0, 0);
                        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                        monthEnd.setHours(23, 59, 59, 999);
                        setDateFrom(monthStart.toISOString().split("T")[0]);
                        setDateTo(monthEnd.toISOString().split("T")[0]);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                    >
                      This Month
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[150px]">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date From
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>

                  <div className="min-w-[150px]">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date To
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    />
                  </div>

                  {(selectedProductId || dateFrom || dateTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductId("");
                        setDateFrom("");
                        setDateTo("");
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
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
                      <th className="px-4 py-3 text-left">Actions</th>
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
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleViewOrder(order.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                            title="View order items"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </main>

        {/* Order Items Modal */}
        {viewingOrderId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      Order Items
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {isLoadingItems
                        ? "Loading items…"
                        : `${orderItems.length} item(s)`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Close modal"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-6">
                {isLoadingItems ? (
                  <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                    Loading order items…
                  </div>
                ) : orderItems.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                    No items found in this order.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orderItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900">
                            {item.nameSnapshot}
                          </h3>
                          {item.notes && (
                            <p className="mt-1 text-xs text-slate-500">
                              {item.notes}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                            <span>
                              Qty: <span className="font-semibold">{item.qty}</span>
                            </span>
                            <span>
                              Unit Price:{" "}
                              <span className="font-semibold">
                                {pesoFormatter.format(item.unitPrice)}
                              </span>
                            </span>
                            {item.lineDiscountTotal > 0 && (
                              <span className="text-emerald-600">
                                Discount:{" "}
                                <span className="font-semibold">
                                  −{pesoFormatter.format(item.lineDiscountTotal)}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-900">
                            {pesoFormatter.format(item.lineTotal)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {pesoFormatter.format(item.lineSubtotal)} subtotal
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleProtectedRoute>
  );
}

