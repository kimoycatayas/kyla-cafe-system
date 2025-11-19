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
  PaymentInput,
  PaymentMethod,
  type FinalizeOrderResult,
  type OrderReceipt,
} from "@/lib/orderClient";
import type { Product } from "@/lib/productClient";
import { fetchProducts } from "@/lib/productClient";
import type { InventoryItem } from "@/lib/inventoryClient";
import { fetchInventory } from "@/lib/inventoryClient";
// Order operations: ONLY used when user clicks "Place Order"
// createAndFinalizeOrder is the ONLY function called - single API call for everything
import { fetchCheckoutConfig, createAndFinalizeOrder } from "@/lib/orderClient";

type PaymentFormState = {
  method: PaymentMethod | "";
  amount: string;
  tenderedAmount: string;
};

type MessageState = {
  error: string | null;
  feedback: string | null;
};

type LocalCartItem = {
  productId: string | null;
  nameSnapshot: string;
  notes: string | null;
  qty: number;
  unitPrice: number;
  lineDiscountTotal: number;
};

// Removed statusStyles - no longer needed without active order display

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
  const mobileDropdownRef = useRef<HTMLDivElement | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryQuantities, setInventoryQuantities] = useState<
    Record<string, number>
  >({});
  // Cart is always empty on page load - no session persistence
  const [cartItems, setCartItems] = useState<LocalCartItem[]>([]);
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

  const getRemainingStock = useCallback(
    (productId: string | null | undefined) => {
      if (!productId) {
        return Number.POSITIVE_INFINITY;
      }

      const baseQuantity = inventoryQuantities[productId];
      if (typeof baseQuantity !== "number") {
        return 0;
      }

      // Calculate how many are in the cart
      const inCart = cartItems
        .filter((item) => item.productId === productId)
        .reduce((sum, item) => sum + item.qty, 0);

      const remaining = baseQuantity - inCart;
      return remaining > 0 ? remaining : 0;
    },
    [inventoryQuantities, cartItems]
  );

  const resolveDefaultMethod = useCallback((): PaymentMethod | "" => {
    if (paymentForm.method) {
      return paymentForm.method;
    }
    return config?.paymentMethods?.[0]?.value ?? "";
  }, [config?.paymentMethods, paymentForm.method]);

  // Calculate totals from local cart items
  const cartTotals = useMemo(() => {
    const subtotal = cartItems.reduce(
      (sum, item) => sum + item.unitPrice * item.qty,
      0
    );
    const discountTotal = cartItems.reduce(
      (sum, item) => sum + item.lineDiscountTotal,
      0
    );
    const totalDue = subtotal - discountTotal;

    return {
      subtotal,
      discountTotal,
      totalDue,
      totalPaid: 0,
      changeDue: 0,
      balanceDue: totalDue,
    };
  }, [cartItems]);

  const itemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty, 0),
    [cartItems]
  );

  // Initialize checkout: Only loads config, products, and inventory
  // NO order creation, NO cart restoration, NO session persistence
  const initialiseCheckout = useCallback(async () => {
    if (!user) {
      setErrorMessage("You need to be logged in to process sales.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Only load essential data - no orders, no cart state
      const [configResponse, productList, inventoryList] = await Promise.all([
        fetchCheckoutConfig(),
        fetchProducts(),
        fetchInventory(),
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
      setPaymentForm((prev) => ({
        ...prev,
        method: defaultMethod,
      }));
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "We couldn't load the checkout workspace. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const hasInitialisedRef = useRef(false);

  // Initialize on mount: Only loads config/products/inventory
  // NEVER creates orders, NEVER restores cart, NEVER calls /orders endpoints
  useEffect(() => {
    if (hasInitialisedRef.current) {
      return;
    }
    hasInitialisedRef.current = true;
    void initialiseCheckout();
  }, [initialiseCheckout]);

  // Update payment form when cart totals change
  useEffect(() => {
    if (cartTotals.totalDue > 0) {
      setPaymentForm((prev) => ({
        ...prev,
        amount: cartTotals.totalDue.toFixed(2),
        tenderedAmount:
          prev.method === "CASH" && cartTotals.totalDue > 0
            ? cartTotals.totalDue.toFixed(2)
            : prev.tenderedAmount,
      }));
    }
  }, [cartTotals.totalDue]);

  const handleAddProduct = (product: Product) => {
    const remainingStock = getRemainingStock(product.id);
    if (remainingStock <= 0) {
      setErrorMessage(
        `${product.name} is out of stock. Restock it before selling.`
      );
      return;
    }

    clearMessages();

    // Find existing item in cart
    const existingItemIndex = cartItems.findIndex(
      (item) => item.productId === product.id
    );

    if (existingItemIndex >= 0) {
      // Update quantity
      setCartItems((prev) => {
        const next = [...prev];
        const existing = next[existingItemIndex];
        if (existing) {
          next[existingItemIndex] = {
            ...existing,
            qty: existing.qty + 1,
          };
        }
        return next;
      });
    } else {
      // Add new item
      const newItem: LocalCartItem = {
        productId: product.id,
        nameSnapshot: product.name,
        notes: null,
        qty: 1,
        unitPrice: product.price,
        lineDiscountTotal: 0,
      };
      setCartItems((prev) => [...prev, newItem]);
    }

    setFeedbackMessage(`${product.name} added to cart.`);
  };

  const handleAdjustQuantity = (item: LocalCartItem, delta: number) => {
    const itemIndex = cartItems.findIndex(
      (i) =>
        i.productId === item.productId && i.nameSnapshot === item.nameSnapshot
    );

    if (itemIndex < 0) return;

    const currentQty = item.qty;
    const nextQty = currentQty + delta;

    if (nextQty <= 0) {
      handleRemoveItem(item);
      return;
    }

    // Check stock availability
    if (item.productId) {
      const remainingStock = getRemainingStock(item.productId);
      const currentInCart = cartItems
        .filter((i) => i.productId === item.productId)
        .reduce((sum, i) => sum + i.qty, 0);
      const available = remainingStock + currentQty; // Add back current qty

      if (nextQty > available) {
        setFeedbackMessage("Not enough stock available for this item.");
        return;
      }
    }

    clearMessages();
    setCartItems((prev) => {
      const next = [...prev];
      const existing = next[itemIndex];
      if (existing) {
        next[itemIndex] = {
          ...existing,
          qty: nextQty,
        };
      }
      return next;
    });
    setFeedbackMessage("Item quantity updated.");
  };

  const handleRemoveItem = (item: LocalCartItem) => {
    clearMessages();
    setCartItems((prev) =>
      prev.filter(
        (i) =>
          !(
            i.productId === item.productId &&
            i.nameSnapshot === item.nameSnapshot
          )
      )
    );
    setFeedbackMessage(`${item.nameSnapshot} removed from cart.`);
  };

  // ONLY function that creates orders - called when user clicks "Place Order"
  // Single API call: creates order + adds items + finalizes in one transaction
  // NO orders are created on page load, refresh, or any other time
  const handleFinalizeOrder = async () => {
    if (!user) {
      setErrorMessage("No logged-in cashier found.");
      return;
    }

    if (!paymentForm.method) {
      setErrorMessage("Select a payment method before finalising.");
      return;
    }

    if (cartItems.length === 0) {
      setErrorMessage("Cart is empty. Add items before placing order.");
      return;
    }

    const totalDue = cartTotals.totalDue;
    if (totalDue <= 0) {
      setErrorMessage("Order total must be greater than zero.");
      return;
    }

    const tenderedAmount = Number(paymentForm.tenderedAmount) || totalDue;

    if (tenderedAmount < totalDue) {
      setErrorMessage("Tendered amount cannot be less than the amount due.");
      return;
    }

    clearMessages();
    setIsProcessing(true);

    // Capture cart items snapshot to prevent issues if state changes during processing
    const itemsToAdd = [...cartItems];
    const savedTotalDue = totalDue;
    const savedTenderedAmount = tenderedAmount;

    // Optimistic UI update: Clear cart immediately for better perceived performance
    // If request fails, we'll restore it in the catch block
    setCartItems([]);
    setFeedbackMessage("Processing order...");

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
      // Single API call: create order + add items + finalize in one transaction
      const payload = {
        cashierId: user.id,
        items: itemsToAdd.map((item) => ({
          productId: item.productId,
          nameSnapshot: item.nameSnapshot,
          notes: item.notes,
          qty: item.qty,
          unitPrice: item.unitPrice,
          lineDiscountTotal: item.lineDiscountTotal,
        })),
        payments: [
          {
            method: paymentForm.method,
            amount: savedTotalDue,
            tenderedAmount: savedTenderedAmount,
            processedByUserId: user.id,
          } satisfies PaymentInput,
        ],
      };

      const result: FinalizeOrderResult = await createAndFinalizeOrder(payload);

      // Trigger receipt download immediately (non-blocking)
      // Use setTimeout to ensure UI updates first
      setTimeout(() => {
        triggerReceiptDownload(result.receipt);
      }, 0);

      // Show success modal with payment details
      const changeAmount = savedTenderedAmount - savedTotalDue;
      setSuccessOrderData({
        total: savedTotalDue,
        cashReceived: savedTenderedAmount,
        change: changeAmount,
        orderNumber: result.receipt.orderNumber,
      });
      setShowSuccessModal(true);
      setFeedbackMessage("Order placed successfully!");
    } catch (err) {
      // Restore cart on error so user can retry
      setCartItems(itemsToAdd);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to finalise the order. Please try again."
      );
      setFeedbackMessage("");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideDesktop =
        dropdownRef.current && !dropdownRef.current.contains(target);
      const isOutsideMobile =
        mobileDropdownRef.current &&
        !mobileDropdownRef.current.contains(target);

      // Close if clicking outside both dropdowns (or if one doesn't exist, check the other)
      if (
        (!dropdownRef.current || isOutsideDesktop) &&
        (!mobileDropdownRef.current || isOutsideMobile)
      ) {
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

  const totalDue = cartTotals.totalDue;
  const tenderedAmount = Number(paymentForm.tenderedAmount) || 0;
  const changeAmount = tenderedAmount > 0 ? tenderedAmount - totalDue : 0;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 overflow-x-hidden">
        <header className="border-b border-slate-200 bg-white">
          <div className="flex w-full flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
            {/* Top Row: Logo and Title */}
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-4">
                <Logo
                  href="/sales-processing"
                  size={60}
                  showText={false}
                  imageClassName="w-auto h-auto"
                  className="shrink-0"
                />
                <div>
                  <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">
                    Checkout
                  </h1>
                </div>
              </div>

              {/* Mobile: User Menu */}
              <div className="relative sm:hidden" ref={mobileDropdownRef}>
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

            {/* Second Row: Actions */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {!isCashier && (
                <>
                  <Link
                    href="/orders"
                    className="hidden rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:block sm:px-4 sm:text-sm"
                  >
                    Orders
                  </Link>
                  <Link
                    href="/dashboard"
                    className="hidden rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:block sm:px-4 sm:text-sm"
                  >
                    Dashboard
                  </Link>
                </>
              )}

              {/* Desktop: User Menu */}
              <div
                className="relative hidden items-center gap-2 sm:flex"
                ref={dropdownRef}
              >
                <div className="text-right">
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

        <main className="flex flex-col gap-4 px-3 py-4 sm:flex-row sm:min-h-[calc(100vh-80px)] sm:px-6">
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
          <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:w-[70%]">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6 sm:py-4">
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

            <div className="flex-1 overflow-y-auto p-3 sm:p-6">
              {isLoading ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-12 text-sm text-slate-500">
                  Loading products…
                </div>
              ) : products.length === 0 ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-12 text-sm text-slate-500">
                  Products will appear here once added in Product Management.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                  {products.map((product) => {
                    const stockLevel = getRemainingStock(product.id);
                    const isOutOfStock = stockLevel <= 0;
                    const inCartQty = cartItems
                      .filter((item) => item.productId === product.id)
                      .reduce((sum, item) => sum + item.qty, 0);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleAddProduct(product)}
                        disabled={isOutOfStock}
                        className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-sky-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:p-4"
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
                        {inCartQty > 0 && (
                          <div className="rounded-lg bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
                            In cart ×{inCartQty}
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
          <div className="flex w-full flex-col gap-4 sm:w-[30%]">
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 sm:px-4 sm:py-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  Current Cart
                </h2>
                <p className="text-xs text-slate-500">
                  {itemCount > 0 ? `${itemCount} item(s)` : "No items"}
                </p>
              </div>

              <div className="p-3 sm:p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                    Loading cart…
                  </div>
                ) : cartItems.length === 0 ? (
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
                    {cartItems.map((item, index) => {
                      const lineSubtotal = item.unitPrice * item.qty;
                      const lineTotal = lineSubtotal - item.lineDiscountTotal;

                      return (
                        <div
                          key={`${
                            item.productId ?? item.nameSnapshot
                          }-${index}`}
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
                                className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:h-6 sm:w-6 sm:text-xs"
                              >
                                −
                              </button>
                              <span className="min-w-8 text-center text-xs font-semibold text-slate-700">
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
                                className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:h-6 sm:w-6 sm:text-xs"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">
                              {pesoFormatter.format(lineTotal)}
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
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Totals & Payment Section */}
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="space-y-3 border-b border-slate-200 pb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-semibold text-slate-900">
                    {pesoFormatter.format(cartTotals.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Discounts</span>
                  <span className="font-semibold text-emerald-600">
                    −{pesoFormatter.format(cartTotals.discountTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-base font-semibold text-slate-900">
                    TOTAL
                  </span>
                  <span className="text-lg font-bold text-slate-900">
                    {pesoFormatter.format(cartTotals.totalDue)}
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
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 sm:py-2"
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
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 sm:py-2"
                        disabled={isProcessing || cartItems.length === 0}
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
                    !paymentForm.method ||
                    cartItems.length === 0 ||
                    totalDue <= 0 ||
                    (paymentForm.method === "CASH" && changeAmount < 0)
                  }
                  className="w-full rounded-lg bg-sky-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:py-3"
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
