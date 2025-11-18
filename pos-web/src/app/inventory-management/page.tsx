"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { RoleProtectedRoute } from "@/components/auth/RoleProtectedRoute";
import { Logo } from "@/components/branding/Logo";
import { fetchProducts } from "@/lib/productClient";
import type { Product } from "@/lib/productClient";
import {
  InventoryItem,
  createInventory,
  deleteInventory,
  fetchInventory,
  fetchLowStock,
  fetchStockTracker,
  updateInventory,
} from "@/lib/inventoryClient";

type InventoryFormState = {
  productId: string;
  quantity: string;
  lowStockThreshold: string;
};

const initialFormState: InventoryFormState = {
  productId: "",
  quantity: "",
  lowStockThreshold: "5",
};

const InventoryStatusBadge = ({
  status,
}: {
  status: InventoryItem["status"];
}) => {
  const styles =
    status === "low"
      ? "bg-rose-100 text-rose-600"
      : "bg-emerald-100 text-emerald-600";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>
      {status === "low" ? "Low stock" : "Healthy"}
    </span>
  );
};

export default function InventoryManagementPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventories, setInventories] = useState<InventoryItem[]>([]);
  const [stockTracker, setStockTracker] = useState<InventoryItem[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [form, setForm] = useState<InventoryFormState>(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => {
      map.set(product.id, product);
    });
    return map;
  }, [products]);

  const loadInventory = async () => {
    setIsLoading(true);
    try {
      const [inventoryList, trackerList, lowStockList] = await Promise.all([
        fetchInventory(),
        fetchStockTracker(),
        fetchLowStock(),
      ]);
      setInventories(inventoryList);
      setStockTracker(trackerList);
      setLowStock(lowStockList);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load inventory data right now."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productList] = await Promise.all([fetchProducts()]);
        setProducts(productList);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load products. Please try again."
        );
      } finally {
        await loadInventory();
      }
    };

    loadData();
  }, []);

  const resetForm = () => {
    setForm(initialFormState);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFeedback(null);

    const quantity = Number(form.quantity);
    const threshold = Number(form.lowStockThreshold);

    if (Number.isNaN(quantity) || quantity < 0) {
      setError("Quantity must be zero or a positive number.");
      return;
    }

    if (Number.isNaN(threshold) || threshold < 0) {
      setError("Low-stock threshold must be zero or a positive number.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingId) {
        await updateInventory(editingId, {
          productId: form.productId,
          quantity,
          lowStockThreshold: threshold,
        });
        setFeedback("Inventory updated successfully.");
      } else {
        await createInventory({
          productId: form.productId,
          quantity,
          lowStockThreshold: threshold,
        });
        setFeedback("Inventory entry created successfully.");
      }

      await loadInventory();
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn’t save your inventory update. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setForm({
      productId: item.product.id,
      quantity: item.quantity.toString(),
      lowStockThreshold: item.lowStockThreshold.toString(),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (item: InventoryItem) => {
    const confirmed =
      typeof window === "undefined"
        ? true
        : window.confirm(
            `Delete inventory record for ${item.product.name}? This cannot be undone.`
          );

    if (!confirmed) {
      return;
    }

    try {
      await deleteInventory(item.id);
      setFeedback(`${item.product.name} inventory was deleted.`);
      await loadInventory();
      if (editingId === item.id) {
        resetForm();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete inventory. Please try again."
      );
    }
  };

  return (
    <RoleProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
            <div className="flex flex-wrap items-center gap-4">
              <Logo
                href="/inventory-management"
                size={100}
                textClassName="text-lg font-semibold text-slate-900"
                imageClassName="w-auto"
                className="shrink-0"
                showText={false}
              />
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-sky-600">
                  Inventory Management
                </p>
                <h1 className="text-3xl font-semibold text-slate-900">
                  Stock visibility in real time
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Automatic deductions, barcode scanning, and alerts keep every
                  branch stocked.
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

        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg	font-semibold text-slate-900">
                  {editingId ? "Update inventory" : "Add product to inventory"}
                </h2>
                <p className="text-sm text-slate-500">
                  Track quantity on-hand and trigger low-stock alerts per SKU.
                </p>
              </div>
            </div>

            <form
              className="mt-6 space-y-4 text-sm text-slate-600"
              onSubmit={handleSubmit}
            >
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Product
                </span>
                <select
                  required
                  value={form.productId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      productId: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="">Select a product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Quantity on-hand
                  </span>
                  <input
                    required
                    min="0"
                    type="number"
                    value={form.quantity}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        quantity: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    placeholder="e.g. 42"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Low-stock threshold
                  </span>
                  <input
                    required
                    min="0"
                    type="number"
                    value={form.lowStockThreshold}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        lowStockThreshold: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    placeholder="e.g. 10"
                  />
                </label>
              </div>

              {error ? (
                <p className="text-sm font-medium text-red-600">{error}</p>
              ) : null}
              {feedback ? (
                <p className="text-sm font-medium text-emerald-600">
                  {feedback}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting
                    ? editingId
                      ? "Updating inventory..."
                      : "Saving inventory..."
                    : editingId
                    ? "Update inventory"
                    : "Save inventory"}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Inventory overview
                </h2>
                <p className="text-sm text-slate-500">
                  Track current counts and alert thresholds per SKU.
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100">
              {isLoading ? (
                <div className="flex items-center justify-center px-6 py-16 text-sm text-slate-500">
                  Loading inventory…
                </div>
              ) : inventories.length === 0 ? (
                <div className="flex items-center justify-center px-6 py-16 text-sm text-slate-500">
                  No inventory records yet. Add your first SKU above.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Quantity</th>
                      <th className="px-4 py-3">Threshold</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {inventories.map((item) => (
                      <tr key={item.id} className="text-slate-700">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {item.product.name}
                        </td>
                        <td className="px-4 py-3">{item.product.sku}</td>
                        <td className="px-4 py-3 text-slate-900">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.lowStockThreshold}
                        </td>
                        <td className="px-4 py-3">
                          <InventoryStatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(item)}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-600 transition hover:border-red-300 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Real-time stock tracker
                  </h2>
                  <p className="text-sm text-slate-500">
                    Latest counts sorted by lowest quantity across all SKUs.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {stockTracker.length === 0 ? (
                  <p className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    No inventory data yet. Add stock to see live tracking.
                  </p>
                ) : (
                  stockTracker.slice(0, 6).map((item) => {
                    const product = productsById.get(item.product.id);
                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {product?.name ?? item.product.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {product?.sku ?? item.product.sku}
                            </p>
                          </div>
                          <InventoryStatusBadge status={item.status} />
                        </div>
                        <p className="mt-2 text-xs text-slate-600">
                          Quantity on hand: {item.quantity} • Threshold:{" "}
                          {item.lowStockThreshold}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          Updated {new Date(item.updatedAt).toLocaleString()}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Low-stock alerts
              </h2>
              <p className="text-sm text-slate-500">
                Items at or below threshold, ready for replenishment.
              </p>

              <div className="mt-6 space-y-4">
                {lowStock.length === 0 ? (
                  <p className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    No low-stock alerts. Everything looks good!
                  </p>
                ) : (
                  lowStock.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.product.sku}
                          </p>
                        </div>
                        <InventoryStatusBadge status={item.status} />
                      </div>
                      <p className="mt-2 text-xs text-slate-600">
                        Quantity remaining: {item.quantity} • Threshold:{" "}
                        {item.lowStockThreshold}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Updated {new Date(item.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </RoleProtectedRoute>
  );
}
