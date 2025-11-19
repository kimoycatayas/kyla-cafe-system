import { apiRequest } from "./apiClient";
import { authStorage } from "./authStorage";

const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const token = authStorage.getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export type OrderStatus = "OPEN" | "PAID" | "VOID" | "REFUNDED";
export type PaymentMethod =
  | "CASH"
  | "CARD"
  | "GCASH"
  | "PAYMAYA"
  | "STATIC_QR"
  | "CONTACTLESS";

type DiscountScope = "ORDER" | "ITEM";
type DiscountTypeKind = "PERCENT" | "FIXED";

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
  discountType?: {
    id: string;
    name: string;
    type: DiscountTypeKind;
    value: number;
    scope: DiscountScope;
    requiresManagerPin: boolean;
  } | null;
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

export type OrderSummary = {
  order: Order;
  totals: CheckoutTotals;
  itemCount: number;
  paymentCount: number;
};

export type CheckoutConfig = {
  paymentMethods: Array<{
    value: PaymentMethod;
    label: string;
  }>;
  discountTypes: Array<{
    id: string;
    name: string;
    type: DiscountTypeKind;
    value: number;
    scope: DiscountScope;
    requiresManagerPin: boolean;
  }>;
};

export type CreateOrderPayload = {
  cashierId: string;
  orderNumber?: string;
  status?: OrderStatus;
};

export type AddOrderItemPayload = {
  productId?: string | null;
  nameSnapshot: string;
  notes?: string | null;
  qty: number;
  unitPrice: number;
  lineDiscountTotal?: number;
};

export type UpdateOrderItemPayload = Partial<{
  productId: string | null;
  nameSnapshot: string;
  notes: string | null;
  qty: number;
  unitPrice: number;
  lineDiscountTotal: number;
}>;

export type PaymentInput = {
  method: PaymentMethod;
  amount: number;
  tenderedAmount?: number | null;
  changeGiven?: number | null;
  externalReference?: string | null;
  processedByUserId: string;
};

export type FinalizeOrderPayload = {
  payments: PaymentInput[];
};

export type CreateAndFinalizeOrderPayload = {
  cashierId: string;
  items: AddOrderItemPayload[];
  payments: PaymentInput[];
};

export type RefundPaymentInput = {
  method: PaymentMethod;
  amount: number;
  externalReference?: string | null;
  processedByUserId: string;
};

export type RefundOrderPayload = {
  payments: RefundPaymentInput[];
  restock?: boolean;
};

export const fetchCheckoutConfig = async (): Promise<CheckoutConfig> => {
  const response = await apiRequest<{ config: CheckoutConfig }>(
    "/orders/config",
    {
      headers: authHeaders(),
    }
  );
  return response.config;
};

export const fetchOrders = async (): Promise<Order[]> => {
  const response = await apiRequest<{ orders: Order[] }>("/orders", {
    headers: authHeaders(),
  });
  return response.orders;
};

export const createOrder = async (
  payload: CreateOrderPayload
): Promise<Order> => {
  const response = await apiRequest<{ order: Order }>("/orders", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return response.order;
};

export const getOrder = async (orderId: string): Promise<Order> => {
  const response = await apiRequest<{ order: Order }>(`/orders/${orderId}`, {
    headers: authHeaders(),
  });
  return response.order;
};

export const getOrderSummary = async (
  orderId: string
): Promise<OrderSummary> => {
  const response = await apiRequest<{ summary: OrderSummary }>(
    `/orders/${orderId}/summary`,
    {
      headers: authHeaders(),
    }
  );
  return response.summary;
};

export const getOrderReceipt = async (orderId: string) => {
  const response = await apiRequest<{ receipt: OrderReceipt }>(
    `/orders/${orderId}/receipt`,
    {
      headers: authHeaders(),
    }
  );
  return response.receipt;
};

export const addOrderItem = async (
  orderId: string,
  payload: AddOrderItemPayload
): Promise<Order> => {
  const response = await apiRequest<{ order: Order }>(
    `/orders/${orderId}/items`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );
  return response.order;
};

export const updateOrderItem = async (
  orderId: string,
  itemId: string,
  payload: UpdateOrderItemPayload
): Promise<Order> => {
  const response = await apiRequest<{ order: Order }>(
    `/orders/${orderId}/items/${itemId}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );
  return response.order;
};

export const removeOrderItem = async (
  orderId: string,
  itemId: string
): Promise<Order> => {
  const response = await apiRequest<{ order: Order }>(
    `/orders/${orderId}/items/${itemId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );
  return response.order;
};

export type FinalizeOrderResult = {
  order: Order;
  receipt: OrderReceipt;
};

export const finalizeOrder = async (
  orderId: string,
  payload: FinalizeOrderPayload
): Promise<FinalizeOrderResult> => {
  const response = await apiRequest<FinalizeOrderResult>(
    `/orders/${orderId}/finalize`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );
  return response;
};

export const voidOrder = async (orderId: string): Promise<Order> => {
  const response = await apiRequest<{ order: Order }>(
    `/orders/${orderId}/void`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );
  return response.order;
};

export const refundOrder = async (
  orderId: string,
  payload: RefundOrderPayload
): Promise<Order> => {
  const response = await apiRequest<{ order: Order }>(
    `/orders/${orderId}/refund`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );
  return response.order;
};

export const deleteOrder = async (orderId: string): Promise<void> => {
  await apiRequest(`/orders/${orderId}`, {
    method: "DELETE",
    headers: authHeaders(),
    parseJson: false,
  });
};

export const createAndFinalizeOrder = async (
  payload: CreateAndFinalizeOrderPayload
): Promise<FinalizeOrderResult> => {
  const response = await apiRequest<FinalizeOrderResult>(
    "/orders/create-and-finalize",
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );
  return response;
};
