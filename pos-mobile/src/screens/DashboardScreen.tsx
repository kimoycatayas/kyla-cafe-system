import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MainTabParamList } from "../types/navigation";
import { RootStackParamList } from "../types/navigation";
import {
  DashboardMetrics,
  fetchDashboardMetrics,
} from "../lib/dashboardClient";
import { ApiError } from "../lib/api";
import type { OrderStatus } from "../lib/orderClient";

type DashboardScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Dashboard">,
  NativeStackNavigationProp<RootStackParamList>
>;

export default function DashboardScreen() {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedMetrics = await fetchDashboardMetrics();
      setMetrics(fetchedMetrics);
    } catch (error) {
      const errorMessage =
        error && typeof error === "object" && "message" in error
          ? (error as ApiError).message
          : "Failed to load dashboard metrics. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const fetchedMetrics = await fetchDashboardMetrics();
      setMetrics(fetchedMetrics);
    } catch (error) {
      const errorMessage =
        error && typeof error === "object" && "message" in error
          ? (error as ApiError).message
          : "Failed to refresh dashboard. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSettingsPress = () => {
    navigation.navigate("UserSettings");
  };

  const formatCurrency = (value: number) => {
    return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-PH", {
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

  const salesSummary = metrics?.salesSummary || {
    totalSalesToday: 0,
    ordersToday: 0,
    averageOrderValueToday: 0,
    openOrders: 0,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={handleSettingsPress}
        >
          <Text style={styles.settingsButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading dashboard...</Text>
            </View>
          ) : (
            <>
              {/* Sales Summary Cards */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Today's Sales</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(salesSummary.totalSalesToday)}
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Orders Today</Text>
                  <Text style={styles.statValue}>
                    {salesSummary.ordersToday}
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Avg Order Value</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(salesSummary.averageOrderValueToday)}
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Open Orders</Text>
                  <Text style={styles.statValue}>
                    {salesSummary.openOrders}
                  </Text>
                </View>
              </View>

              {/* Top Products Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Products</Text>
                {metrics?.topProducts && metrics.topProducts.length > 0 ? (
                  <View style={styles.listContainer}>
                    {metrics.topProducts.map((product, index) => (
                      <View key={index} style={styles.listItem}>
                        <View style={styles.listItemContent}>
                          <Text style={styles.listItemName}>
                            {index + 1}. {product.name}
                          </Text>
                          <Text style={styles.listItemSubtext}>
                            Qty: {product.quantity} •{" "}
                            {formatCurrency(product.sales)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      Top selling products will appear here
                    </Text>
                  </View>
                )}
              </View>

              {/* Low Stock Items Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Low Stock Alerts</Text>
                {metrics?.lowStockItems && metrics.lowStockItems.length > 0 ? (
                  <View style={styles.listContainer}>
                    {metrics.lowStockItems.map((item) => (
                      <View
                        key={item.productId}
                        style={[styles.listItem, styles.lowStockItem]}
                      >
                        <View style={styles.listItemContent}>
                          <Text style={styles.listItemName}>{item.name}</Text>
                          <Text style={styles.listItemSubtext}>
                            Stock: {item.quantity} / Threshold: {item.threshold}
                          </Text>
                        </View>
                        <View style={styles.lowStockBadge}>
                          <Text style={styles.lowStockBadgeText}>Low</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      Low stock items will appear here
                    </Text>
                  </View>
                )}
              </View>

              {/* Recent Orders Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Orders</Text>
                {metrics?.recentOrders && metrics.recentOrders.length > 0 ? (
                  <View style={styles.listContainer}>
                    {metrics.recentOrders.map((order) => (
                      <View key={order.id} style={styles.listItem}>
                        <View style={styles.listItemContent}>
                          <View
                            style={styles.orderHeader}
                          >
                            <Text style={styles.listItemName}>
                              {order.orderNumber}
                            </Text>
                            <View
                              style={[
                                styles.statusBadge,
                                { backgroundColor: getStatusColor(order.status) },
                              ]}
                            >
                              <Text style={styles.statusText}>
                                {order.status}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.listItemSubtext}>
                            {formatCurrency(order.amount)} •{" "}
                            {formatDate(order.createdAt)}
                            {order.cashierName &&
                              ` • ${order.cashierName}`}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      Recent orders will appear here
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  settingsButtonText: {
    fontSize: 20,
  },
  content: {
    padding: 16,
    paddingTop: 8,
  },
  loadingContainer: {
    padding: 48,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    width: "47%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  listContainer: {
    gap: 8,
  },
  listItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  lowStockItem: {
    borderLeftWidth: 4,
    borderLeftColor: "#FF3B30",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listItemContent: {
    flex: 1,
  },
  listItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  listItemSubtext: {
    fontSize: 12,
    color: "#666",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
    textTransform: "uppercase",
  },
  lowStockBadge: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lowStockBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
    textTransform: "uppercase",
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
});
