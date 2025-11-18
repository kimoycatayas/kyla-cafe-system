"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Logo } from "@/components/branding/Logo";
import { useAuth } from "@/components/auth/AuthSessionBoundary";
import { expireUserAccessToken, logoutUser } from "@/lib/authClient";
import { authStorage } from "@/lib/authStorage";
import {
  CheckoutConfig,
  FinalizeOrderPayload,
  Order,
  OrderItem,
  OrderSummary,
  PaymentInput,
  PaymentMethod,
  type FinalizeOrderResult,
  type OrderReceipt,
} from "@/lib/orderClient";
import type { Product } from "@/lib/productClient";
import type { InventoryItem } from "@/lib/inventoryClient";
// Local-first clients
import {
  fetchProductsLocalFirst,
  fetchOrdersLocalFirst,
  createOrderLocalFirst,
  getOrderSummaryLocalFirst,
  fetchInventoryLocalFirst,
  fetchCheckoutConfigLocalFirst,
  addOrderItemLocalFirst,
  updateOrderItemLocalFirst,
  removeOrderItemLocalFirst,
  finalizeOrderLocalFirst,
  voidOrderLocalFirst,
} from "@/lib/localStorage/localFirstClient";

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
  const router = useRouter();
  const { user } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isExpiringToken, setIsExpiringToken] = useState(false);
  const [tokenNotice, setTokenNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successOrderData, setSuccessOrderData] = useState<{
    total: number;
    cashReceived: number;
    change: number;
    orderNumber: string;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
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

  const isCashier = user?.role === "CASHIER";

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
      const summaryResponse = await getOrderSummaryLocalFirst(orderId);
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
      const orderList = await fetchOrdersLocalFirst();

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
          fetchCheckoutConfigLocalFirst(),
          fetchProductsLocalFirst(),
          fetchInventoryLocalFirst(),
          fetchOrdersLocalFirst(),
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
        targetOrder = await createOrderLocalFirst({ cashierId: user.id });
        orderList.unshift(targetOrder);
      }

      if (targetOrder) {
        await refreshSummary(targetOrder.id, defaultMethod);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "We couldn't load the checkout workspace. Please try again."
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

        await addOrderItemLocalFirst(orderId, {
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
      const newOrder = await createOrderLocalFirst({ cashierId: user.id });
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
      await updateOrderItemLocalFirst(context.order.id, item.id, {
        qty: targetQty,
      });
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
      await removeOrderItemLocalFirst(context.order.id, item.id);
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
      await voidOrderLocalFirst(context.order.id);
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

    if (!summary || summary.totals.totalDue <= 0) {
      setErrorMessage("Order total must be greater than zero.");
      return;
    }

    await flushPendingProductAdds();

    clearMessages();
    setIsProcessing(true);

    const totalDue = summary.totals.totalDue;
    const tenderedAmount = Number(paymentForm.tenderedAmount) || totalDue;

    if (tenderedAmount < totalDue) {
      setErrorMessage("Tendered amount cannot be less than the amount due.");
      setIsProcessing(false);
      return;
    }

    const payload: FinalizeOrderPayload = {
      payments: [
        {
          method: paymentForm.method,
          amount: totalDue,
          tenderedAmount: tenderedAmount,
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
      const result: FinalizeOrderResult = await finalizeOrderLocalFirst(
        context.order.id,
        payload
      );
      triggerReceiptDownload(result.receipt);

      // Show success modal with payment details
      setSuccessOrderData({
        total: totalDue,
        cashReceived: tenderedAmount,
        change: changeAmount,
        orderNumber: result.receipt.orderNumber,
      });
      setShowSuccessModal(true);

      await loadOrders(context.order.id, paymentForm.method);
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
          err instanceof Error ? err.message : "Failed to expire access token.",
      });
    } finally {
      setIsExpiringToken(false);
    }
  };

  const paymentMethods = config?.paymentMethods ?? [];

  const totalDue = summary?.totals.totalDue ?? 0;
  const tenderedAmount = Number(paymentForm.tenderedAmount) || 0;
  const changeAmount = tenderedAmount > 0 ? tenderedAmount - totalDue : 0;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white">
          <div className="flex w-full items-center justify-between gap-4 px-6 py-4">
            {/* Left: Logo and Title */}
            <div className="flex items-center gap-4">
              <Logo
                href="/sales-processing"
                size={60}
                showText={false}
                imageClassName="w-auto h-auto"
                className="shrink-0"
              />
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  Checkout
                </h1>
              </div>
            </div>

            {/* Center: Order Info */}
            {activeOrder && (
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    statusStyles[activeOrder.status]
                  }`}
                >
                  {activeOrder.orderNumber}
                </span>
                <button
                  type="button"
                  onClick={handleRefreshSummary}
                  disabled={isProcessing}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Void
                </button>
              </div>
            )}

            {/* Right: Actions and User */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={isProcessing || !user}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isProcessing ? "Working…" : "New Order"}
              </button>
              {!isCashier && (
                <>
                  <Link
                    href="/orders"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Orders
                  </Link>
                  <Link
                    href="/dashboard"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Dashboard
                  </Link>
                </>
              )}
              <div
                className="relative flex items-center gap-2"
                ref={dropdownRef}
              >
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium text-slate-900">
                    {displayName}
                  </p>
                  <p className="text-xs text-slate-500">{userSubtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={isDropdownOpen}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-800"
                >
                  {profileInitials}
                </button>
                {isDropdownOpen ? (
                  <div className="absolute right-0 top-12 z-20 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={handleOpenSettings}
                      className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      User settings
                    </button>
                    <button
                      type="button"
                      onClick={handleExpireToken}
                      disabled={isExpiringToken || !user}
                      className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-medium text-amber-600 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isExpiringToken ? "Expiring…" : "Expire access token"}
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoggingOut ? "Signing out…" : "Logout"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="flex h-[calc(100vh-80px)] gap-4 overflow-hidden px-6 py-4">
          {tokenNotice ? (
            <div
              className={`absolute left-1/2 top-20 z-50 -translate-x-1/2 rounded-2xl border px-4 py-3 text-sm font-medium ${
                tokenNotice.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {tokenNotice.message}
            </div>
          ) : null}
          {error ? (
            <div className="absolute left-1/2 top-20 z-50 -translate-x-1/2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {feedback ? (
            <div className="absolute left-1/2 top-20 z-50 -translate-x-1/2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {feedback}
            </div>
          ) : null}

          {/* Products Section - Left (70%) */}
          <div className="flex w-[70%] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Products
                </h2>
                <p className="text-sm text-slate-500">
                  {isLoading
                    ? "Loading products…"
                    : products.length > 0
                    ? `${products.length} product(s) available`
                    : "No products available"}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isLoading ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-12 text-sm text-slate-500">
                  Loading products…
                </div>
              ) : products.length === 0 ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-12 text-sm text-slate-500">
                  Products will appear here once added in Product Management.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                        className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-sky-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 group-hover:text-sky-700">
                              {product.name}
                            </h3>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {product.sku}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-base font-bold text-slate-900">
                            {pesoFormatter.format(product.price)}
                          </span>
                          {Number.isFinite(stockLevel) && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                isOutOfStock
                                  ? "bg-rose-100 text-rose-700"
                                  : stockLevel <= 3
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {isOutOfStock ? "Out" : stockLevel}
                            </span>
                          )}
                        </div>
                        {queuedCount > 0 && (
                          <div className="rounded-lg bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
                            Queued ×{queuedCount}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Cart & Checkout Section - Right (30%) */}
          <div className="flex w-[30%] flex-col gap-4 overflow-hidden">
            <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Current Cart
                </h2>
                <p className="text-xs text-slate-500">
                  {summary ? `${summary.itemCount} item(s)` : "No items"}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                    Loading cart…
                  </div>
                ) : !activeOrder || activeOrder.items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-500">
                      No Item Selected
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Tap a product to add it
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-sky-200"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {item.nameSnapshot}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleAdjustQuantity(item, -1)}
                              disabled={isProcessing}
                              className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              −
                            </button>
                            <span className="min-w-[2rem] text-center text-xs font-semibold text-slate-700">
                              {item.qty}
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
                              className="flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            {pesoFormatter.format(item.lineTotal)}
                          </p>
                          {item.lineDiscountTotal > 0 && (
                            <p className="text-xs text-emerald-600">
                              −{pesoFormatter.format(item.lineDiscountTotal)}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item)}
                            disabled={isProcessing}
                            className="mt-1 text-xs font-medium text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Totals & Payment Section */}
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="space-y-3 border-b border-slate-200 pb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-semibold text-slate-900">
                    {summary
                      ? pesoFormatter.format(summary.totals.subtotal)
                      : pesoFormatter.format(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Discounts</span>
                  <span className="font-semibold text-emerald-600">
                    −
                    {summary
                      ? pesoFormatter.format(summary.totals.discountTotal)
                      : pesoFormatter.format(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-base font-semibold text-slate-900">
                    TOTAL
                  </span>
                  <span className="text-lg font-bold text-slate-900">
                    {pesoFormatter.format(totalDue)}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payment Method
                  </span>
                  <select
                    value={paymentForm.method}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        method: event.target.value as PaymentMethod,
                        tenderedAmount:
                          event.target.value === "CASH" && totalDue > 0
                            ? totalDue.toFixed(2)
                            : prev.tenderedAmount,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    disabled={isProcessing || paymentMethods.length === 0}
                  >
                    <option value="" disabled>
                      Select payment method
                    </option>
                    {paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </label>

                {paymentForm.method === "CASH" && totalDue > 0 && (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Customer Cash (₱)
                      </span>
                      <input
                        type="number"
                        min={totalDue}
                        step="0.01"
                        value={paymentForm.tenderedAmount}
                        onChange={(event) =>
                          setPaymentForm((prev) => ({
                            ...prev,
                            tenderedAmount: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-semibold text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                        disabled={isProcessing || !activeOrder}
                        placeholder={totalDue.toFixed(2)}
                      />
                    </label>
                    {tenderedAmount > 0 && (
                      <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-emerald-900">
                            Change
                          </span>
                          <span className="text-lg font-bold text-emerald-700">
                            {changeAmount >= 0
                              ? pesoFormatter.format(changeAmount)
                              : "—"}
                          </span>
                        </div>
                        {changeAmount < 0 && (
                          <p className="mt-1 text-xs text-rose-600">
                            Insufficient amount
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={handleFinalizeOrder}
                  disabled={
                    isProcessing ||
                    !activeOrder ||
                    !paymentForm.method ||
                    activeOrder.items.length === 0 ||
                    totalDue <= 0 ||
                    (paymentForm.method === "CASH" && changeAmount < 0)
                  }
                  className="w-full rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isProcessing ? "Processing…" : "Place Order"}
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Success Modal */}
        {showSuccessModal && successOrderData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <svg
                    className="h-8 w-8 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Order Successful!
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Order #{successOrderData.orderNumber}
                </p>
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">
                    Total Amount
                  </span>
                  <span className="text-lg font-bold text-slate-900">
                    {pesoFormatter.format(successOrderData.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">
                    Cash Received
                  </span>
                  <span className="text-lg font-bold text-slate-900">
                    {pesoFormatter.format(successOrderData.cashReceived)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-300 pt-3">
                  <span className="text-base font-semibold text-slate-900">
                    Change
                  </span>
                  <span className="text-2xl font-bold text-emerald-600">
                    {pesoFormatter.format(successOrderData.change)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  setSuccessOrderData(null);
                  setPaymentForm((prev) => ({
                    ...prev,
                    method: "",
                    tenderedAmount: "0.00",
                  }));
                }}
                className="mt-6 w-full rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
