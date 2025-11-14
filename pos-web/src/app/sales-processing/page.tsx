"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Logo } from "@/components/branding/Logo";
import { authStorage } from "@/lib/authStorage";
import {
  CheckoutConfig,
  FinalizeOrderPayload,
  Order,
  OrderItem,
  OrderSummary,
  PaymentInput,
  PaymentMethod,
  addOrderItem,
  createOrder,
  fetchCheckoutConfig,
  fetchOrders,
  finalizeOrder,
  getOrderSummary,
  removeOrderItem,
  updateOrderItem,
  voidOrder,
  type FinalizeOrderResult,
  type OrderReceipt,
} from "@/lib/orderClient";
import { fetchProducts } from "@/lib/productClient";
import type { Product } from "@/lib/productClient";
import { fetchInventory } from "@/lib/inventoryClient";

type PaymentFormState = {
  method: PaymentMethod | "";
  amount: string;
  tenderedAmount: string;
};

type MessageState = {
  error: string | null;
  feedback: string | null;
};

const statusStyles: Record<Order["status"], string> = {
  OPEN: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-600",
  VOID: "bg-slate-200 text-slate-600",
  REFUNDED: "bg-rose-100 text-rose-600",
};

export default function SalesProcessingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryQuantities, setInventoryQuantities] = useState<
    Record<string, number>
  >({});
  const [orderItemQuantities, setOrderItemQuantities] = useState<
    Record<string, number>
  >({});
  const orderItemQuantitiesRef = useRef(orderItemQuantities);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(() => ({
    method: "",
    amount: "0.00",
    tenderedAmount: "0.00",
  }));
  const [{ error, feedback }, setMessage] = useState<MessageState>({
    error: null,
    feedback: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingProductAdds, setPendingProductAdds] = useState<
    Record<string, number>
  >({});
  const pendingProductAddsRef = useRef(pendingProductAdds);
  const addProductsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const user = useMemo(() => authStorage.getUser(), []);

  const pesoFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
      }),
    []
  );

  const setFeedbackMessage = (message: string) =>
    setMessage({ error: null, feedback: message });
  const setErrorMessage = (message: string) =>
    setMessage({ error: message, feedback: null });
  const clearMessages = () => setMessage({ error: null, feedback: null });

  const updateOrderQuantity = useCallback(
    (productId: string | null, updater: (current: number) => number) => {
      if (!productId) {
        return;
      }

      setOrderItemQuantities((prev) => {
        const next = { ...prev };
        const current = next[productId] ?? 0;
        const updated = updater(current);

        if (updated <= 0) {
          delete next[productId];
        } else {
          next[productId] = updated;
        }

        orderItemQuantitiesRef.current = next;
        return next;
      });
    },
    []
  );

  const getRemainingStock = useCallback(
    (productId: string | null | undefined) => {
      if (!productId) {
        return Number.POSITIVE_INFINITY;
      }

      const baseQuantity = inventoryQuantities[productId];
      if (typeof baseQuantity !== "number") {
        return 0;
      }

      const committed = orderItemQuantities[productId] ?? 0;
      const pending = pendingProductAdds[productId] ?? 0;
      const remaining = baseQuantity - committed - pending;
      return remaining > 0 ? remaining : 0;
    },
    [inventoryQuantities, orderItemQuantities, pendingProductAdds]
  );

  const resolveDefaultMethod = useCallback((): PaymentMethod | "" => {
    if (paymentForm.method) {
      return paymentForm.method;
    }
    return config?.paymentMethods?.[0]?.value ?? "";
  }, [config?.paymentMethods, paymentForm.method]);

  const refreshSummary = useCallback(
    async (orderId: string, preferredMethod?: PaymentMethod | "") => {
      const summaryResponse = await getOrderSummary(orderId);
      setSummary(summaryResponse);

      const nextCounts = summaryResponse.order.items.reduce<
        Record<string, number>
      >((acc, item) => {
        if (item.productId) {
          acc[item.productId] = (acc[item.productId] ?? 0) + item.qty;
        }
        return acc;
      }, {});
      orderItemQuantitiesRef.current = nextCounts;
      setOrderItemQuantities(nextCounts);

      const totalDue = summaryResponse.totals.totalDue;
      const nextMethod = preferredMethod || resolveDefaultMethod();
      setPaymentForm((prev) => ({
        method: nextMethod,
        amount: totalDue.toFixed(2),
        tenderedAmount:
          totalDue > 0
            ? totalDue.toFixed(2)
            : prev.tenderedAmount && prev.tenderedAmount.trim().length > 0
            ? prev.tenderedAmount
            : "0.00",
      }));

      return summaryResponse;
    },
    [resolveDefaultMethod]
  );

  const loadOrders = useCallback(
    async (selectOrderId?: string, preferredMethod?: PaymentMethod | "") => {
      const orderList = await fetchOrders();

      let targetOrderId = selectOrderId;
      if (!targetOrderId) {
        targetOrderId = orderList.find((order) => order.status === "OPEN")?.id;
      }
      if (!targetOrderId) {
        targetOrderId = orderList[0]?.id;
      }

      if (targetOrderId) {
        await refreshSummary(targetOrderId, preferredMethod);
      } else {
        setSummary(null);
        orderItemQuantitiesRef.current = {};
        setOrderItemQuantities({});
      }

      return orderList;
    },
    [refreshSummary]
  );

  const initialiseCheckout = useCallback(async () => {
    if (!user) {
      setErrorMessage("You need to be logged in to process sales.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [configResponse, productList, inventoryList, orderList] =
        await Promise.all([
          fetchCheckoutConfig(),
          fetchProducts(),
          fetchInventory(),
          fetchOrders(),
        ]);

      setConfig(configResponse);
      setProducts(productList);
      setInventoryQuantities(() =>
        inventoryList.reduce<Record<string, number>>((acc, item) => {
          acc[item.product.id] = item.quantity;
          return acc;
        }, {})
      );

      const defaultMethod =
        configResponse.paymentMethods[0]?.value ?? ("" as PaymentMethod | "");
      let targetOrder = orderList.find((order) => order.status === "OPEN");

      if (!targetOrder) {
        targetOrder = await createOrder({ cashierId: user.id });
        orderList.unshift(targetOrder);
      }

      if (targetOrder) {
        await refreshSummary(targetOrder.id, defaultMethod);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "We couldn’t load the checkout workspace. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, [refreshSummary, user]);

  const hasInitialisedRef = useRef(false);

  useEffect(() => {
    if (hasInitialisedRef.current) {
      return;
    }
    hasInitialisedRef.current = true;
    void initialiseCheckout();
  }, [initialiseCheckout]);

  useEffect(() => {
    orderItemQuantitiesRef.current = orderItemQuantities;
  }, [orderItemQuantities]);

  useEffect(() => {
    pendingProductAddsRef.current = pendingProductAdds;
  }, [pendingProductAdds]);

  const activeOrder = summary?.order ?? null;

  const flushPendingProductAdds = useCallback(async () => {
    if (addProductsTimerRef.current) {
      clearTimeout(addProductsTimerRef.current);
      addProductsTimerRef.current = null;
    }

    const queued = pendingProductAddsRef.current;
    if (!queued || Object.keys(queued).length === 0) {
      return;
    }

    if (!activeOrder) {
      setPendingProductAdds({});
      pendingProductAddsRef.current = {};
      return;
    }

    setPendingProductAdds({});
    pendingProductAddsRef.current = {};

    clearMessages();
    setIsProcessing(true);
    try {
      const orderId = activeOrder.id;
      const additions = Object.entries(queued);
      const limitedProducts = new Set<string>();

      for (const [productId, quantity] of additions) {
        const product = products.find((item) => item.id === productId);
        if (!product) {
          continue;
        }

        const baseQuantity = inventoryQuantities[product.id];
        if (typeof baseQuantity !== "number") {
          limitedProducts.add(product.name);
          continue;
        }

        const committed = orderItemQuantitiesRef.current[product.id] ?? 0;
        const available = baseQuantity - committed;
        if (available <= 0) {
          limitedProducts.add(product.name);
          continue;
        }

        const allowedQty = Math.min(quantity, available);
        if (allowedQty < quantity) {
          limitedProducts.add(product.name);
        }
        if (allowedQty <= 0) {
          continue;
        }

        await addOrderItem(orderId, {
          productId: product.id,
          nameSnapshot: product.name,
          qty: allowedQty,
          unitPrice: product.price,
          lineDiscountTotal: 0,
        });

        updateOrderQuantity(product.id, (current) => current + allowedQty);
      }

      await refreshSummary(orderId, paymentForm.method);
      if (limitedProducts.size > 0) {
        setFeedbackMessage(
          `Cart updated. Limited stock for: ${Array.from(limitedProducts).join(
            ", "
          )}.`
        );
      } else {
        setFeedbackMessage("Cart updated.");
      }
    } catch (err) {
      setPendingProductAdds(queued);
      pendingProductAddsRef.current = queued;
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "We couldn’t update the cart. Please try again."
      );
    } finally {
      setIsProcessing(false);
    }
  }, [
    activeOrder?.id,
    clearMessages,
    inventoryQuantities,
    paymentForm.method,
    products,
    refreshSummary,
    setFeedbackMessage,
    setErrorMessage,
    updateOrderQuantity,
  ]);

  useEffect(() => {
    return () => {
      if (addProductsTimerRef.current) {
        clearTimeout(addProductsTimerRef.current);
      }
    };
  }, []);

  const ensureActiveOrder = () => {
    if (!user) {
      setErrorMessage("No logged-in cashier found.");
      return null;
    }
    if (!activeOrder) {
      setErrorMessage("There is no active order at the moment.");
      return null;
    }
    return { userId: user.id, order: activeOrder };
  };

  const handleCreateOrder = async () => {
    if (!user) {
      setErrorMessage("No logged-in cashier found.");
      return;
    }

    await flushPendingProductAdds();

    clearMessages();
    setIsProcessing(true);

    try {
      const newOrder = await createOrder({ cashierId: user.id });
      await loadOrders(newOrder.id, paymentForm.method);
      setFeedbackMessage("New order created. Ready to add items.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to create a new order right now."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddProduct = (product: Product) => {
    if (!activeOrder) {
      setErrorMessage("There is no active order at the moment.");
      return;
    }

    const remainingStock = getRemainingStock(product.id);
    if (remainingStock <= 0) {
      setErrorMessage(
        `${product.name} is out of stock. Restock it before selling.`
      );
      return;
    }

    clearMessages();
    setPendingProductAdds((prev) => {
      const next = { ...prev, [product.id]: (prev[product.id] ?? 0) + 1 };
      return next;
    });

    pendingProductAddsRef.current = {
      ...pendingProductAddsRef.current,
      [product.id]: (pendingProductAddsRef.current[product.id] ?? 0) + 1,
    };

    if (addProductsTimerRef.current) {
      clearTimeout(addProductsTimerRef.current);
    }

    addProductsTimerRef.current = setTimeout(() => {
      void flushPendingProductAdds();
    }, 350);
  };

  const handleAdjustQuantity = async (item: OrderItem, delta: number) => {
    const context = ensureActiveOrder();
    if (!context) return;

    const nextQtyRaw = item.qty + delta;
    if (nextQtyRaw <= 0) {
      await handleRemoveItem(item);
      return;
    }

    let targetQty = nextQtyRaw;
    if (item.productId) {
      const baseQuantity = inventoryQuantities[item.productId];
      if (typeof baseQuantity === "number") {
        const committed = orderItemQuantitiesRef.current[item.productId] ?? 0;
        const otherQty = committed - item.qty;
        const maxAllowed = Math.max(baseQuantity - otherQty, 0);
        targetQty = Math.min(targetQty, maxAllowed);
      }
    }

    if (targetQty <= 0) {
      await handleRemoveItem(item);
      return;
    }

    if (targetQty === item.qty) {
      setFeedbackMessage("No additional stock available for this item.");
      return;
    }

    await flushPendingProductAdds();

    clearMessages();
    setIsProcessing(true);
    try {
      await updateOrderItem(context.order.id, item.id, { qty: targetQty });
      updateOrderQuantity(item.productId, () => targetQty);
      await refreshSummary(context.order.id, paymentForm.method);
      setFeedbackMessage("Item quantity updated.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Unable to update item quantity."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveItem = async (item: OrderItem) => {
    const context = ensureActiveOrder();
    if (!context) return;

    await flushPendingProductAdds();

    clearMessages();
    setIsProcessing(true);
    try {
      await removeOrderItem(context.order.id, item.id);
      await refreshSummary(context.order.id, paymentForm.method);
      setFeedbackMessage(`${item.nameSnapshot} removed from the order.`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to remove the item right now."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoidOrder = async () => {
    const context = ensureActiveOrder();
    if (!context) return;

    await flushPendingProductAdds();

    clearMessages();
    setIsProcessing(true);
    try {
      await voidOrder(context.order.id);
      await loadOrders(context.order.id, paymentForm.method);
      setFeedbackMessage("Order voided. Create a new order when ready.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to void the order right now."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalizeOrder = async () => {
    const context = ensureActiveOrder();
    if (!context) return;

    if (!paymentForm.method) {
      setErrorMessage("Select a payment method before finalising.");
      return;
    }

    const amountValue = Number(paymentForm.amount);
    const tenderedValue = Number(paymentForm.tenderedAmount);

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setErrorMessage("Payment amount must be greater than zero.");
      return;
    }

    if (!Number.isFinite(tenderedValue) || tenderedValue < amountValue) {
      setErrorMessage("Tendered amount cannot be less than the amount due.");
      return;
    }

    await flushPendingProductAdds();

    clearMessages();
    setIsProcessing(true);

    const payload: FinalizeOrderPayload = {
      payments: [
        {
          method: paymentForm.method,
          amount: amountValue,
          tenderedAmount: tenderedValue,
          processedByUserId: context.userId,
        } satisfies PaymentInput,
      ],
    };

    const triggerReceiptDownload = (receipt: OrderReceipt) => {
      if (typeof window === "undefined") return;

      const blob = new Blob([receipt.printable.content], {
        type: receipt.printable.mimeType || "text/plain",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        receipt.printable.filename || `${receipt.orderNumber}-receipt.txt`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    try {
      const result: FinalizeOrderResult = await finalizeOrder(
        context.order.id,
        payload
      );
      triggerReceiptDownload(result.receipt);
      await loadOrders(context.order.id, paymentForm.method);
      setFeedbackMessage(
        "Order paid successfully. Ready for the next customer."
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to finalise the order. Please try again."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefreshSummary = async () => {
    const context = ensureActiveOrder();
    if (!context) return;

    await flushPendingProductAdds();

    clearMessages();
    setIsProcessing(true);
    try {
      await refreshSummary(context.order.id, paymentForm.method);
      setFeedbackMessage("Order details refreshed.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to refresh the order details right now."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const paymentMethods = config?.paymentMethods ?? [];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
            <div className="flex flex-wrap items-center gap-4">
              <Logo
                href="/sales-processing"
                size={100}
                showText={false}
                imageClassName="w-auto"
                className="shrink-0"
              />
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-sky-600">
                  Sales Processing
                </p>
                <h1 className="text-3xl font-semibold text-slate-900">
                  Checkout and payment center
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Add items quickly, process mixed tenders, and keep inventory
                  in sync.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={isProcessing || !user}
                className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isProcessing ? "Working…" : "New order"}
              </button>
              <Link
                href="/orders"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
              >
                Orders
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-700"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {feedback ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {feedback}
            </div>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Active order
                </h2>
                <p className="text-sm text-slate-500">
                  {isLoading
                    ? "Loading checkout workspace…"
                    : activeOrder
                    ? `Order ${activeOrder.orderNumber}`
                    : "Create a new order to begin checkout."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeOrder ? (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      statusStyles[activeOrder.status]
                    }`}
                  >
                    {activeOrder.status}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={handleRefreshSummary}
                  disabled={isProcessing || !activeOrder}
                  className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={handleVoidOrder}
                  disabled={
                    isProcessing ||
                    !activeOrder ||
                    activeOrder.status !== "OPEN"
                  }
                  className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Void order
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr,1fr]">
              <div className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">
                    Cart items
                  </p>
                  <span className="text-xs text-slate-500">
                    {products.length > 0
                      ? `${products.length} product(s)`
                      : "—"}
                  </span>
                </div>

                <div className="mt-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                      Loading products…
                    </div>
                  ) : products.length === 0 ? (
                    <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                      Products will appear here once added in Product
                      Management.
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {products.map((product) => {
                        const queuedCount = pendingProductAdds[product.id] ?? 0;
                        const stockLevel = getRemainingStock(product.id);
                        const isOutOfStock = stockLevel <= 0;
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => handleAddProduct(product)}
                            disabled={!activeOrder || isOutOfStock}
                            className="flex flex-col items-start gap-1 rounded-2xl border border-slate-200 px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <span className="text-sm font-semibold text-slate-900">
                              {product.name}
                            </span>
                            <span className="text-xs text-slate-500">
                              SKU: {product.sku}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">
                              {pesoFormatter.format(product.price)}
                            </span>
                            {Number.isFinite(stockLevel) ? (
                              <span
                                className={`text-xs font-semibold ${
                                  isOutOfStock
                                    ? "text-rose-600"
                                    : stockLevel <= 3
                                    ? "text-amber-600"
                                    : "text-emerald-600"
                                }`}
                              >
                                {isOutOfStock
                                  ? "Out of stock"
                                  : `Stock: ${stockLevel}`}
                              </span>
                            ) : null}
                            {queuedCount > 0 ? (
                              <span className="text-xs font-semibold text-sky-600">
                                Queued ×{queuedCount}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">
                      Current cart
                    </p>
                    <span className="text-xs text-slate-500">
                      {summary ? `${summary.itemCount} item(s)` : "—"}
                    </span>
                  </div>

                  <div className="mt-3 space-y-3 text-sm text-slate-600">
                    {isLoading ? (
                      <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-6 text-slate-500">
                        Loading cart…
                      </div>
                    ) : !activeOrder || activeOrder.items.length === 0 ? (
                      <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-6 text-slate-500">
                        No items yet. Tap a product above to add it.
                      </div>
                    ) : (
                      activeOrder.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-sky-200"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">
                              {item.nameSnapshot}
                            </p>
                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                              <button
                                type="button"
                                onClick={() => handleAdjustQuantity(item, -1)}
                                disabled={isProcessing}
                                className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                −
                              </button>
                              <span className="font-semibold text-slate-700">
                                Qty: {item.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAdjustQuantity(item, 1)}
                                disabled={
                                  isProcessing ||
                                  (item.productId
                                    ? getRemainingStock(item.productId) <= 0
                                    : false)
                                }
                                className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-semibold text-slate-900">
                              {pesoFormatter.format(item.lineTotal)}
                            </p>
                            {item.lineDiscountTotal > 0 ? (
                              <p className="text-xs text-emerald-600">
                                − {pesoFormatter.format(item.lineDiscountTotal)}
                              </p>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item)}
                              disabled={isProcessing}
                              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-slate-100 p-4 text-sm text-slate-600">
                  <p className="text-sm font-semibold text-slate-700">Totals</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Subtotal</span>
                      <span className="font-medium text-slate-900">
                        {summary
                          ? pesoFormatter.format(summary.totals.subtotal)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Discounts</span>
                      <span className="font-medium text-emerald-600">
                        −
                        {summary
                          ? pesoFormatter.format(summary.totals.discountTotal)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 text-base font-semibold text-slate-900">
                      <span>Total due</span>
                      <span>
                        {summary
                          ? pesoFormatter.format(summary.totals.totalDue)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Paid</span>
                      <span>
                        {summary
                          ? pesoFormatter.format(summary.totals.totalPaid)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Change due</span>
                      <span>
                        {summary
                          ? pesoFormatter.format(summary.totals.changeDue)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Balance remaining</span>
                      <span>
                        {summary
                          ? pesoFormatter.format(summary.totals.balanceDue)
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-sm font-semibold text-slate-700">
                    Take payment
                  </p>
                  <div className="mt-3 space-y-3 text-sm text-slate-600">
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Payment method
                      </span>
                      <select
                        value={paymentForm.method}
                        onChange={(event) =>
                          setPaymentForm((prev) => ({
                            ...prev,
                            method: event.target.value as PaymentMethod,
                          }))
                        }
                        className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        disabled={isProcessing || paymentMethods.length === 0}
                      >
                        <option value="" disabled>
                          Select
                        </option>
                        {paymentMethods.map((method) => (
                          <option key={method.value} value={method.value}>
                            {method.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Amount (₱)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentForm.amount}
                        onChange={(event) =>
                          setPaymentForm((prev) => ({
                            ...prev,
                            amount: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        disabled={isProcessing || !activeOrder}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tendered (₱)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentForm.tenderedAmount}
                        onChange={(event) =>
                          setPaymentForm((prev) => ({
                            ...prev,
                            tenderedAmount: event.target.value,
                          }))
                        }
                        className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        disabled={isProcessing || !activeOrder}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleFinalizeOrder}
                      disabled={
                        isProcessing ||
                        !activeOrder ||
                        activeOrder.status !== "OPEN" ||
                        (activeOrder.items?.length ?? 0) === 0
                      }
                      className="w-full rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Finalise and print receipt
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
