/**
 * Interfaces de la aplicación web
 * Tipos compartidos usados por el frontend DIUR
 */

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'cashier' | 'warehouse' | 'delivery';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  sku: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  productId: number;
  quantity: number;
  price: number;
  total: number;
  product?: Product;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  userId: number;
  total: number;
  status: 'pending' | 'paid' | 'cancelled';
  customerName?: string;
  customerEmail?: string;
  user?: User;
  items?: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: number;
  userId: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  customerName?: string;
  customerAddress?: string;
  deliveryUserId?: number;
  deliveryUser?: User;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role?: User['role'];
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  sku: string;
}

export interface CreateInvoiceRequest {
  items: Array<{
    productId: number;
    quantity: number;
  }>;
  customerName?: string;
  customerEmail?: string;
}

export interface UpdateStockRequest {
  quantity: number;
}

export interface SyncEvent {
  id: string;
  type: 'create_product' | 'update_product' | 'delete_product' | 'create_invoice' | 'update_invoice' | 'delete_invoice';
  data: unknown;
  timestamp: string;
  synced: boolean;
}

export interface Notification {
  type: 'invoice_created' | 'inventory_updated' | 'order_created' | 'order_updated' | 'order_assigned';
  message: string;
  data: unknown;
  timestamp: string | Date;
}

export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isOnline: boolean;
  pendingSync: SyncEvent[];
  notifications: Notification[];
}
