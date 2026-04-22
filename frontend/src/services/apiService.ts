/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { store } from '../redux/store';
import { logout } from '../redux/slices/authSlice';
import type { LoginRequest, LoginResponse, RegisterRequest, CreateProductRequest, CreateInvoiceRequest, User, Product, Invoice, Order, OrderItem, Permission, CreateOrderDTO } from '../../../shared/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://diursystem.alfauzcat.com/api/v1';
const BACKEND_BASE_HINT = API_BASE_URL.replace(/\/api\/v1$/, '');

/**
 * Servicio API
 * Cliente HTTP configurado para comunicarse con el backend
 */
class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para agregar token de autenticación
    this.api.interceptors.request.use(
      config => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      error => Promise.reject(error)
    );

    // Interceptor para manejar errores de respuesta
    this.api.interceptors.response.use(
      response => response,
      error => {
        const status = error.response?.status;
        const requestUrl = String(error.config?.url || '');
        const isAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');

        if (status === 401 && !isAuthRequest) {
          store.dispatch(logout());
        }

        if (error.code === 'ECONNABORTED') {
          error.message = `La solicitud tardó demasiado. Verifica que el backend esté encendido en ${BACKEND_BASE_HINT}.`;
        } else if (!error.response) {
          error.message = `No se pudo conectar con el backend. Revisa VITE_API_URL o inicia el servidor en ${BACKEND_BASE_HINT}.`;
        }

        return Promise.reject(error);
      }
    );
  }

  // Métodos de autenticación
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.api.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  }

  async register(userData: RegisterRequest): Promise<User> {
    const response = await this.api.post<{ user: User }>('/auth/register', userData);
    return response.data.user;
  }

  async createUser(userData: RegisterRequest): Promise<User> {
    const response = await this.api.post<{ user: User }>('/users', userData);
    return response.data.user;
  }

  async getUsers(params?: { limit?: number; offset?: number }): Promise<User[]> {
    const response = await this.api.get<{ users: User[] }>('/users', { params });
    return response.data.users;
  }

  async updateUser(id: number, userData: Partial<RegisterRequest> & { isActive?: boolean }): Promise<User> {
    const response = await this.api.put<{ user: User }>(`/users/${id}`, userData);
    return response.data.user;
  }

  async deleteUser(id: number): Promise<void> {
    await this.api.delete(`/users/${id}`);
  }

  async getProfile(): Promise<User> {
    const response = await this.api.get<{ user: User }>('/auth/profile');
    return response.data.user;
  }

  async getPermissions(): Promise<Permission[]> {
    const response = await this.api.get<{ permissions: Permission[] }>('/permissions');
    return response.data.permissions;
  }

  async getUserPermissions(userId: number): Promise<Permission[]> {
    const response = await this.api.get<{ permissions: Permission[] }>(`/permissions/user/${userId}`);
    return response.data.permissions;
  }

  async assignPermissions(userId: number, permissionIds: number[]): Promise<void> {
    await this.api.post('/permissions/assign', { userId, permissionIds });
  }

  async logout(): Promise<void> {
    await this.api.post('/auth/logout');
  }

  // Métodos de productos
  async getProducts(params?: { limit?: number; offset?: number; category?: string; isActive?: boolean }): Promise<{ products: Product[]; totalCount: number }> {
    const response = await this.api.get('/products', { params });
    return {
      products: response.data.products,
      totalCount: response.data.totalCount || response.data.products.length
    };
  }

  async getProductById(id: number): Promise<Product> {
    const response = await this.api.get<{ product: Product }>(`/products/${id}`);
    return response.data.product;
  }

  async createProduct(productData: CreateProductRequest): Promise<Product> {
    const response = await this.api.post<{ product: Product }>('/products', productData);
    return response.data.product;
  }

  /**
   * Crear múltiples productos (importación masiva)
   */
  async createProductsBulk(products: CreateProductRequest[]): Promise<Product[]> {
    const response = await this.api.post<{ products: Product[] }>('/products/bulk', {
      products
    });
    return response.data.products;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product> {
    const response = await this.api.put<{ product: Product }>(`/products/${id}`, productData);
    return response.data.product;
  }

  async updateStock(id: number, quantity: number): Promise<Product> {
    const response = await this.api.patch<{ product: Product }>(`/products/${id}/stock`, { quantity });
    return response.data.product;
  }

  async deleteProduct(id: number): Promise<void> {
    await this.api.delete(`/products/${id}`);
  }

  // Métodos de facturas
  async getInvoices(params?: { limit?: number; offset?: number; status?: string }): Promise<{ invoices: Invoice[]; totalCount: number }> {
    const response = await this.api.get('/invoices', { params });
    return {
      invoices: response.data.invoices,
      totalCount: response.data.totalCount || response.data.invoices.length
    };
  }

  async getInvoiceById(id: number): Promise<Invoice> {
    const response = await this.api.get<{ invoice: Invoice }>(`/invoices/${id}`);
    return response.data.invoice;
  }

  async createInvoice(invoiceData: CreateInvoiceRequest): Promise<Invoice> {
    const response = await this.api.post<{ invoice: Invoice }>('/invoices', invoiceData);
    return response.data.invoice;
  }

  async updateInvoice(id: number, invoiceData: CreateInvoiceRequest): Promise<Invoice> {
    const response = await this.api.put<{ invoice: Invoice }>(`/invoices/${id}`, invoiceData);
    return response.data.invoice;
  }

  async deleteInvoice(id: number): Promise<Invoice> {
    const response = await this.api.delete<{ invoice: Invoice }>(`/invoices/${id}`);
    return response.data.invoice;
  }

  async updateInvoiceStatus(
    id: number,
    status: Invoice['status'],
    paymentData?: {
      paymentMethod?: Invoice['paymentMethod'];
      paymentReference?: string;
      amountReceived?: number;
      changeAmount?: number;
    }
  ): Promise<Invoice> {
    const response = await this.api.patch<{ invoice: Invoice }>(`/invoices/${id}/status`, {
      status,
      ...paymentData
    });
    return response.data.invoice;
  }

  async sendInvoiceEmail(id: number, email?: string): Promise<Invoice> {
    const response = await this.api.post<{ invoice: Invoice }>(`/invoices/${id}/send-email`, { email });
    return response.data.invoice;
  }

  async cancelInvoice(id: number): Promise<Invoice> {
    const response = await this.api.post<{ invoice: Invoice }>(`/invoices/${id}/cancel`);
    return response.data.invoice;
  }

  // Métodos de pedidos
  async getOrders(params?: { limit?: number; offset?: number; status?: string; type?: string }): Promise<{ orders: Order[]; totalCount: number }> {
    const response = await this.api.get('/orders', { params });
    return {
      orders: response.data.orders,
      totalCount: response.data.totalCount || response.data.orders.length
    };
  }

  async getOrderById(id: number): Promise<Order> {
    const response = await this.api.get<{ order: Order }>(`/orders/${id}`);
    return response.data.order;
  }

  async createOrder(orderData: CreateOrderDTO): Promise<Order> {
    const response = await this.api.post<{ order: Order }>('/orders', orderData);
    return response.data.order;
  }

  async updateOrder(id: number, orderData: Partial<Order>): Promise<Order> {
    const response = await this.api.put<{ order: Order }>(`/orders/${id}`, orderData);
    return response.data.order;
  }

  async updateOrderStatus(id: number, status: Order['status']): Promise<Order> {
    const response = await this.api.put<{ order: Order }>(`/orders/${id}/status`, { status });
    return response.data.order;
  }

  async updateOrderItemStatus(orderId: number, productId: number, data: { status: OrderItem['status']; quantityProcessed: number }): Promise<Order> {
    const response = await this.api.patch<{ order: Order }>(`/orders/${orderId}/items/${productId}/status`, data);
    return response.data.order;
  }

  async cancelOrder(id: number): Promise<Order> {
    return this.updateOrderStatus(id, 'cancelado');
  }

  async deleteOrder(id: number): Promise<void> {
    await this.api.delete(`/orders/${id}`);
  }

  // Métodos de sincronización
  async getPendingEvents(): Promise<any[]> {
    const response = await this.api.get('/sync/pending');
    return response.data.pendingEvents;
  }

  async syncEvents(events: any[]): Promise<any> {
    const response = await this.api.post('/sync/events', { events });
    return response.data.results;
  }
}

export default new ApiService();
