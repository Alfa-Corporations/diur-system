/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { store } from '../redux/store';
import { logout } from '../redux/slices/authSlice';
import localDBService from './localDBService';
import type { LoginRequest, LoginResponse, RegisterRequest, CreateProductRequest, CreateInvoiceRequest, User, Product, Invoice, Order, OrderItem, Permission, CreateOrderDTO, Customer, Visit, SyncEvent } from '../../../shared/types';

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

  private createLocalId(): number {
    return -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
  }

  private getStoredUser(): User | null {
    const storedUser = localStorage.getItem('authUser');
    if (!storedUser) return null;
    try {
      return JSON.parse(storedUser) as User;
    } catch (error) {
      console.error('Could not read the offline user session:', error);
      return null;
    }
  }

  private async queueOfflineChange(type: SyncEvent['type'], data: unknown, baseUpdatedAt?: string): Promise<void> {
    const event: SyncEvent = {
      id: `offline_${crypto.randomUUID()}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      synced: false,
      status: 'pending',
      baseUpdatedAt,
    };
    await localDBService.addPendingEvent(event);
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
    if (this.isOffline()) {
      const localUser: User = {
        id: this.createLocalId(),
        username: userData.username,
        email: userData.email,
        role: userData.role || 'caja',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await localDBService.saveUsers([...(await localDBService.getUsers()), localUser]);
      await this.queueOfflineChange('crear_usuario', { ...userData, localId: localUser.id });
      return localUser;
    }
    const response = await this.api.post<{ user: User }>('/users', userData);
    await localDBService.saveUsers([...(await localDBService.getUsers()), response.data.user]);
    return response.data.user;
  }

  async getUsers(params?: { limit?: number; offset?: number }): Promise<User[]> {
    if (this.isOffline()) return localDBService.getUsers();
    const response = await this.api.get<{ users: User[] }>('/users', { params });
    await localDBService.saveUsers(response.data.users);
    return response.data.users;
  }

  async updateUser(id: number, userData: Partial<RegisterRequest> & { isActive?: boolean }): Promise<User> {
    if (this.isOffline()) {
      const existing = (await localDBService.getUsers()).find(user => user.id === id);
      if (!existing) throw new Error('El usuario no está guardado en este dispositivo.');
      const updated = { ...existing, ...userData, updatedAt: new Date().toISOString() };
      await localDBService.saveUsers((await localDBService.getUsers()).map(user => user.id === id ? updated : user));
      await this.queueOfflineChange('actualizar_usuario', { id, ...userData }, existing.updatedAt);
      return updated;
    }
    const response = await this.api.put<{ user: User }>(`/users/${id}`, userData);
    await localDBService.saveUsers((await localDBService.getUsers()).map(user => user.id === id ? response.data.user : user));
    return response.data.user;
  }

  async deleteUser(id: number): Promise<void> {
    if (this.isOffline()) {
      const existing = (await localDBService.getUsers()).find(user => user.id === id);
      if (!existing) throw new Error('El usuario no está guardado en este dispositivo.');
      await localDBService.saveUsers((await localDBService.getUsers()).filter(user => user.id !== id));
      await this.queueOfflineChange('eliminar_usuario', { id }, existing.updatedAt);
      return;
    }
    await this.api.delete(`/users/${id}`);
    await localDBService.saveUsers((await localDBService.getUsers()).filter(user => user.id !== id));
  }

  async getProfile(): Promise<User> {
    if (this.isOffline()) {
      const user = this.getStoredUser();
      if (user) return user;
      throw new Error('No hay una sesión guardada para trabajar sin conexión.');
    }
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
    if (this.isOffline()) {
      const user = (await localDBService.getUsers()).find(cachedUser => cachedUser.id === userId);
      return user?.permissions || [];
    }
    const response = await this.api.get<{ permissions: Permission[] }>(`/permissions/user/${userId}`);
    const users = await localDBService.getUsers();
    const target = users.find(user => user.id === userId);
    if (target) {
      await localDBService.saveUsers(users.map(user => user.id === userId
        ? { ...user, permissions: response.data.permissions }
        : user));
    }
    return response.data.permissions;
  }

  async assignPermissions(userId: number, permissionIds: number[]): Promise<void> {
    if (this.isOffline()) {
      const users = await localDBService.getUsers();
      const target = users.find(user => user.id === userId);
      if (!target) throw new Error('El usuario no está guardado en este dispositivo.');
      const permissions = (await localDBService.getPermissions()).filter(permission => permissionIds.includes(permission.id));
      await localDBService.saveUsers(users.map(user => user.id === userId
        ? { ...user, permissions, updatedAt: new Date().toISOString() }
        : user));
      await this.queueOfflineChange('asignar_permisos', { userId, permissionIds }, target.updatedAt);
      return;
    }
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
    if (this.isOffline()) {
      const now = new Date().toISOString();
      const product = {
        ...productData,
        id: this.createLocalId(),
        description: productData.description || '',
        category: productData.category || '',
        codigo1: productData.codigo1 || '',
        codigo2: productData.codigo2 || '',
        codigo3: productData.codigo3 || '',
        codigo4: productData.codigo4 || '',
        codigo5: productData.codigo5 || '',
        supplier: { id: 0, name: '' },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      } as Product;
      await localDBService.saveProduct(product);
      await this.queueOfflineChange('crear_producto', { ...productData, localId: product.id });
      return product;
    }
    const response = await this.api.post<{ product: Product }>('/products', productData);
    await localDBService.saveProduct(response.data.product);
    return response.data.product;
  }

  /**
   * Crear múltiples productos (importación masiva)
   */
  async createProductsBulk(products: CreateProductRequest[]): Promise<Product[]> {
    if (this.isOffline()) {
      const created: Product[] = [];
      for (const product of products) created.push(await this.createProduct(product));
      return created;
    }
    const response = await this.api.post<{ products: Product[] }>('/products/bulk', {
      products
    });
    await localDBService.saveProducts([...await localDBService.getProducts(), ...response.data.products]);
    return response.data.products;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product> {
    if (this.isOffline()) {
      const existing = await localDBService.getProductById(id);
      if (!existing) throw new Error('El producto no está guardado en este dispositivo.');
      const updated = { ...existing, ...productData, updatedAt: new Date().toISOString() };
      await localDBService.saveProduct(updated);
      await this.queueOfflineChange('actualizar_producto', { id, ...productData }, existing.updatedAt);
      return updated;
    }
    const response = await this.api.put<{ product: Product }>(`/products/${id}`, productData);
    await localDBService.saveProduct(response.data.product);
    return response.data.product;
  }

  async updateStock(id: number, quantity: number): Promise<Product> {
    if (this.isOffline()) {
      const existing = await localDBService.getProductById(id);
      if (!existing) throw new Error('El producto no está guardado en este dispositivo.');
      const updated = { ...existing, stock: existing.stock + quantity, updatedAt: new Date().toISOString() };
      await localDBService.saveProduct(updated);
      await this.queueOfflineChange('actualizar_stock', { id, quantity }, existing.updatedAt);
      return updated;
    }
    const response = await this.api.patch<{ product: Product }>(`/products/${id}/stock`, { quantity });
    await localDBService.saveProduct(response.data.product);
    return response.data.product;
  }

  async deleteProduct(id: number): Promise<void> {
    if (this.isOffline()) {
      const existing = await localDBService.getProductById(id);
      if (!existing) throw new Error('El producto no está guardado en este dispositivo.');
      await localDBService.deleteProduct(id);
      await this.queueOfflineChange('eliminar_producto', { id }, existing.updatedAt);
      return;
    }
    await this.api.delete(`/products/${id}`);
    await localDBService.deleteProduct(id);
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
    if (this.isOffline()) {
      const user = this.getStoredUser();
      if (!user) throw new Error('No se encontró una sesión guardada para crear la factura.');
      const now = new Date().toISOString();
      const id = this.createLocalId();
      const products = await localDBService.getProducts();
      const total = invoiceData.items.reduce((sum, item) => {
        const product = products.find(cachedProduct => cachedProduct.id === item.productId);
        return sum + Number(item.price ?? product?.price ?? 0) * item.quantity;
      }, 0);
      const invoice: Invoice = {
        id,
        invoiceNumber: `TMP-${Math.abs(id)}`,
        invoiceNumberExternal: invoiceData.invoiceNumberExternal || '',
        userId: user.id,
        customerId: null,
        total,
        status: invoiceData.paymentMethod === 'credit' ? 'pending' : 'paid',
        documentType: invoiceData.documentType,
        paymentMethod: invoiceData.paymentMethod,
        paymentReference: invoiceData.paymentReference,
        amountReceived: invoiceData.amountReceived,
        changeAmount: invoiceData.changeAmount,
        customerName: invoiceData.customer?.name || invoiceData.customerName,
        customerEmail: invoiceData.customer?.email || invoiceData.customerEmail,
        customerPhone: invoiceData.customer?.phone || invoiceData.customerPhone,
        customerIdentificationType: invoiceData.customer?.identificationType || invoiceData.customerIdentificationType,
        customerIdentification: invoiceData.customer?.identificationNumber || invoiceData.customerIdentification,
        customerAddress: invoiceData.customer?.address || invoiceData.customerAddress,
        items: invoiceData.items.map((item, index) => ({
          id: index + 1,
          invoiceId: id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price ?? products.find(product => product.id === item.productId)?.price ?? 0,
          total: (item.price ?? products.find(product => product.id === item.productId)?.price ?? 0) * item.quantity,
          createdAt: now,
          updatedAt: now,
        })),
        createdAt: now,
        updatedAt: now,
      };
      await localDBService.saveInvoice(invoice);
      const quantitiesByProduct = new Map<number, number>();
      invoice.items?.forEach(item => {
        quantitiesByProduct.set(item.productId, (quantitiesByProduct.get(item.productId) || 0) + item.quantity);
      });
      await localDBService.saveProducts(products.map(product => ({
        ...product,
        stock: Math.max(0, product.stock - (quantitiesByProduct.get(product.id) || 0)),
        updatedAt: quantitiesByProduct.has(product.id) ? now : product.updatedAt,
      })));
      await this.queueOfflineChange('crear_factura', { localId: id, ...invoiceData, status: invoice.status });
      return invoice;
    }
    const response = await this.api.post<{ invoice: Invoice }>('/invoices', invoiceData);
    await localDBService.saveInvoice(response.data.invoice);
    return response.data.invoice;
  }

  async updateInvoice(id: number, invoiceData: CreateInvoiceRequest): Promise<Invoice> {
    if (this.isOffline()) {
      const existing = await localDBService.getInvoiceById(id);
      if (!existing) throw new Error('La factura no está guardada en este dispositivo.');
      const now = new Date().toISOString();
      const { customer, ...invoiceFields } = invoiceData;
      const updated: Invoice = {
        ...existing,
        ...invoiceFields,
        customerName: customer?.name ?? invoiceData.customerName ?? existing.customerName,
        customerEmail: customer?.email ?? invoiceData.customerEmail ?? existing.customerEmail,
        customerPhone: customer?.phone ?? invoiceData.customerPhone ?? existing.customerPhone,
        customerIdentificationType: customer?.identificationType ?? invoiceData.customerIdentificationType ?? existing.customerIdentificationType,
        customerIdentification: customer?.identificationNumber ?? invoiceData.customerIdentification ?? existing.customerIdentification,
        customerAddress: customer?.address ?? invoiceData.customerAddress ?? existing.customerAddress,
        items: invoiceData.items.map((item, index) => {
          const existingItem = existing.items?.find(invoiceItem => invoiceItem.productId === item.productId);
          const price = item.price ?? existingItem?.price ?? 0;
          return {
            id: existingItem?.id ?? -(Date.now() + index),
            invoiceId: id,
            productId: item.productId,
            quantity: item.quantity,
            price,
            total: price * item.quantity,
            createdAt: existingItem?.createdAt ?? now,
            updatedAt: now,
          };
        }),
        total: invoiceData.items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0),
        updatedAt: now,
      };
      await localDBService.saveInvoice(updated);
      await this.queueOfflineChange('actualizar_factura', { id, ...invoiceData }, existing.updatedAt);
      return updated;
    }
    const response = await this.api.put<{ invoice: Invoice }>(`/invoices/${id}`, invoiceData);
    await localDBService.saveInvoice(response.data.invoice);
    return response.data.invoice;
  }

  async deleteInvoice(id: number): Promise<Invoice> {
    if (this.isOffline()) {
      const existing = await localDBService.getInvoiceById(id);
      if (!existing) throw new Error('La factura no está guardada en este dispositivo.');
      const updated = { ...existing, status: 'cancelled' as const, updatedAt: new Date().toISOString() };
      await localDBService.saveInvoice(updated);
      await this.queueOfflineChange('delete_invoice', { id }, existing.updatedAt);
      return updated;
    }
    const response = await this.api.delete<{ invoice: Invoice }>(`/invoices/${id}`);
    await localDBService.saveInvoice(response.data.invoice);
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
    if (this.isOffline()) {
      const existing = await localDBService.getInvoiceById(id);
      if (!existing) throw new Error('La factura no está guardada en este dispositivo.');
      const now = new Date().toISOString();
      const updated: Invoice = {
        ...existing,
        status,
        ...paymentData,
        paidAt: status === 'paid' ? now : existing.paidAt,
        updatedAt: now,
      };
      await localDBService.saveInvoice(updated);
      await this.queueOfflineChange('actualizar_factura', { id, status, ...paymentData }, existing.updatedAt);
      return updated;
    }
    const response = await this.api.patch<{ invoice: Invoice }>(`/invoices/${id}/status`, {
      status,
      ...paymentData
    });
    await localDBService.saveInvoice(response.data.invoice);
    return response.data.invoice;
  }

  async sendInvoiceEmail(id: number, email?: string): Promise<Invoice> {
    if (this.isOffline()) throw new Error('El envío de facturas por correo requiere conexión a internet.');
    const response = await this.api.post<{ invoice: Invoice }>(`/invoices/${id}/send-email`, { email });
    return response.data.invoice;
  }

  async cancelInvoice(id: number): Promise<Invoice> {
    if (this.isOffline()) return this.deleteInvoice(id);
    const response = await this.api.post<{ invoice: Invoice }>(`/invoices/${id}/cancel`);
    await localDBService.saveInvoice(response.data.invoice);
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
    if (this.isOffline()) {
      const existing = (await localDBService.getAccounts()).find(account => account.id === id);
      if (!existing) throw new Error('La cuenta no está guardada en este dispositivo.');
      const pendingAmount = Math.max(0, Number(existing.pendingAmount || 0) - amount);
      const now = new Date().toISOString();
      const account = {
        ...existing,
        pendingAmount,
        status: pendingAmount === 0 ? 'paid' : existing.status,
        updatedAt: now,
      };
      const payment = {
        id: this.createLocalId(),
        accountsReceivableId: id,
        amount,
        paymentMethod: opts?.paymentMethod || 'cash',
        paymentReference: opts?.paymentReference,
        createdAt: now,
      };
      await localDBService.saveAccounts((await localDBService.getAccounts()).map(cachedAccount => cachedAccount.id === id ? account : cachedAccount));
      await this.queueOfflineChange('pagar_cuenta', { id, amount, ...opts }, existing.updatedAt as string | undefined);
      return { account, payment };
    }
    const body: any = { amount };
    if (opts?.paymentMethod) body.paymentMethod = opts.paymentMethod;
    if (opts?.paymentReference) body.paymentReference = opts.paymentReference;
    const response = await this.api.post(`/accounts-receivable/${id}/pay`, body);
    await localDBService.saveAccounts((await localDBService.getAccounts()).map(account => account.id === id ? response.data.account : account));
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
    if (this.isOffline()) {
      const user = this.getStoredUser();
      if (!user) throw new Error('No se encontró una sesión guardada para crear el pedido.');
      const now = new Date().toISOString();
      const order: Order = {
        ...orderData,
        id: this.createLocalId(),
        userId: user.id,
        status: 'pendiente',
        total: 0,
        createdAt: now,
        updatedAt: now,
        items: orderData.items.map(item => ({
          ...item,
          id: this.createLocalId(),
          orderId: 0,
          quantityProcessed: 0,
          quantityLoaded: 0,
          dispatchStatus: 'pendiente',
          status: 'pendiente',
          unitPrice: 0,
          createdAt: now,
          updatedAt: now,
        })),
      };
      await localDBService.saveOrder(order);
      await this.queueOfflineChange('crear_orden', { ...orderData, localId: order.id });
      return order;
    }
    const response = await this.api.post<{ order: Order }>('/orders', orderData);
    await localDBService.saveOrder(response.data.order);
    return response.data.order;
  }

  async updateOrder(id: number, orderData: Partial<Order>): Promise<Order> {
    if (this.isOffline()) {
      const existing = await localDBService.getOrderById(id);
      if (!existing) throw new Error('El pedido no está guardado en este dispositivo.');
      const updated = { ...existing, ...orderData, updatedAt: new Date().toISOString() };
      await localDBService.saveOrder(updated);
      await this.queueOfflineChange('actualizar_orden', { id, ...orderData }, existing.updatedAt);
      return updated;
    }
    const response = await this.api.put<{ order: Order }>(`/orders/${id}`, orderData);
    await localDBService.saveOrder(response.data.order);
    return response.data.order;
  }

  async updateOrderStatus(id: number, status: Order['status']): Promise<Order> {
    if (this.isOffline()) {
      const existing = await localDBService.getOrderById(id);
      if (!existing) throw new Error('El pedido no está guardado en este dispositivo.');
      const updated = { ...existing, status, updatedAt: new Date().toISOString() };
      await localDBService.saveOrder(updated);
      await this.queueOfflineChange(status === 'cancelado' ? 'cancelar_orden' : 'actualizar_orden', { id, status }, existing.updatedAt);
      return updated;
    }
    const response = await this.api.put<{ order: Order }>(`/orders/${id}/status`, { status });
    await localDBService.saveOrder(response.data.order);
    return response.data.order;
  }

  async updateOrderItemStatus(orderId: number, productId: number, data: { quantityProcessed: number }): Promise<OrderItem> {
    if (this.isOffline()) {
      const order = await localDBService.getOrderById(orderId);
      const item = order?.items?.find(orderItem => orderItem.productId === productId);
      if (!order || !item) throw new Error('El pedido o producto no está guardado en este dispositivo.');
      const quantityProcessed = item.quantityProcessed + data.quantityProcessed;
      if (quantityProcessed > item.quantityRequested) throw new Error('La cantidad procesada no puede superar la cantidad solicitada.');
      const now = new Date().toISOString();
      const updatedItem: OrderItem = {
        ...item,
        quantityProcessed,
        status: quantityProcessed === item.quantityRequested ? 'en_bodega' : 'en_transito',
        updatedAt: now,
      };
      await localDBService.saveOrder({
        ...order,
        updatedAt: now,
        items: order.items?.map(orderItem => orderItem.productId === productId ? updatedItem : orderItem),
      });
      await this.queueOfflineChange('actualizar_item_orden', { orderId, productId, ...data }, order.updatedAt);
      return updatedItem;
    }
    const response = await this.api.patch<{ item: OrderItem }>(`/orders/${orderId}/items/${productId}/status`, data);
    const order = await localDBService.getOrderById(orderId);
    if (order) {
      await localDBService.saveOrder({
        ...order,
        updatedAt: new Date().toISOString(),
        items: order.items?.map(item => item.productId === productId ? response.data.item : item),
      });
    }
    return response.data.item;
  }

  async updateDispatchLoad(orderId: number, orderItemId: number, quantityLoaded: number): Promise<OrderItem> {
    if (this.isOffline()) throw new Error('Debes conectarte para registrar cargas de bodega.');
    const response = await this.api.patch<{ item: OrderItem }>(
      `/orders/${orderId}/items/${orderItemId}/dispatch-load`,
      { quantityLoaded }
    );
    return response.data.item;
  }

  async markDispatchArrived(orderId: number, orderItemId: number): Promise<OrderItem> {
    if (this.isOffline()) throw new Error('Debes conectarte para registrar la llegada al local.');
    const response = await this.api.patch<{ item: OrderItem }>(
      `/orders/${orderId}/items/${orderItemId}/dispatch-arrival`
    );
    return response.data.item;
  }

  async cancelOrder(id: number): Promise<Order> {
    return this.updateOrderStatus(id, 'cancelado');
  }

  async deleteOrder(id: number): Promise<void> {
    if (this.isOffline()) {
      const existing = await localDBService.getOrderById(id);
      if (!existing) throw new Error('El pedido no está guardado en este dispositivo.');
      await localDBService.deleteOrder(id);
      await this.queueOfflineChange('delete_order', { id }, existing.updatedAt);
      return;
    }
    await this.api.delete(`/orders/${id}`);
    await localDBService.deleteOrder(id);
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
    if (this.isOffline()) {
      const now = new Date().toISOString();
      const customer: Customer = {
        ...data,
        id: this.createLocalId(),
        identificationNumber: data.identificationNumber === undefined ? undefined : String(data.identificationNumber),
        createdAt: now,
        updatedAt: now,
      };
      await localDBService.saveCustomer(customer);
      await this.queueOfflineChange('crear_cliente', { ...data, localId: customer.id });
      return customer;
    }
    const response = await this.api.post('/customers', data);
    await localDBService.saveCustomer(response.data);
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
    if (this.isOffline()) {
      const existing = await localDBService.getCustomerById(id);
      if (!existing) throw new Error('El cliente no está guardado en este dispositivo.');
      const updated: Customer = {
        ...existing,
        ...data,
        identificationNumber: data.identificationNumber === undefined ? existing.identificationNumber : String(data.identificationNumber),
        updatedAt: new Date().toISOString(),
      };
      await localDBService.saveCustomer(updated);
      await this.queueOfflineChange('actualizar_cliente', { id, ...data }, existing.updatedAt);
      return updated;
    }
    const response = await this.api.put(`/customers/${id}`, data);
    await localDBService.saveCustomer(response.data);
    return response.data;
  }

  async deleteCustomer(id: number): Promise<void> {
    if (this.isOffline()) {
      const existing = await localDBService.getCustomerById(id);
      if (!existing) throw new Error('El cliente no está guardado en este dispositivo.');
      await localDBService.deleteCustomer(id);
      await this.queueOfflineChange('eliminar_cliente', { id }, existing.updatedAt);
      return;
    }
    await this.api.delete(`/customers/${id}`);
    await localDBService.deleteCustomer(id);
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
    if (this.isOffline()) {
      const user = this.getStoredUser();
      if (!user) throw new Error('No se encontró una sesión guardada para registrar la visita.');
      const customer = await localDBService.getCustomerById(data.customerId);
      if (!customer) throw new Error('El cliente no está guardado en este dispositivo. Sincroniza los clientes antes de salir offline.');
      const activeVisits = await localDBService.getVisits();
      if (activeVisits.some(visit => visit.userId === user.id && !visit.departureAt)) {
        throw new Error('Finaliza la visita activa antes de iniciar otra.');
      }
      const now = new Date().toISOString();
      const visit: Visit = {
        ...data,
        id: this.createLocalId(),
        userId: user.id,
        arrivalAt: now,
        departureAt: null,
        durationSeconds: null,
        createdAt: now,
        updatedAt: now,
      };
      await localDBService.saveVisit(visit);
      await this.queueOfflineChange('iniciar_visita', { ...data, localId: visit.id });
      return visit;
    }
    const response = await this.api.post<{ visit: Visit }>('/visits', data);
    await localDBService.saveVisit(response.data.visit);
    return response.data.visit;
  }

  async finishVisit(id: number): Promise<Visit> {
    if (this.isOffline()) {
      const existing = await localDBService.getVisitById(id);
      if (!existing) throw new Error('La visita no está guardada en este dispositivo.');
      const departureAt = new Date().toISOString();
      const updated: Visit = {
        ...existing,
        departureAt,
        durationSeconds: Math.max(0, Math.floor((Date.parse(departureAt) - Date.parse(existing.arrivalAt)) / 1000)),
        updatedAt: departureAt,
      };
      await localDBService.saveVisit(updated);
      await this.queueOfflineChange('finalizar_visita', { id }, existing.updatedAt);
      return updated;
    }
    const response = await this.api.patch<{ visit: Visit }>(`/visits/${id}/end`);
    await localDBService.saveVisit(response.data.visit);
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
