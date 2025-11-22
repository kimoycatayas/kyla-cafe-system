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
import {
  InventoryItem,
  fetchInventory,
  createInventory,
  updateInventory,
  deleteInventory,
} from "../lib/inventoryClient";
import { Product, fetchProducts } from "../lib/productClient";
import { ApiError } from "../lib/api";

export default function InventoryScreen() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formData, setFormData] = useState({
    productId: "",
    quantity: "",
    threshold: "",
  });
  const [originalFormData, setOriginalFormData] = useState({
    quantity: "",
    threshold: "",
  });

  const loadInventory = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedInventory = await fetchInventory();
      setInventory(fetchedInventory);
    } catch (error) {
      const errorMessage =
        error && typeof error === "object" && "message" in error
          ? (error as ApiError).message
          : "Failed to load inventory. Please try again.";
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
    loadInventory();
    loadProducts();
  }, [loadInventory, loadProducts]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const fetchedInventory = await fetchInventory();
      setInventory(fetchedInventory);
    } catch (error) {
      const errorMessage =
        error && typeof error === "object" && "message" in error
          ? (error as ApiError).message
          : "Failed to refresh inventory. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddInventory = () => {
    setEditingItem(null);
    setFormData({ productId: "", quantity: "", threshold: "" });
    setOriginalFormData({ quantity: "", threshold: "" });
    setIsModalVisible(true);
  };

  const handleEditInventory = (item: InventoryItem) => {
    setEditingItem(item);
    const initialQuantity = item.quantity.toString();
    const initialThreshold = item.lowStockThreshold.toString();
    setFormData({
      productId: item.product.id,
      quantity: initialQuantity,
      threshold: initialThreshold,
    });
    setOriginalFormData({
      quantity: initialQuantity,
      threshold: initialThreshold,
    });
    setIsModalVisible(true);
  };

  const handleCancelEdit = () => {
    if (editingItem) {
      setFormData({
        productId: editingItem.product.id,
        quantity: originalFormData.quantity,
        threshold: originalFormData.threshold,
      });
    }
    setIsModalVisible(false);
  };

  const handleSaveInventory = async () => {
    if (!formData.quantity || !formData.threshold) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    if (!editingItem && !formData.productId) {
      Alert.alert("Error", "Please select a product");
      return;
    }

    const quantity = parseInt(formData.quantity, 10);
    const threshold = parseInt(formData.threshold, 10);

    if (isNaN(quantity) || quantity < 0) {
      Alert.alert("Error", "Please enter a valid quantity");
      return;
    }

    if (isNaN(threshold) || threshold < 0) {
      Alert.alert("Error", "Please enter a valid threshold");
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingItem) {
        // Update existing inventory
        const updatedItem = await updateInventory(editingItem.id, {
          quantity,
          lowStockThreshold: threshold,
        });
        setInventory(
          inventory.map((item) =>
            item.id === editingItem.id ? updatedItem : item
          )
        );
      } else {
        // Create new inventory
        const newItem = await createInventory({
          productId: formData.productId,
          quantity,
          lowStockThreshold: threshold,
        });
        setInventory([newItem, ...inventory]);
      }

      setIsModalVisible(false);
      setFormData({ productId: "", quantity: "", threshold: "" });
      setOriginalFormData({ quantity: "", threshold: "" });
    } catch (error) {
      const errorMessage =
        error && typeof error === "object" && "message" in error
          ? (error as ApiError).message
          : "Failed to save inventory. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustQuantity = (adjustment: number) => {
    const currentQuantity = parseInt(formData.quantity, 10) || 0;
    const newQuantity = Math.max(0, currentQuantity + adjustment);
    setFormData({ ...formData, quantity: newQuantity.toString() });
  };

  const handleAdjustThreshold = (adjustment: number) => {
    const currentThreshold = parseInt(formData.threshold, 10) || 0;
    const newThreshold = Math.max(0, currentThreshold + adjustment);
    setFormData({ ...formData, threshold: newThreshold.toString() });
  };

  const handleDeleteInventory = (item: InventoryItem) => {
    Alert.alert(
      "Delete Inventory",
      `Are you sure you want to delete inventory for ${item.product.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteInventory(item.id);
              setInventory(inventory.filter((inv) => inv.id !== item.id));
            } catch (error) {
              const errorMessage =
                error && typeof error === "object" && "message" in error
                  ? (error as ApiError).message
                  : "Failed to delete inventory. Please try again.";
              Alert.alert("Error", errorMessage);
            }
          },
        },
      ]
    );
  };

  const isLowStock = (item: InventoryItem) => item.status === "low";

  const filteredInventory = inventory.filter((item) =>
    item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockItems = filteredInventory.filter(isLowStock);
  const normalStockItems = filteredInventory.filter((item) => !isLowStock(item));

  const selectedProduct = products.find((p) => p.id === formData.productId);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search inventory..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddInventory}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading inventory...</Text>
          </View>
        ) : (
          <>
            {/* Low Stock Alert Section */}
            {lowStockItems.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>⚠️ Low Stock Alerts</Text>
                  <View style={styles.alertBadge}>
                    <Text style={styles.alertBadgeText}>
                      {lowStockItems.length}
                    </Text>
                  </View>
                </View>
                {lowStockItems.map((item) => (
                  <InventoryCard
                    key={item.id}
                    item={item}
                    isLowStock={true}
                    onEdit={() => handleEditInventory(item)}
                    onDelete={() => handleDeleteInventory(item)}
                  />
                ))}
              </View>
            )}

            {/* Normal Stock Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Items</Text>
              {normalStockItems.length === 0 && lowStockItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    No inventory items found
                  </Text>
                  <Text style={styles.emptyStateSubtext}>
                    Tap "+ Add" to add inventory items
                  </Text>
                </View>
              ) : (
                normalStockItems.map((item) => (
                  <InventoryCard
                    key={item.id}
                    item={item}
                    isLowStock={false}
                    onEdit={() => handleEditInventory(item)}
                    onDelete={() => handleDeleteInventory(item)}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Add/Edit Inventory Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => !isSubmitting && setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingItem ? "Edit Inventory" : "Add Inventory Item"}
            </Text>

            {editingItem ? (
              <View style={styles.modalInfo}>
                <Text style={styles.modalInfoLabel}>Product:</Text>
                <Text style={styles.modalInfoText}>
                  {editingItem.product.name}
                </Text>
              </View>
            ) : (
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Product *</Text>
                <TouchableOpacity
                  style={styles.filterButton}
                  onPress={() => setShowProductModal(true)}
                  disabled={isSubmitting}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      !selectedProduct && styles.filterButtonTextPlaceholder,
                    ]}
                  >
                    {selectedProduct ? selectedProduct.name : "Select Product"}
                  </Text>
                  <Text style={styles.filterButtonArrow}>▼</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.quantityContainer}>
              <Text style={styles.quantityLabel}>Quantity *</Text>
              <View style={styles.quantityInputRow}>
                <TouchableOpacity
                  style={styles.quantityAdjustButton}
                  onPress={() => handleAdjustQuantity(-1)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.quantityAdjustButtonText}>-</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.quantityInput}
                  placeholder="Quantity"
                  placeholderTextColor="#999"
                  value={formData.quantity}
                  onChangeText={(text) =>
                    setFormData({ ...formData, quantity: text })
                  }
                  keyboardType="number-pad"
                  editable={!isSubmitting}
                />
                <TouchableOpacity
                  style={styles.quantityAdjustButton}
                  onPress={() => handleAdjustQuantity(1)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.quantityAdjustButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.thresholdContainer}>
              <Text style={styles.thresholdLabel}>Low Stock Threshold *</Text>
              <View style={styles.quantityInputRow}>
                <TouchableOpacity
                  style={styles.quantityAdjustButton}
                  onPress={() => handleAdjustThreshold(-1)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.quantityAdjustButtonText}>-</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.quantityInput}
                  placeholder="Threshold"
                  placeholderTextColor="#999"
                  value={formData.threshold}
                  onChangeText={(text) =>
                    setFormData({ ...formData, threshold: text })
                  }
                  keyboardType="number-pad"
                  editable={!isSubmitting}
                />
                <TouchableOpacity
                  style={styles.quantityAdjustButton}
                  onPress={() => handleAdjustThreshold(1)}
                  disabled={isSubmitting}
                >
                  <Text style={styles.quantityAdjustButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  isSubmitting && styles.disabledButton,
                ]}
                onPress={editingItem ? handleCancelEdit : () => setIsModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  isSubmitting && styles.disabledButton,
                ]}
                onPress={handleSaveInventory}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              {products
                .filter(
                  (product) =>
                    !inventory.some((inv) => inv.product.id === product.id)
                )
                .map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.modalOption}
                    onPress={() => {
                      setFormData({ ...formData, productId: product.id });
                      setShowProductModal(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        formData.productId === product.id &&
                          styles.modalOptionTextSelected,
                      ]}
                    >
                      {product.name} ({product.sku})
                    </Text>
                  </TouchableOpacity>
                ))}
              {products.filter(
                (product) =>
                  !inventory.some((inv) => inv.product.id === product.id)
              ).length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    All products have inventory
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

interface InventoryCardProps {
  item: InventoryItem;
  isLowStock: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function InventoryCard({
  item,
  isLowStock,
  onEdit,
  onDelete,
}: InventoryCardProps) {
  return (
    <View
      style={[
        styles.inventoryCard,
        isLowStock && styles.inventoryCardLowStock,
      ]}
    >
      <View style={styles.inventoryInfo}>
        <Text style={styles.inventoryName}>{item.product.name}</Text>
        <Text style={styles.inventorySku}>SKU: {item.product.sku}</Text>
        <View style={styles.quantityRow}>
          <Text style={styles.quantityLabel}>Quantity:</Text>
          <Text
            style={[
              styles.quantityValue,
              isLowStock && styles.quantityValueLowStock,
            ]}
          >
            {item.quantity} units
          </Text>
        </View>
        <Text style={styles.thresholdText}>
          Threshold: {item.lowStockThreshold} units
        </Text>
      </View>
      <View style={styles.inventoryActions}>
        <TouchableOpacity style={styles.editButton} onPress={onEdit}>
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    gap: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
  },
  addButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
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
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  alertBadge: {
    backgroundColor: "#FF3B30",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  alertBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  inventoryCard: {
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
  inventoryCardLowStock: {
    borderLeftWidth: 4,
    borderLeftColor: "#FF3B30",
  },
  inventoryInfo: {
    marginBottom: 12,
  },
  inventoryName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  inventorySku: {
    fontSize: 12,
    color: "#999",
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  quantityLabel: {
    fontSize: 14,
    color: "#666",
    marginRight: 8,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  quantityValueLowStock: {
    color: "#FF3B30",
  },
  thresholdText: {
    fontSize: 12,
    color: "#999",
  },
  inventoryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  editButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteButton: {
    backgroundColor: "#ff3b30",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    minWidth: 70,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    padding: 48,
    alignItems: "center",
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
    padding: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 24,
  },
  modalInfo: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  modalInfoLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  modalInfoText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
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
  filterButtonTextPlaceholder: {
    color: "#999",
  },
  filterButtonArrow: {
    fontSize: 12,
    color: "#666",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#333",
    marginBottom: 16,
  },
  quantityContainer: {
    marginBottom: 16,
  },
  quantityLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  quantityInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quantityAdjustButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  quantityAdjustButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  quantityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#333",
    textAlign: "center",
  },
  thresholdContainer: {
    marginBottom: 16,
  },
  thresholdLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#007AFF",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
