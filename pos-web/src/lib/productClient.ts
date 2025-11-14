import { apiRequest } from "./apiClient";
import { authStorage } from "./authStorage";

export type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost: number;
  barcode: string | null;
  createdAt: string;
  updatedAt: string;
};

const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const token = authStorage.getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export const fetchProducts = async (): Promise<Product[]> => {
  const response = await apiRequest<{ products: Product[] }>("/products", {
    headers: authHeaders(),
  });
  return response.products;
};

export const createProduct = async (
  payload: Omit<Product, "id" | "createdAt" | "updatedAt">,
): Promise<Product> => {
  const response = await apiRequest<{ product: Product }>("/products", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return response.product;
};

export const updateProduct = async (
  id: string,
  payload: Partial<Omit<Product, "id" | "createdAt" | "updatedAt">>,
): Promise<Product> => {
  const response = await apiRequest<{ product: Product }>(`/products/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return response.product;
};

export const deleteProduct = async (id: string): Promise<void> => {
  await apiRequest(`/products/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
    parseJson: false,
  });
};

