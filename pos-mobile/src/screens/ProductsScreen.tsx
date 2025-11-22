import React, { useState, useEffect } from "react";
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
  Product,
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../lib/productClient";
import { ApiError } from "../lib/api";

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    price: "",
    cost: "",
    barcode: "",
  });

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      const fetchedProducts = await fetchProducts();
      setProducts(fetchedProducts);
    } catch (error) {
      const errorMessage =
        error && typeof error === "object" && "message" in error
          ? (error as ApiError).message
          : "Failed to load products. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const fetchedProducts = await fetchProducts();
      setProducts(fetchedProducts);
    } catch (error) {
      const errorMessage =
        error && typeof error === "object" && "message" in error
          ? (error as ApiError).message
          : "Failed to refresh products. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setRefreshing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return `₱${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setFormData({ name: "", sku: "", price: "", cost: "", barcode: "" });
    setIsModalVisible(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      price: product.price.toString(),
      cost: product.cost.toString(),
      barcode: product.barcode || "",
    });
    setIsModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!formData.name || !formData.sku || !formData.price || !formData.cost) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    const price = parseFloat(formData.price);
    const cost = parseFloat(formData.cost);

    if (isNaN(price) || price < 0) {
      Alert.alert("Error", "Please enter a valid price");
      return;
    }

    if (isNaN(cost) || cost < 0) {
      Alert.alert("Error", "Please enter a valid cost");
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingProduct) {
        // Update existing product
        const updatedProduct = await updateProduct(editingProduct.id, {
          name: formData.name,
          sku: formData.sku,
          price,
          cost,
          barcode: formData.barcode || null,
        });
        setProducts(
          products.map((p) => (p.id === editingProduct.id ? updatedProduct : p))
        );
      } else {
        // Create new product
        const newProduct = await createProduct({
          name: formData.name,
          sku: formData.sku,
          price,
          cost,
          barcode: formData.barcode || null,
        });
        setProducts([newProduct, ...products]);
      }

      setIsModalVisible(false);
      setFormData({ name: "", sku: "", price: "", cost: "", barcode: "" });
    } catch (error) {
      const errorMessage =
        error && typeof error === "object" && "message" in error
          ? (error as ApiError).message
          : "Failed to save product. Please try again.";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = (id: string) => {
    Alert.alert(
      "Delete Product",
      "Are you sure you want to delete this product?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProduct(id);
              setProducts(products.filter((p) => p.id !== id));
            } catch (error) {
              const errorMessage =
                error && typeof error === "object" && "message" in error
                  ? (error as ApiError).message
                  : "Failed to delete product. Please try again.";
              Alert.alert("Error", errorMessage);
            }
          },
        },
      ]
    );
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.barcode &&
        product.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddProduct}>
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
            <Text style={styles.loadingText}>Loading products...</Text>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {searchQuery ? "No products found" : "No products found"}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery
                ? "Try adjusting your search"
                : 'Tap "+ Add" to create your first product'}
            </Text>
          </View>
        ) : (
          <View style={styles.productsList}>
            {filteredProducts.map((product) => (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productSku}>SKU: {product.sku}</Text>
                  <View style={styles.priceRow}>
                    <View style={styles.priceContainer}>
                      <Text style={styles.priceLabel}>Price:</Text>
                      <Text style={styles.productPrice}>
                        {formatCurrency(product.price)}
                      </Text>
                    </View>
                    <View style={styles.priceContainer}>
                      <Text style={styles.priceLabel}>Cost:</Text>
                      <Text style={styles.productCost}>
                        {formatCurrency(product.cost)}
                      </Text>
                    </View>
                  </View>
                  {product.barcode && (
                    <Text style={styles.productBarcode}>
                      Barcode: {product.barcode}
                    </Text>
                  )}
                </View>
                <View style={styles.productActions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => handleEditProduct(product)}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteProduct(product.id)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Product Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => !isSubmitting && setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingProduct ? "Edit Product" : "Add Product"}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Product Name *"
              placeholderTextColor="#999"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              editable={!isSubmitting}
            />

            <TextInput
              style={styles.input}
              placeholder="SKU *"
              placeholderTextColor="#999"
              value={formData.sku}
              onChangeText={(text) => setFormData({ ...formData, sku: text })}
              editable={!isSubmitting}
              autoCapitalize="characters"
            />

            <TextInput
              style={styles.input}
              placeholder="Price *"
              placeholderTextColor="#999"
              value={formData.price}
              onChangeText={(text) => setFormData({ ...formData, price: text })}
              keyboardType="decimal-pad"
              editable={!isSubmitting}
            />

            <TextInput
              style={styles.input}
              placeholder="Cost *"
              placeholderTextColor="#999"
              value={formData.cost}
              onChangeText={(text) => setFormData({ ...formData, cost: text })}
              keyboardType="decimal-pad"
              editable={!isSubmitting}
            />

            <TextInput
              style={styles.input}
              placeholder="Barcode (optional)"
              placeholderTextColor="#999"
              value={formData.barcode}
              onChangeText={(text) =>
                setFormData({ ...formData, barcode: text })
              }
              editable={!isSubmitting}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  isSubmitting && styles.disabledButton,
                ]}
                onPress={() => setIsModalVisible(false)}
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
                onPress={handleSaveProduct}
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
    </SafeAreaView>
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
  productsList: {
    padding: 16,
  },
  productCard: {
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
  productInfo: {
    marginBottom: 12,
  },
  productName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  productSku: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 4,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#007AFF",
  },
  productCost: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  productBarcode: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  productActions: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  editButtonText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#ff3b30",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  deleteButtonText: {
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
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 24,
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
});
