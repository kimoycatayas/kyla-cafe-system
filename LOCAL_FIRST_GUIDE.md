# Local-First POS System Guide

## Overview

Your POS system has been enhanced with **local-first architecture**, meaning cashiers can work completely offline. All data is stored locally in the browser's IndexedDB, and changes sync automatically when the connection is restored.

## Key Features

### ✅ Offline-First Operations
- **Products**: Cached locally, available offline
- **Orders**: Created and managed offline with optimistic updates
- **Inventory**: Stock levels cached for offline reference
- **Checkout Config**: Payment methods and discount types available offline

### ✅ Automatic Sync
- Operations are queued when offline
- Automatic background sync when connection is restored
- Retry logic with exponential backoff
- Conflict resolution for concurrent edits

### ✅ Progressive Web App (PWA)
- Installable on mobile devices and desktops
- Works like a native app
- Service worker for offline caching
- Background sync support

## Architecture

### Data Storage Layers

1. **IndexedDB** (Local Storage)
   - Products
   - Orders
   - Inventory
   - Sync Queue
   - Checkout Config

2. **Sync Queue**
   - Queues operations when offline
   - Retries failed operations
   - Tracks sync status

3. **Service Worker**
   - Caches static assets
   - Handles background sync
   - Provides offline fallbacks

### Data Flow

```
User Action → Local-First Client
    ↓
Check IndexedDB (instant)
    ↓
If Online: Sync with Server (background)
    ↓
If Offline: Queue for Later Sync
```

## Usage

### For Cashiers

1. **First Time Setup**
   - Open the app while online
   - Products and inventory will be cached automatically
   - App can now work offline

2. **Offline Operations**
   - Create orders normally
   - Add items to cart
   - Process payments
   - All operations work offline

3. **Sync Status**
   - Yellow banner appears when offline
   - Changes sync automatically when online
   - No action needed from cashier

### For Developers

#### Using Local-First Clients

Replace direct API calls with local-first versions:

```typescript
// ❌ Old way (requires network)
import { fetchProducts } from "@/lib/productClient";
const products = await fetchProducts();

// ✅ New way (works offline)
import { fetchProductsLocalFirst } from "@/lib/localStorage/localFirstClient";
const products = await fetchProductsLocalFirst();
```

#### Available Local-First Functions

- `fetchProductsLocalFirst()` - Get products (cached)
- `fetchOrdersLocalFirst()` - Get orders (cached)
- `createOrderLocalFirst()` - Create order (optimistic)
- `getOrderSummaryLocalFirst()` - Get order summary
- `fetchInventoryLocalFirst()` - Get inventory (cached)
- `fetchCheckoutConfigLocalFirst()` - Get checkout config

#### Manual Sync

```typescript
import { processSyncQueue } from "@/lib/localStorage/syncManager";

// Process pending sync operations
await processSyncQueue();
```

#### Checking Online Status

```typescript
import { isOnline } from "@/lib/localStorage/syncManager";

if (isOnline()) {
  // Online operations
} else {
  // Offline operations
}
```

## Implementation Details

### IndexedDB Schema

- **products**: `{ id, name, sku, price, ... }`
- **orders**: `{ id, orderNumber, status, items, ... }`
- **inventory**: `{ productId, quantity, ... }`
- **syncQueue**: `{ id, type, status, endpoint, payload, ... }`
- **checkoutConfig**: `{ id, paymentMethods, discountTypes }`

### Sync Queue Operations

Operations are automatically queued when offline:
- `CREATE_ORDER`
- `ADD_ORDER_ITEM`
- `UPDATE_ORDER_ITEM`
- `REMOVE_ORDER_ITEM`
- `FINALIZE_ORDER`
- `VOID_ORDER`

### Conflict Resolution

When conflicts occur (same order edited offline and online):
1. Server version takes precedence
2. Local optimistic updates are replaced
3. User is notified of conflicts

## Testing Offline Mode

### Chrome DevTools

1. Open DevTools (F12)
2. Go to Network tab
3. Select "Offline" from throttling dropdown
4. Test app functionality

### Service Worker Testing

1. Open DevTools → Application tab
2. Service Workers section
3. Check registration status
4. Test offline/online toggling

## Deployment Considerations

### HTTPS Required

Service workers and IndexedDB require HTTPS in production. Ensure your deployment uses HTTPS.

### Cache Invalidation

- Service worker cache versioned (`CACHE_NAME`)
- Update version to force cache refresh
- IndexedDB schema versioned for migrations

### Performance

- IndexedDB is asynchronous but fast
- Large datasets may need pagination
- Consider data retention policies

## Troubleshooting

### Sync Not Working

1. Check browser console for errors
2. Verify service worker is registered
3. Check IndexedDB in DevTools → Application
4. Review sync queue status

### Data Not Persisting

1. Check browser storage quota
2. Verify IndexedDB permissions
3. Check for browser-specific issues

### Offline Mode Not Activating

1. Ensure service worker is registered
2. Check manifest.json is accessible
3. Verify HTTPS in production
4. Test in incognito mode (may have different behavior)

## Next Steps

To fully integrate local-first into your sales processing page:

1. Update `sales-processing/page.tsx` to use local-first clients
2. Add optimistic UI updates
3. Handle sync conflicts gracefully
4. Add sync status indicators
5. Test thoroughly in offline scenarios

## Resources

- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Best Practices](https://web.dev/pwa-checklist/)

