/**
 * Interfaces compartidas entre frontend y backend
 * Define tipos de datos comunes para el sistema de facturación
 */

// Usuario
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'caja' | 'bodega' | 'vendedor';
  permissions?: Permission[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: number;
  name: string;
}

// Producto
export interface Product {
  codigo1?: any;
  codigo2: any;
  codigo3: any;
  codigo4: any;
  codigo5?: any;
  id: number;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  partnumber: string;
  barcode?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  supplier: Supplier;
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

  identificationType?: 'none' | 'cedula' | 'ruc' | 'passport';
  identificationNumber?: string;
  address?: string;
  email?: string;
  phone?: string;
  isFinalConsumer?: boolean;
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
  paymentMethod?: 'cash' | 'card' | 'check' | 'transfer' | 'credit' | 'other';
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
  customer?: any;
  id: number;
  userId: number;
  type: 'compra' | 'venta' | 'venta al mayor';
  status: 'pendiente' | 'en_transito' | 'facturado' | 'cancelado';
  total: number;
  supplier?: number;
  customerName?: string;
  customerAddress?: string;
  deliveryUserId?: number;
  user?: User;
  deliveryUser?: User;
  items?: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

// Item de pedido
export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantityRequested: number;
  quantityProcessed: number;
  status: 'pendiente' | 'en_transito' | 'en_bodega' | 'repartidor' | 'facturado';
  unitPrice: number;
  product?: Product;
  createdAt: string;
  updatedAt: string;
}

export type CreateOrderDTO = {
  type: 'compra' | 'venta' | 'venta al mayor';
  items: {
    productId: number;
    quantityRequested: number;
  }[];
  customerName?: string;
  customerId?: number;
  supplier?: number;
  customerAddress?: string;
};

// Permiso
export interface Permission {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// Notificación
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read?: boolean;
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
  partnumber: string;
  codigo1?: string;
  codigo2?: string;
  codigo3?: string;
  codigo4?: string;
  codigo5?: string;
}

export interface CreateInvoiceRequest {
  items: Array<{
    productId: number;
    quantity: number;
    price?: number;
    orderItemId?: number;
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
  customerPhone?: string;
  customerIdentificationType?: 'none' | 'cedula' | 'ruc' | 'passport';
  customerIdentification?: string;
  customerAddress?: string;
  paymentMethod?: 'cash' | 'card' | 'check' | 'transfer' | 'credit' | 'other';
  paymentReference?: string;
  amountReceived?: number;
  changeAmount?: number;
}

export interface UpdateStockRequest {
  quantity: number; // cantidad a agregar/restar
}

// Eventos de sincronización
export interface SyncEvent {
  id: string;
  type: 'crear_producto' | 'actualizar_producto' | 'eliminar_producto' | 'crear_factura' | 'actualizar_factura' | 'delete_invoice' | 'crear_orden' | 'actualizar_orden' | 'delete_order';
  data: unknown;
  timestamp: string;
  synced: boolean;
}

// Notificaciones en tiempo real
export interface RealtimeNotification {
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
