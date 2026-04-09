export interface Product {
  id: string;
  name: string;
  variant: string;
  stock: number; // This will remain as "Allocated Total" or "Current Stock"
  purchaseQuantity: number; // New field: "Bought quantity"
  lossQuantity?: number; // New field: "Damaged/Lost quantity"
  price: number;
  discountMode?: 'none' | 'pair' | 'bulk';
  discountThreshold?: number;
  discountPrice?: number;
  updatedAt: number;
}

export interface Customer {
  id: string;
  name: string;
  totalSpent: number;
  isPaid?: boolean;
  updatedAt: number;
}

export interface Order {
  id: string;
  productId: string;
  customerId: string;
  requestedQuantity: number;
  allocatedQuantity: number;
  note: string;
  isUrgent: boolean;
  subtotal: number;
  isArrived?: boolean; // Deprecated, use arrivedQuantity
  arrivedQuantity?: number;
  isShipped?: boolean; // New field: "Shipped status"
  createdAt: number;
  updatedAt: number;
}

export interface AppState {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  spreadsheetId?: string;
  googleCredentials?: string;
  notificationTemplate?: string;
  lastSyncedAt: number | null;
}
