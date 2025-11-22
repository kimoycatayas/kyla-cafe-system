import { apiClient, ApiError } from "./api";

/**
 * Product client for fetching and managing products
 */

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost: number;
  barcode: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch all products
 */
export async function fetchProducts(): Promise<Product[]> {
  try {
    const response = await apiClient.get<{ products: Product[] }>("/products");
    return response.products;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to fetch products. Please try again.",
      status: 0,
    } as ApiError;
  }
}

/**
 * Get product by ID
 */
export async function getProductById(id: string): Promise<Product> {
  try {
    const response = await apiClient.get<{ product: Product }>(
      `/products/${id}`
    );
    return response.product;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to fetch product. Please try again.",
      status: 0,
    } as ApiError;
  }
}

/**
 * Create a new product
 */
export interface CreateProductInput {
  name: string;
  sku: string;
  price: number | string;
  cost: number | string;
  barcode?: string | null;
}

export async function createProduct(
  input: CreateProductInput
): Promise<Product> {
  try {
    const response = await apiClient.post<{ product: Product }>(
      "/products",
      input
    );
    return response.product;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to create product. Please try again.",
      status: 0,
    } as ApiError;
  }
}

/**
 * Update an existing product
 */
export interface UpdateProductInput {
  name?: string;
  sku?: string;
  price?: number | string;
  cost?: number | string;
  barcode?: string | null;
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput
): Promise<Product> {
  try {
    const response = await apiClient.patch<{ product: Product }>(
      `/products/${id}`,
      input
    );
    return response.product;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to update product. Please try again.",
      status: 0,
    } as ApiError;
  }
}

/**
 * Delete a product
 */
export async function deleteProduct(id: string): Promise<void> {
  try {
    await apiClient.delete(`/products/${id}`);
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error as ApiError;
    }
    throw {
      message: "Failed to delete product. Please try again.",
      status: 0,
    } as ApiError;
  }
}
