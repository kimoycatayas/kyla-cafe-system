/**
 * IndexedDB wrapper for local-first data storage
 * Stores products, orders, inventory, and sync queue
 */

const DB_NAME = "kyla-pos-db";
const DB_VERSION = 1;

export type StoreName =
  | "products"
  | "orders"
  | "inventory"
  | "syncQueue"
  | "checkoutConfig";

interface DB {
  db: IDBDatabase;
}

let dbInstance: IDBDatabase | null = null;

export async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Products store
      if (!db.objectStoreNames.contains("products")) {
        const productsStore = db.createObjectStore("products", { keyPath: "id" });
        productsStore.createIndex("sku", "sku", { unique: false });
        productsStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // Orders store
      if (!db.objectStoreNames.contains("orders")) {
        const ordersStore = db.createObjectStore("orders", { keyPath: "id" });
        ordersStore.createIndex("orderNumber", "orderNumber", { unique: false });
        ordersStore.createIndex("status", "status", { unique: false });
        ordersStore.createIndex("createdAt", "createdAt", { unique: false });
        ordersStore.createIndex("cashierId", "cashierId", { unique: false });
      }

      // Inventory store
      if (!db.objectStoreNames.contains("inventory")) {
        const inventoryStore = db.createObjectStore("inventory", {
          keyPath: "productId",
        });
        inventoryStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // Sync queue store - for offline operations
      if (!db.objectStoreNames.contains("syncQueue")) {
        const syncStore = db.createObjectStore("syncQueue", {
          keyPath: "id",
          autoIncrement: true,
        });
        syncStore.createIndex("type", "type", { unique: false });
        syncStore.createIndex("status", "status", { unique: false });
        syncStore.createIndex("createdAt", "createdAt", { unique: false });
      }

      // Checkout config store
      if (!db.objectStoreNames.contains("checkoutConfig")) {
        db.createObjectStore("checkoutConfig", { keyPath: "id" });
      }
    };
  });
}

export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// Generic CRUD operations
export async function put<T extends { id: string }>(
  storeName: StoreName,
  item: T
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function putMany<T extends { id: string }>(
  storeName: StoreName,
  items: T[]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);

    let completed = 0;
    const total = items.length;

    if (total === 0) {
      resolve();
      return;
    }

    items.forEach((item) => {
      const request = store.put(item);
      request.onsuccess = () => {
        completed++;
        if (completed === total) {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  });
}

export async function get<T extends { id: string }>(
  storeName: StoreName,
  id: string
): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll<T extends { id: string }>(
  storeName: StoreName
): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function remove(storeName: StoreName, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clear(storeName: StoreName): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Query helpers
export async function queryByIndex<T>(
  storeName: StoreName,
  indexName: string,
  value: unknown
): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function queryRange<T>(
  storeName: StoreName,
  indexName: string,
  range: IDBKeyRange
): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(range);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

