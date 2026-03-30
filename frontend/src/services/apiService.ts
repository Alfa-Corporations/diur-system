import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { store } from '../redux/store';
import { logout } from '../redux/slices/authSlice';
import type { LoginRequest, LoginResponse, RegisterRequest, CreateProductRequest, User, Product, Invoice } from '../../../shared/types';

/**
 * Servicio API
 * Cliente HTTP configurado para comunicarse con el backend
 */
class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1',
      timeout: 10000,
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
    const response = await this.api.post<User>('/auth/register', userData);
    return response.data;
  }

  async getProfile(): Promise<User> {
    const response = await this.api.get<User>('/auth/profile');
    return response.data;
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

  async createInvoice(invoiceData: { items: Array<{ productId: number; quantity: number }>; customerName?: string; customerEmail?: string }): Promise<Invoice> {
    const response = await this.api.post<{ invoice: Invoice }>('/invoices', invoiceData);
    return response.data.invoice;
  }

  async updateInvoice(id: number, invoiceData: { items: Array<{ productId: number; quantity: number }>; customerName?: string; customerEmail?: string }): Promise<Invoice> {
    const response = await this.api.put<{ invoice: Invoice }>(`/invoices/${id}`, invoiceData);
    return response.data.invoice;
  }

  async deleteInvoice(id: number): Promise<void> {
    await this.api.delete(`/invoices/${id}`);
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

  async cancelInvoice(id: number): Promise<Invoice> {
    const response = await this.api.post<{ invoice: Invoice }>(`/invoices/${id}/cancel`);
    return response.data.invoice;
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
