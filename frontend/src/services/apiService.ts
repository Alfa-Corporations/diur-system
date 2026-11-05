/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { store } from '../redux/store';
import { logout } from '../redux/slices/authSlice';
import localDBService from './localDBService';
import type { LoginRequest, LoginResponse, RegisterRequest, CreateProductRequest, CreateInvoiceRequest, User, Product, Invoice, Order, OrderItem, Permission, CreateOrderDTO, Customer, Visit } from '../../../shared/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://diursystem.alfauzcat.com/api/v1';
const BACKEND_BASE_HINT = API_BASE_URL.replace(/\/api\/v1$/, '');

/**
 * Servicio API
 * Cliente HTTP configurado para comunicarse con el backend
 */
class ApiService {
  private api: AxiosInstance;

  private isOffline(): boolean {
    return typeof navigator !== 'undefined' && !navigator.onLine;
  }

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

        const responseMessage = error.response?.data?.message;
        if (typeof responseMessage === 'string' && responseMessage.trim()) {
          error.message = responseMessage;
        }

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

  async createUser(userData: Omit<RegisterRequest, 'password'>): Promise<User> {
    const response = await this.api.post<{ user: User }>('/users', userData);
    return response.data.user;
  }

  async getUsers(params?: { limit?: number; offset?: number }): Promise<User[]> {
    if (this.isOffline()) return localDBService.getUsers();
    const response = await this.api.get<{ users: User[] }>('/users', { params });
    await localDBService.saveUsers(response.data.users);
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

  async changePassword(currentPassword: string, newPassword: string): Promise<User> {
    const response = await this.api.post<{ user: User }>('/auth/change-password', { currentPassword, newPassword });
    return response.data.user;
  }

  async getPermissions(): Promise<Permission[]> {
    if (this.isOffline()) return localDBService.getPermissions();
    const response = await this.api.get<{ permissions: Permission[] }>('/permissions');
    await localDBService.savePermissions(response.data.permissions);
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

  async getPushPublicKey(): Promise<string> {
    const response = await this.api.get<{ publicKey: string }>('/notifications/vapid-public-key');
    return response.data.publicKey;
  }

  async savePushSubscription(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void> {
    await this.api.post('/notifications/subscribe', subscription);
  }

  async removePushSubscription(endpoint: string): Promise<void> {
    await this.api.delete('/notifications/subscribe', { data: { endpoint } });
  }

  // Métodos de productos
  async getProducts(params?: { limit?: number; offset?: number; category?: string; isActive?: boolean }): Promise<{ products: Product[]; totalCount: number }> {
    if (this.isOffline()) {
      const cached = await localDBService.getProducts();
      const filtered = cached.filter(product =>
        (params?.category === undefined || product.category === params.category) &&
        (params?.isActive === undefined || product.isActive === params.isActive));
      const offset = params?.offset || 0;
      const products = params?.limit === undefined ? filtered.slice(offset) : filtered.slice(offset, offset + params.limit);
      return { products, totalCount: filtered.length };
    }
    const response = await this.api.get('/products', { params });
    await localDBService.saveProducts(response.data.products);
    return {
      products: response.data.products,
      totalCount: response.data.totalCount || response.data.products.length
    };
  }

  async getProductById(id: number): Promise<Product> {
    if (this.isOffline()) {
      const product = await localDBService.getProductById(id);
      if (product) return product;
      throw new Error('El producto no está disponible en los datos guardados en este dispositivo.');
    }
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
  async getInvoices(params?: { limit?: number; offset?: number; status?: string; customerId?: number }): Promise<{ invoices: Invoice[]; totalCount: number }> {
    if (this.isOffline()) {
      const cached = await localDBService.getInvoices();
      const filtered = cached.filter(invoice =>
        (params?.status === undefined || invoice.status === params.status) &&
        (params?.customerId === undefined || invoice.customerId === params.customerId));
      const offset = params?.offset || 0;
      const invoices = params?.limit === undefined ? filtered.slice(offset) : filtered.slice(offset, offset + params.limit);
      return { invoices, totalCount: filtered.length };
    }
    const response = await this.api.get('/invoices', { params });
    await localDBService.saveInvoices(response.data.invoices);
    return {
      invoices: response.data.invoices,
      totalCount: response.data.totalCount || response.data.invoices.length
    };
  }

  async getInvoiceById(id: number): Promise<Invoice> {
    if (this.isOffline()) {
      const invoice = await localDBService.getInvoiceById(id);
      if (invoice) return invoice;
      throw new Error('La factura no está disponible en los datos guardados en este dispositivo.');
    }
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

  // Cuentas por cobrar
  async getAccountsReceivable(params?: { status?: string; customerId?: number }): Promise<{ accounts: any[] }> {
    if (this.isOffline()) {
      const cached = await localDBService.getAccounts();
      return {
        accounts: cached.filter(account =>
          (params?.status === undefined || account.status === params.status) &&
          (params?.customerId === undefined || Number(account.customerId) === params.customerId))
      };
    }
    const response = await this.api.get('/accounts-receivable', { params });
    await localDBService.saveAccounts(response.data.accounts);
    return response.data;
  }

  async getAccountsReceivableById(id: number): Promise<any> {
    const response = await this.api.get(`/accounts-receivable/${id}`);
    return response.data.account;
  }

  async payAccountReceivable(id: number, amount: number, opts?: { paymentMethod?: string; paymentReference?: string }): Promise<{ account: any; payment: any }> {
    const body: any = { amount };
    if (opts?.paymentMethod) body.paymentMethod = opts.paymentMethod;
    if (opts?.paymentReference) body.paymentReference = opts.paymentReference;
    const response = await this.api.post(`/accounts-receivable/${id}/pay`, body);
    return { account: response.data.account, payment: response.data.payment };
  }

  // Métodos de pedidos
  async getOrders(params?: { status?: string; type?: string; customerId?: number }): Promise<{ orders: Order[]; totalCount: number }> {
    if (this.isOffline()) {
      const cached = await localDBService.getOrders();
      const orders = cached.filter(order =>
        (params?.status === undefined || order.status === params.status) &&
        (params?.type === undefined || order.type === params.type) &&
        (params?.customerId === undefined || order.customerId === params.customerId));
      return { orders, totalCount: orders.length };
    }
    const response = await this.api.get('/orders', { params });
    await localDBService.saveOrders(response.data.orders);
    return {
      orders: response.data.orders,
      totalCount: response.data.totalCount || response.data.orders.length
    };
  }

  async getOrderById(id: number): Promise<Order> {
    if (this.isOffline()) {
      const order = await localDBService.getOrderById(id);
      if (order) return order;
      throw new Error('El pedido no está disponible en los datos guardados en este dispositivo.');
    }
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

  async updateOrderItemStatus(orderId: number, productId: number, data: { quantityProcessed: number }): Promise<OrderItem> {
    const response = await this.api.patch<{ item: OrderItem }>(`/orders/${orderId}/items/${productId}/status`, data);
    return response.data.item;
  }

  async cancelOrder(id: number): Promise<Order> {
    return this.updateOrderStatus(id, 'cancelado');
  }

  async deleteOrder(id: number): Promise<void> {
    await this.api.delete(`/orders/${id}`);
  }

  // Métodos de customers

  async getCustomers(): Promise<{ customers: Customer[]; totalCount: number }> {
    if (this.isOffline()) {
      const customers = await localDBService.getCustomers();
      return { customers, totalCount: customers.length };
    }
    const response = await this.api.get('/customers');
    await localDBService.saveCustomers(response.data.customers);
    return {
      customers: response.data.customers,
      totalCount: response.data.totalCount || response.data.customers.length
    };
  }

  async createCustomer(data: { name: string; address?: string; phone?: string; email?: string; identificationType?: 'none' | 'cedula' | 'ruc' | 'passport'; identificationNumber?: string | number; isFinalConsumer?: boolean }): Promise<Customer> {
    const response = await this.api.post('/customers', data);
    return response.data;
  }

  async updateCustomer(
    id: number,
    data: {
      name?: string;
      address?: string;
      phone?: string;
      email?: string;
      identificationType?: 'none' | 'cedula' | 'ruc' | 'passport';
      identificationNumber?: string | number;
      isFinalConsumer?: boolean;
    }
  ): Promise<Customer> {
    const response = await this.api.put(`/customers/${id}`, data);
    return response.data;
  }

  async deleteCustomer(id: number): Promise<void> {
    await this.api.delete(`/customers/${id}`);
  }

  async getVisits(params?: { customerId?: number; dateFrom?: string; dateTo?: string; userId?: number }): Promise<Visit[]> {
    if (this.isOffline()) {
      return (await localDBService.getVisits()).filter(visit =>
        (params?.customerId === undefined || visit.customerId === params.customerId) &&
        (params?.userId === undefined || visit.userId === params.userId) &&
        (params?.dateFrom === undefined || visit.visitDate >= params.dateFrom) &&
        (params?.dateTo === undefined || visit.visitDate <= params.dateTo));
    }
    const response = await this.api.get<{ visits: Visit[] }>('/visits', { params });
    await localDBService.saveVisits(response.data.visits);
    return response.data.visits;
  }

  async startVisit(data: Pick<Visit, 'customerId' | 'visitDate' | 'latitude' | 'longitude' | 'street' | 'city' | 'province' | 'country'>): Promise<Visit> {
    const response = await this.api.post<{ visit: Visit }>('/visits', data);
    return response.data.visit;
  }

  async finishVisit(id: number): Promise<Visit> {
    const response = await this.api.patch<{ visit: Visit }>(`/visits/${id}/end`);
    return response.data.visit;
  }

  // Métodos de sincronización
  async getSuppliers(): Promise<{ suppliers: Array<{ id: number; name: string }> }> {
    if (this.isOffline()) return { suppliers: await localDBService.getSuppliers() };
    const response = await this.api.get('/suppliers');
    await localDBService.saveSuppliers(response.data.suppliers);
    return response.data;
  }

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
