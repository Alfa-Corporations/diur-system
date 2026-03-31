/**
 * Interfaces compartidas entre frontend y backend
 * Define tipos de datos comunes para el sistema de facturación
 */

// Usuario
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'cashier' | 'warehouse' | 'delivery';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Producto
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

// Item de factura
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

export interface Customer {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  identificationType?: 'none' | 'cedula' | 'ruc' | 'passport';
  identificationNumber?: string | null;
  address?: string | null;
  isFinalConsumer: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceDocumentType = 'consumer_final' | 'sales_note' | 'sri_invoice';

// Factura
export interface Invoice {
  id: number;
  invoiceNumber: string;
  userId: number;
  customerId?: number | null;
  total: number;
  status: 'pending' | 'paid' | 'cancelled';
  documentType?: InvoiceDocumentType;
  sriStatus?: 'not_applicable' | 'pending' | 'authorized' | 'rejected';
  sriAuthorizationNumber?: string;
  paymentMethod?: 'cash' | 'card' | 'check' | 'transfer' | 'other';
  paymentReference?: string;
  amountReceived?: number;
  changeAmount?: number;
  paidAt?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerIdentificationType?: 'none' | 'cedula' | 'ruc' | 'passport';
  customerIdentification?: string;
  customerAddress?: string;
  emailSentAt?: string;
  user?: User;
  customer?: Customer;
  items?: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

// Pedido
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

// DTOs para API
export interface LoginRequest {
  identifier: string; // email o username
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
  documentType?: InvoiceDocumentType;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    identificationType?: 'none' | 'cedula' | 'ruc' | 'passport';
    identificationNumber?: string;
    address?: string;
  };
  customerName?: string;
  customerEmail?: string;
}

export interface UpdateStockRequest {
  quantity: number; // cantidad a agregar/restar
}

// Eventos de sincronización
export interface SyncEvent {
  id: string;
  type: 'create_product' | 'update_product' | 'delete_product' | 'create_invoice' | 'update_invoice' | 'delete_invoice';
  data: unknown;
  timestamp: string;
  synced: boolean;
}

// Notificaciones en tiempo real
export interface Notification {
  type: 'invoice_created' | 'invoice_paid' | 'invoice_deleted' | 'inventory_updated' | 'order_created' | 'order_updated' | 'order_assigned';
  message: string;
  data: unknown;
  timestamp: string | Date;
}

// Estado de la aplicación
export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isOnline: boolean;
  pendingSync: SyncEvent[];
  notifications: Notification[];
}
