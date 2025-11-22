import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ModalBaseProps,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { fetchProducts, type Product } from "../lib/productClient";
import { fetchInventory, type InventoryItem } from "../lib/inventoryClient";
import { createAndFinalizeOrder, type PaymentMethod } from "../lib/orderClient";
import { storage } from "../lib/storage";
import type { User } from "../lib/authClient";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  productId: string;
}

interface ProductWithStock extends Product {
  stockQuantity: number;
  inventoryId?: string;
  isLowStock: boolean;
}

export default function SalesScreen() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerCash, setCustomerCash] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{
    total: number;
    cashReceived: number;
    change: number;
    orderNumber: string;
  } | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    loadProducts();
    loadCurrentUser();
  }, []);

  // Auto-fill customer cash with total when cart changes
  useEffect(() => {
    const total = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    if (total > 0 && !customerCash) {
      setCustomerCash(total.toFixed(2));
    }
  }, [cart, customerCash]);

  const loadCurrentUser = async () => {
    const user = await storage.getUser();
    setCurrentUser(user);
  };

  const loadProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [productsData, inventoryData] = await Promise.all([
        fetchProducts(),
        fetchInventory(),
      ]);

      // Create a map of productId -> inventory
      const inventoryMap = new Map<string, InventoryItem>();
      inventoryData.forEach((item) => {
        inventoryMap.set(item.product.id, item);
      });

      // Combine products with inventory data
      const productsWithStock: ProductWithStock[] = productsData.map(
        (product) => {
          const inventory = inventoryMap.get(product.id);
          return {
            ...product,
            stockQuantity: inventory?.quantity ?? 0,
            inventoryId: inventory?.id,
            isLowStock: inventory?.status === "low" ?? false,
          };
        }
      );

      // Filter to only show products with inventory > 0
      const availableProducts = productsWithStock.filter(
        (p) => p.stockQuantity > 0
      );
      setProducts(availableProducts);
    } catch (err) {
      const errorMessage =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Failed to load products. Please try again.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleAddToCart = (product: ProductWithStock) => {
    // Check if product has stock
    if (product.stockQuantity <= 0) {
      Alert.alert("Out of Stock", `${product.name} is currently out of stock.`);
      return;
    }

    const existingItem = cart.find((item) => item.productId === product.id);
    if (existingItem) {
      // Check if adding one more would exceed stock
      if (existingItem.quantity >= product.stockQuantity) {
        Alert.alert(
          "Insufficient Stock",
          `Only ${product.stockQuantity} ${product.name} available in stock.`
        );
        return;
      }
      setCart(
        cart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          productId: product.id,
        },
      ]);
    }
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(productId);
      return;
    }

    // Find the product to check stock
    const product = products.find((p) => p.id === productId);
    if (product && quantity > product.stockQuantity) {
      Alert.alert(
        "Insufficient Stock",
        `Only ${product.stockQuantity} ${product.name} available in stock.`
      );
      return;
    }

    setCart(
      cart.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  };

  const getAvailableStock = (productId: string): number => {
    const product = products.find((p) => p.id === productId);
    if (!product) return 0;

    const cartItem = cart.find((item) => item.productId === productId);
    const inCart = cartItem ? cartItem.quantity : 0;
    return product.stockQuantity - inCart;
  };

  const calculateChange = () => {
    const total = calculateTotal();
    const cash = parseFloat(customerCash) || 0;
    return Math.max(0, cash - total);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert("Empty Cart", "Please add items to cart before checkout");
      return;
    }

    if (!currentUser) {
      Alert.alert(
        "Error",
        "User information not available. Please login again."
      );
      return;
    }

    const total = calculateTotal();
    const cash = parseFloat(customerCash) || 0;

    if (!customerCash.trim()) {
      Alert.alert("Error", "Please enter customer cash amount");
      return;
    }

    if (cash < total) {
      Alert.alert(
        "Insufficient Payment",
        `Customer cash (${formatCurrency(
          cash
        )}) is less than total (${formatCurrency(total)}).`
      );
      return;
    }

    setIsProcessing(true);

    try {
      const payload = {
        cashierId: currentUser.id,
        items: cart.map((item) => ({
          productId: item.productId,
          nameSnapshot: item.name,
          notes: null,
          qty: item.quantity,
          unitPrice: item.price,
          lineDiscountTotal: 0,
        })),
        payments: [
          {
            method: "CASH" as PaymentMethod,
            amount: total,
            tenderedAmount: cash,
            changeGiven: calculateChange(),
            processedByUserId: currentUser.id,
          },
        ],
      };

      const result = await createAndFinalizeOrder(payload);

      // Show success modal
      setSuccessData({
        total,
        cashReceived: cash,
        change: calculateChange(),
        orderNumber: result.receipt.orderNumber,
      });
      setShowSuccessModal(true);

      // Clear cart and customer cash
      setCart([]);
      setCustomerCash("");

      // Reload products to update stock
      await loadProducts();
    } catch (err) {
      const errorMessage =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "Failed to process order. Please try again.";
      Alert.alert("Checkout Failed", errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.content}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search products..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <View style={styles.mainContent}>
              {/* Products List */}
              <View style={styles.productsSection}>
                <Text style={styles.sectionTitle}>Products</Text>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Loading products...</Text>
                  </View>
                ) : error ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={loadProducts}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : filteredProducts.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No products found</Text>
                    <Text style={styles.emptyStateSubtext}>
                      {searchQuery
                        ? "Try a different search term"
                        : "No products with inventory available"}
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.productsList}
                    keyboardShouldPersistTaps="handled"
                    onScrollBeginDrag={Keyboard.dismiss}
                  >
                    {filteredProducts.map((product) => {
                      const availableStock = getAvailableStock(product.id);
                      const isOutOfStock = availableStock <= 0;
                      return (
                        <TouchableOpacity
                          key={product.id}
                          style={[
                            styles.productCard,
                            isOutOfStock && styles.productCardDisabled,
                          ]}
                          onPress={() =>
                            !isOutOfStock && handleAddToCart(product)
                          }
                          disabled={isOutOfStock}
                        >
                          <View style={styles.productInfo}>
                            <Text style={styles.productName}>
                              {product.name}
                            </Text>
                            <View style={styles.productDetails}>
                              <Text style={styles.productPrice}>
                                {formatCurrency(product.price)}
                              </Text>
                              <View style={styles.stockInfo}>
                                <Text
                                  style={[
                                    styles.stockText,
                                    product.isLowStock && styles.stockTextLow,
                                    isOutOfStock && styles.stockTextOut,
                                  ]}
                                >
                                  Stock: {availableStock}
                                </Text>
                                {product.isLowStock && !isOutOfStock && (
                                  <Text style={styles.lowStockBadge}>Low</Text>
                                )}
                              </View>
                            </View>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.addButton,
                              isOutOfStock && styles.addButtonDisabled,
                            ]}
                            onPress={() =>
                              !isOutOfStock && handleAddToCart(product)
                            }
                            disabled={isOutOfStock}
                          >
                            <Text style={styles.addButtonText}>+</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              {/* Cart Section */}
              <View style={styles.cartSection}>
                <Text style={styles.sectionTitle}>Cart</Text>
                <ScrollView
                  style={styles.cartList}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}
                  onScrollBeginDrag={Keyboard.dismiss}
                >
                  {cart.length === 0 ? (
                    <View style={styles.emptyCart}>
                      <Text style={styles.emptyCartText}>Cart is empty</Text>
                    </View>
                  ) : (
                    cart.map((item) => {
                      const availableStock = getAvailableStock(item.productId);
                      return (
                        <View key={item.id} style={styles.cartItem}>
                          <View style={styles.cartItemInfo}>
                            <Text style={styles.cartItemName}>{item.name}</Text>
                            <Text style={styles.cartItemPrice}>
                              {formatCurrency(item.price)}
                            </Text>
                          </View>
                          <View style={styles.quantityControls}>
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() =>
                                handleUpdateQuantity(
                                  item.productId,
                                  item.quantity - 1
                                )
                              }
                            >
                              <Text style={styles.quantityButtonText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.quantityText}>
                              {item.quantity}
                            </Text>
                            <TouchableOpacity
                              style={[
                                styles.quantityButton,
                                availableStock <= 0 &&
                                  styles.quantityButtonDisabled,
                              ]}
                              onPress={() =>
                                availableStock > 0 &&
                                handleUpdateQuantity(
                                  item.productId,
                                  item.quantity + 1
                                )
                              }
                              disabled={availableStock <= 0}
                            >
                              <Text style={styles.quantityButtonText}>+</Text>
                            </TouchableOpacity>
                          </View>
                          <View>
                            <Text style={styles.cartItemTotal}>
                              {formatCurrency(item.price * item.quantity)}
                            </Text>
                            {availableStock <= 0 && (
                              <Text style={styles.maxStockReached}>
                                Max stock
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
                <View style={styles.cartFooter}>
                  <View style={styles.totalContainer}>
                    <Text style={styles.totalLabel}>Total:</Text>
                    <Text style={styles.totalAmount}>
                      {formatCurrency(calculateTotal())}
                    </Text>
                  </View>

                  {/* Customer Cash Input */}
                  <View style={styles.cashInputContainer}>
                    <Text style={styles.cashLabel}>Customer Cash:</Text>
                    <TextInput
                      style={styles.cashInput}
                      placeholder="0.00"
                      placeholderTextColor="#999"
                      value={customerCash}
                      onChangeText={(text) => {
                        // Only allow numbers and decimal point
                        const cleaned = text.replace(/[^0-9.]/g, "");
                        // Prevent multiple decimal points
                        const parts = cleaned.split(".");
                        if (parts.length > 2) {
                          return;
                        }
                        setCustomerCash(cleaned);
                      }}
                      keyboardType="decimal-pad"
                      editable={!isProcessing && cart.length > 0}
                    />
                  </View>

                  {/* Change Display */}
                  {customerCash && parseFloat(customerCash) > 0 && (
                    <View style={styles.changeContainer}>
                      <Text style={styles.changeLabel}>Change:</Text>
                      <Text style={styles.changeAmount}>
                        {formatCurrency(calculateChange())}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.checkoutButton,
                      (cart.length === 0 ||
                        isProcessing ||
                        !customerCash.trim()) &&
                        styles.checkoutButtonDisabled,
                    ]}
                    onPress={handleCheckout}
                    disabled={
                      cart.length === 0 || isProcessing || !customerCash.trim()
                    }
                  >
                    <Text style={styles.checkoutButtonText}>
                      {isProcessing ? "Processing..." : "Checkout"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>

        {/* Success Modal */}
        <Modal
          visible={showSuccessModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowSuccessModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.successIcon}>
                <Text style={styles.successIconText}>✓</Text>
              </View>
              <Text style={styles.modalTitle}>Order Successful!</Text>
              {successData && (
                <>
                  <Text style={styles.orderNumber}>
                    Order #{successData.orderNumber}
                  </Text>
                  <View style={styles.modalDetails}>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Total:</Text>
                      <Text style={styles.modalDetailValue}>
                        {formatCurrency(successData.total)}
                      </Text>
                    </View>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>
                        Customer Cash:
                      </Text>
                      <Text style={styles.modalDetailValue}>
                        {formatCurrency(successData.cashReceived)}
                      </Text>
                    </View>
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Change:</Text>
                      <Text
                        style={[styles.modalDetailValue, styles.changeValue]}
                      >
                        {formatCurrency(successData.change)}
                      </Text>
                    </View>
                  </View>
                </>
              )}
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowSuccessModal(false);
                  setSuccessData(null);
                }}
              >
                <Text style={styles.modalButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  searchInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
  },
  mainContent: {
    flex: 1,
  },
  productsSection: {
    flex: 1,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  productsList: {
    flex: 1,
  },
  productCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  cartSection: {
    flex: 1,
    maxHeight: 400,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  cartList: {
    flex: 1,
  },
  cartFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    backgroundColor: "#f9f9f9",
  },
  emptyCart: {
    padding: 24,
    alignItems: "center",
  },
  emptyCartText: {
    fontSize: 14,
    color: "#999",
  },
  cartItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  cartItemInfo: {
    marginBottom: 8,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 14,
    color: "#666",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  quantityText: {
    marginHorizontal: 16,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    minWidth: 30,
    textAlign: "center",
  },
  cartItemTotal: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#007AFF",
  },
  totalContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#007AFF",
  },
  checkoutButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  checkoutButtonDisabled: {
    backgroundColor: "#ccc",
  },
  checkoutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cashInputContainer: {
    marginBottom: 12,
  },
  cashLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  cashInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#333",
  },
  changeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#f0f8ff",
    borderRadius: 8,
  },
  changeLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  changeAmount: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#007AFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successIconText: {
    fontSize: 48,
    color: "#fff",
    fontWeight: "bold",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
  modalDetails: {
    width: "100%",
    marginBottom: 24,
  },
  modalDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalDetailLabel: {
    fontSize: 16,
    color: "#666",
  },
  modalDetailValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  changeValue: {
    color: "#007AFF",
    fontSize: 20,
  },
  modalButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 16,
    width: "100%",
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
  },
  errorText: {
    fontSize: 14,
    color: "#FF3B30",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  productCardDisabled: {
    opacity: 0.5,
  },
  productDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stockInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stockText: {
    fontSize: 12,
    color: "#666",
  },
  stockTextLow: {
    color: "#FF9500",
    fontWeight: "600",
  },
  stockTextOut: {
    color: "#FF3B30",
    fontWeight: "600",
  },
  lowStockBadge: {
    fontSize: 10,
    color: "#FF9500",
    backgroundColor: "#FFF4E6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: "600",
  },
  quantityButtonDisabled: {
    opacity: 0.5,
  },
  maxStockReached: {
    fontSize: 10,
    color: "#FF3B30",
    marginTop: 4,
  },
});
