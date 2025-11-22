import { apiClient, ApiError } from "./api";

/**
 * Order client for fetching and managing orders
 */

export type OrderStatus = "OPEN" | "PAID" | "VOID" | "REFUNDED";
export type PaymentMethod =
  | "CASH"
  | "CARD"
  | "GCASH"
  | "PAYMAYA"
  | "STATIC_QR"
  | "CONTACTLESS";

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  nameSnapshot: string;
  notes: string | null;
  qty: number;
  unitPrice: number;
  lineSubtotal: number;
  lineDiscountTotal: number;
  lineTotal: number;
};

export type OrderDiscount = {
  id: string;
  orderId: string;
  discountTypeId: string;
  amount: number;
  appliedByUserId: string;
  approvedByManagerId: string | null;
  createdAt: string;
};

export type OrderPayment = {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  tenderedAmount: number | null;
  changeGiven: number | null;
  externalReference: string | null;
  processedByUserId: string;
  createdAt: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  cashierId: string;
  status: OrderStatus;
  subtotal: number;
  discountTotal: number;
  totalDue: number;
  totalPaid: number;
  changeDue: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  discounts: OrderDiscount[];
  payments: OrderPayment[];
};

export type CheckoutTotals = {
  subtotal: number;
  discountTotal: number;
  totalDue: number;
  totalPaid: number;
  changeDue: number;
  balanceDue: number;
};

export type ReceiptPrintable = {
  content: string;
  filename: string;
  mimeType: string;
};

export type OrderReceipt = {
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  cashierId: string;
  cashierName: string;
  items: OrderItem[];
  discounts: OrderDiscount[];
  payments: OrderPayment[];
  totals: CheckoutTotals;
  printable: ReceiptPrintable;
};

export type AddOrderItemPayload = {
  productId?: string | null;
  nameSnapshot: string;
  notes?: string | null;
  qty: number;
  unitPrice: number;
  lineDiscountTotal?: number;
};

export type PaymentInput = {
  method: PaymentMethod;
  amount: number;
  tenderedAmount?: number | null;
  changeGiven?: number | null;
  externalReference?: string | null;
  processedByUserId: string;
};

export type CreateAndFinalizeOrderPayload = {
  cashierId: string;
  items: AddOrderItemPayload[];
  payments: PaymentInput[];
};

export type FinalizeOrderResult = {
  order: Order;
  receipt: OrderReceipt;
};

/**
 * Fetch all orders
 */
export async function fetchOrders(): Promise<Order[]> {
  try {
    const response = await apiClient.get<{ orders: Order[] }>("/orders");
    return response.orders;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to fetch orders. Please try again.",
      status: 0,
    } as ApiError;
  }
}

/**
 * Get order by ID
 */
export async function getOrderById(id: string): Promise<Order> {
  try {
    const response = await apiClient.get<{ order: Order }>(`/orders/${id}`);
    return response.order;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to fetch order. Please try again.",
      status: 0,
    } as ApiError;
  }
}

/**
 * Create and finalize an order in one step
 */
export async function createAndFinalizeOrder(
  payload: CreateAndFinalizeOrderPayload
): Promise<FinalizeOrderResult> {
  try {
    const response = await apiClient.post<FinalizeOrderResult>(
      "/orders/create-and-finalize",
      payload
    );
    return response;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to create and finalize order. Please try again.",
      status: 0,
    } as ApiError;
  }
}
