"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { RoleProtectedRoute } from "@/components/auth/RoleProtectedRoute";
import { Logo } from "@/components/branding/Logo";
import {
  Product,
  createProduct,
  deleteProduct,
  fetchProducts,
  updateProduct,
} from "../../lib/productClient";

type ProductFormState = {
  name: string;
  sku: string;
  price: string;
  cost: string;
  barcode: string;
};

const initialFormState: ProductFormState = {
  name: "",
  sku: "",
  price: "",
  cost: "",
  barcode: "",
};

export default function ProductManagementPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductFormState>(initialFormState);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
      }),
    []
  );

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const response = await fetchProducts();
      setProducts(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn’t load your products. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const resetForm = () => {
    setForm(initialFormState);
    setEditingProductId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFeedback(null);
    setIsSubmitting(true);

    const payload = {
      name: form.name,
      sku: form.sku,
      price: Number(form.price),
      cost: Number(form.cost),
      barcode: form.barcode.trim() ? form.barcode : null,
    };

    if (Number.isNaN(payload.price) || Number.isNaN(payload.cost)) {
      setError("Price and cost must be valid numbers.");
      setIsSubmitting(false);
      return;
    }

    try {
      if (editingProductId) {
        await updateProduct(editingProductId, payload);
        setFeedback("Product updated successfully.");
      } else {
        await createProduct(payload);
        setFeedback("Product saved successfully.");
      }

      await loadProducts();
      resetForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn’t save your product. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProductId(product.id);
    setForm({
      name: product.name,
      sku: product.sku,
      price: product.price.toString(),
      cost: product.cost.toString(),
      barcode: product.barcode ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (product: Product) => {
    const confirmed =
      typeof window !== "undefined"
        ? window.confirm(`Delete ${product.name}? This cannot be undone.`)
        : true;

    if (!confirmed) {
      return;
    }

    try {
      await deleteProduct(product.id);
      setFeedback(`${product.name} was deleted.`);
      await loadProducts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn’t delete the product. Please try again."
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
                href="/product-management"
                size={100}
                textClassName="text-lg font-semibold text-slate-900"
                imageClassName="w-auto"
                className="shrink-0"
                showText={false}
              />
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-sky-600">
                  Product Management
                </p>
                <h1 className="text-3xl font-semibold text-slate-900">
                  Manage menus, costs, and SKUs
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Keep every SKU updated with barcode data, cost tracking, and
                  pricing in one place.
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
            <h2 className="text-lg font-semibold text-slate-900">
              {editingProductId ? "Update product" : "Quick product setup"}
            </h2>
            <p className="text-sm text-slate-500">
              Create SKUs with barcodes, pricing, and cost tracking.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-4 text-sm text-slate-600"
            >
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Product name
                </span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Spanish Latte 16 oz"
                  className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  SKU
                </span>
                <input
                  value={form.sku}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, sku: event.target.value }))
                  }
                  placeholder="BEV-SL-016"
                  className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  required
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Price (₱)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        price: event.target.value,
                      }))
                    }
                    placeholder="165"
                    className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    required
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Cost (₱)
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.cost}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, cost: event.target.value }))
                    }
                    placeholder="82"
                    className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    required
                  />
                </label>
              </div>
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Barcode / PLU
                </span>
                <input
                  value={form.barcode}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      barcode: event.target.value,
                    }))
                  }
                  placeholder="4801234567891"
                  className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>

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
                    ? editingProductId
                      ? "Updating..."
                      : "Saving..."
                    : editingProductId
                    ? "Update product"
                    : "Save product"}
                </button>
                {editingProductId ? (
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
                  Product catalog
                </h2>
                <p className="text-sm text-slate-500">
                  Track pricing, costs, and barcodes for every SKU.
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100">
              {isLoading ? (
                <div className="flex items-center justify-center px-6 py-16 text-sm text-slate-500">
                  Loading products…
                </div>
              ) : products.length === 0 ? (
                <div className="flex items-center justify-center px-6 py-16 text-sm text-slate-500">
                  No products yet. Add your first SKU above.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Cost</th>
                      <th className="px-4 py-3">Barcode</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {products.map((product) => (
                      <tr key={product.id} className="text-slate-700">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {product.name}
                        </td>
                        <td className="px-4 py-3">{product.sku}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {currencyFormatter.format(product.price)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {currencyFormatter.format(product.cost)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {product.barcode ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(product)}
                              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-sky-200 hover:text-sky-700"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(product)}
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
        </main>
      </div>
    </RoleProtectedRoute>
  );
}
