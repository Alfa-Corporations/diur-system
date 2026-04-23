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

export interface Supplier {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  partnumber: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  supplier: Array<Supplier>;
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

export interface Customer {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  identificationType?: 'none' | 'cedula' | 'ruc' | 'passport';
  identificationNumber?: number | null;
  address?: string | null;
  isFinalConsumer?: boolean;
  createdAt?: string;
  updatedAt?: string;
}


export type InvoiceDocumentType = 'consumer_final' | 'sales_note' | 'sri_invoice';

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

export interface Order {
  id: number;
  userId: number;
  status: 'pendiente' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
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
  partnumber: string;
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
  quantity: number;
}

export interface SyncEvent {
  id: string;
  type: 'crear_producto' | 'actualizar_producto' | 'eliminar_producto' | 'crear_factura' | 'actualizar_factura' | 'delete_invoice';
  data: unknown;
  timestamp: string;
  synced: boolean;
}

export interface Notification {
  type: 'invoice_created' | 'invoice_paid' | 'invoice_deleted' | 'inventory_updated' | 'order_created' | 'order_updated' | 'order_assigned';
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
