import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Order, fetchOrders, OrderStatus } from "../lib/orderClient";
import { Product, fetchProducts } from "../lib/productClient";
import { ApiError } from "../lib/api";

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showProductModal, setShowProductModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedOrders = await fetchOrders();
      setAllOrders(fetchedOrders);
      setOrders(fetchedOrders);
    } catch (error) {
      const errorMessage =
        error && typeof error === "object" && "message" in error
          ? (error as ApiError).message
          : "Failed to load orders. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const fetchedProducts = await fetchProducts();
      setProducts(fetchedProducts);
    } catch (error) {
      console.error("Failed to load products:", error);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    loadProducts();
  }, [loadOrders, loadProducts]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const fetchedOrders = await fetchOrders();
      setAllOrders(fetchedOrders);
      setOrders(fetchedOrders);
    } catch (error) {
      const errorMessage =
        error && typeof error === "object" && "message" in error
          ? (error as ApiError).message
          : "Failed to refresh orders. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setRefreshing(false);
    }
  };

  // Filter orders based on selected filters
  useEffect(() => {
    let filtered = [...allOrders];

    // Filter by status
    if (filter !== "ALL") {
      filtered = filtered.filter((order) => order.status === filter);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.cashierId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by product
    if (selectedProductId) {
      filtered = filtered.filter((order) => {
        if (order.items && order.items.length > 0) {
          return order.items.some(
            (item) =>
              item.productId === selectedProductId ||
              item.nameSnapshot
                .toLowerCase()
                .includes(
                  products
                    .find((p) => p.id === selectedProductId)
                    ?.name.toLowerCase() || ""
                )
          );
        }
        return false;
      });
    }

    // Filter by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((order) => {
        const orderDate = new Date(order.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate <= toDate;
      });
    }

    setOrders(filtered);
  }, [
    allOrders,
    filter,
    searchQuery,
    selectedProductId,
    dateFrom,
    dateTo,
    products,
  ]);

  const formatCurrency = (value: number) => {
    return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case "PAID":
        return "#34C759";
      case "OPEN":
        return "#FF9500";
      case "VOID":
        return "#999";
      case "REFUNDED":
        return "#FF3B30";
      default:
        return "#999";
    }
  };

  const handleQuickDateFilter = (type: "today" | "week" | "month") => {
    const today = new Date();
    let fromDate: Date;
    let toDate: Date;

    switch (type) {
      case "today":
        fromDate = new Date(today);
        fromDate.setHours(0, 0, 0, 0);
        toDate = new Date(today);
        toDate.setHours(23, 59, 59, 999);
        break;
      case "week":
        fromDate = new Date(today);
        fromDate.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
        fromDate.setHours(0, 0, 0, 0);
        toDate = new Date(today);
        toDate.setHours(23, 59, 59, 999);
        break;
      case "month":
        fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
        fromDate.setHours(0, 0, 0, 0);
        toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        toDate.setHours(23, 59, 59, 999);
        break;
    }

    setDateFrom(fromDate.toISOString().split("T")[0]);
    setDateTo(toDate.toISOString().split("T")[0]);
  };

  const clearFilters = () => {
    setSelectedProductId("");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search orders..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Status Filter Tabs with Filter Icon */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterTabsScroll}
          contentContainerStyle={styles.filterTabsContent}
        >
          {(["ALL", "OPEN", "PAID", "VOID", "REFUNDED"] as const).map(
            (status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterTab,
                  filter === status && styles.filterTabActive,
                ]}
                onPress={() => setFilter(status)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filter === status && styles.filterTabTextActive,
                  ]}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            )
          )}
        </ScrollView>
        <TouchableOpacity
          style={[
            styles.filterIconButton,
            showFilters && styles.filterIconButtonActive,
          ]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={styles.filterIcon}>⚙️</Text>
          {(selectedProductId || dateFrom || dateTo) && (
            <View style={styles.filterBadge} />
          )}
        </TouchableOpacity>
      </View>

      {/* Advanced Filters - Collapsible */}
      {showFilters && (
        <View style={styles.advancedFiltersContainer}>
          <Text style={styles.filtersTitle}>Filters</Text>

          {/* Product Filter */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Product</Text>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowProductModal(true)}
            >
              <Text style={styles.filterButtonText}>
                {selectedProduct ? selectedProduct.name : "All Products"}
              </Text>
              <Text style={styles.filterButtonArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Date Filters */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Quick Filters</Text>
            <View style={styles.quickFiltersRow}>
              <TouchableOpacity
                style={styles.quickFilterButton}
                onPress={() => handleQuickDateFilter("today")}
              >
                <Text style={styles.quickFilterText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickFilterButton}
                onPress={() => handleQuickDateFilter("week")}
              >
                <Text style={styles.quickFilterText}>This Week</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickFilterButton}
                onPress={() => handleQuickDateFilter("month")}
              >
                <Text style={styles.quickFilterText}>This Month</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Range Filters */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Date From</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
              value={dateFrom}
              onChangeText={setDateFrom}
            />
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Date To</Text>
            <TextInput
              style={styles.dateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
              value={dateTo}
              onChangeText={setDateTo}
            />
          </View>

          {/* Clear Filters */}
          {(selectedProductId || dateFrom || dateTo || searchQuery) && (
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={clearFilters}
            >
              <Text style={styles.clearFiltersText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading orders...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No orders found</Text>
            <Text style={styles.emptyStateSubtext}>
              {allOrders.length === 0
                ? "Orders will appear here once you start processing sales"
                : "No orders match your filters"}
            </Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderNumber}>
                      Order #{order.orderNumber}
                    </Text>
                    <Text style={styles.orderDate}>
                      {formatDate(order.createdAt)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(order.status) },
                    ]}
                  >
                    <Text style={styles.statusText}>{order.status}</Text>
                  </View>
                </View>

                <Text style={styles.cashierName}>
                  Cashier: {order.cashierId.slice(0, 8)}...
                </Text>

                <View style={styles.orderItems}>
                  {order.items.slice(0, 3).map((item, index) => (
                    <View key={item.id || index} style={styles.orderItem}>
                      <Text style={styles.orderItemName} numberOfLines={1}>
                        {item.qty}x {item.nameSnapshot}
                      </Text>
                      <Text style={styles.orderItemPrice}>
                        {formatCurrency(item.lineTotal)}
                      </Text>
                    </View>
                  ))}
                  {order.items.length > 3 && (
                    <Text style={styles.moreItemsText}>
                      +{order.items.length - 3} more items
                    </Text>
                  )}
                </View>

                <View style={styles.orderFooter}>
                  <Text style={styles.totalLabel}>Total:</Text>
                  <Text style={styles.totalAmount}>
                    {formatCurrency(order.totalDue)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Product Selection Modal */}
      <Modal
        visible={showProductModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProductModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Product</Text>
              <TouchableOpacity
                onPress={() => setShowProductModal(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScrollView}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setSelectedProductId("");
                  setShowProductModal(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    !selectedProductId && styles.modalOptionTextSelected,
                  ]}
                >
                  All Products
                </Text>
              </TouchableOpacity>
              {products.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.modalOption}
                  onPress={() => {
                    setSelectedProductId(product.id);
                    setShowProductModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      selectedProductId === product.id &&
                        styles.modalOptionTextSelected,
                    ]}
                  >
                    {product.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
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
  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    gap: 12,
  },
  filterTabsScroll: {
    flex: 1,
  },
  filterTabsContent: {
    gap: 8,
    paddingRight: 8,
  },
  filterIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    position: "relative",
  },
  filterIconButtonActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  filterIcon: {
    fontSize: 18,
  },
  filterBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ff3b30",
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  filterTabActive: {
    backgroundColor: "#007AFF",
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  filterTabTextActive: {
    color: "#fff",
  },
  advancedFiltersContainer: {
    backgroundColor: "#f9f9f9",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  filterButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  filterButtonText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  filterButtonArrow: {
    fontSize: 12,
    color: "#666",
  },
  quickFiltersRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickFilterButton: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  quickFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  dateInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  clearFiltersButton: {
    backgroundColor: "#ff3b30",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 8,
  },
  clearFiltersText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  ordersList: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: "#666",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
    textTransform: "uppercase",
  },
  cashierName: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  orderItems: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  orderItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  orderItemName: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  moreItemsText: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
    marginTop: 4,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#007AFF",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 24,
    color: "#666",
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalOptionText: {
    fontSize: 16,
    color: "#333",
  },
  modalOptionTextSelected: {
    color: "#007AFF",
    fontWeight: "600",
  },
});
