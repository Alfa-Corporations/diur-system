import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Product, Invoice, SyncEvent, Order } from '../../../shared/types';

/**
 * Base de datos local IndexedDB
 * Gestiona almacenamiento offline de datos
 */
export class LocalDatabase extends Dexie {
  products!: Table<Product>;
  invoices!: Table<Invoice>;
  orders!: Table<Order>;
  pendingSync!: Table<SyncEvent>;

  constructor() {
    super('DiurSystemDB');

    this.version(1).stores({
      products: 'id, name, sku, category, isActive, updatedAt',
      invoices: 'id, invoiceNumber, userId, status, total, createdAt, updatedAt',
      orders: 'id, userId, type, status, total, createdAt, updatedAt',
      pendingSync: 'id, type, timestamp, synced'
    });
  }
}

export const db = new LocalDatabase();

/**
 * Servicio de base de datos local
 * Proporciona métodos para gestionar datos offline
 */
class LocalDBService {
  private async syncPendingEventsMirror(): Promise<void> {
    const pendingEvents = await db.pendingSync.toArray();
    localStorage.setItem('pendingEvents', JSON.stringify(pendingEvents));
  }

  // Productos
  async saveProducts(products: Product[]): Promise<void> {
    await db.products.bulkPut(products);
  }

  async getProducts(): Promise<Product[]> {
    return await db.products.toArray();
  }

  async getProductById(id: number): Promise<Product | undefined> {
    return await db.products.get(id);
  }

  async saveProduct(product: Product): Promise<void> {
    await db.products.put(product);
  }

  async deleteProduct(id: number): Promise<void> {
    await db.products.delete(id);
  }

  // Facturas
  async saveInvoices(invoices: Invoice[]): Promise<void> {
    await db.invoices.bulkPut(invoices);
  }

  async getInvoices(): Promise<Invoice[]> {
    return await db.invoices.toArray();
  }

  async getInvoiceById(id: number): Promise<Invoice | undefined> {
    return await db.invoices.get(id);
  }

  async saveInvoice(invoice: Invoice): Promise<void> {
    await db.invoices.put(invoice);
  }

  async deleteInvoice(id: number): Promise<void> {
    await db.invoices.delete(id);
  }

  // Pedidos
  async saveOrders(orders: Order[]): Promise<void> {
    await db.orders.bulkPut(orders);
  }

  async getOrders(): Promise<Order[]> {
    return await db.orders.toArray();
  }

  async getOrderById(id: number): Promise<Order | undefined> {
    return await db.orders.get(id);
  }

  async saveOrder(order: Order): Promise<void> {
    await db.orders.put(order);
  }

  async deleteOrder(id: number): Promise<void> {
    await db.orders.delete(id);
  }

  // Eventos de sincronización pendientes
  async addPendingEvent(event: SyncEvent): Promise<void> {
    await db.pendingSync.put(event);
    await this.syncPendingEventsMirror();
  }

  async getPendingEvents(): Promise<SyncEvent[]> {
    const events = await db.pendingSync.toArray();
    return events.filter(event => !event.synced).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async markEventSynced(eventId: string): Promise<void> {
    await db.pendingSync.update(eventId, { synced: true });
    await this.syncPendingEventsMirror();
  }

  async removeSyncedEvents(): Promise<void> {
    const syncedEvents = await db.pendingSync.toArray();
    const syncedIds = syncedEvents.filter(event => event.synced).map(event => event.id);

    if (syncedIds.length > 0) {
      await db.pendingSync.bulkDelete(syncedIds);
    }

    await this.syncPendingEventsMirror();
  }

  async clearAllData(): Promise<void> {
    await db.products.clear();
    await db.invoices.clear();
    await db.pendingSync.clear();
    localStorage.removeItem('pendingEvents');
  }

  // Utilidades
  async getStorageInfo(): Promise<{ products: number; invoices: number; pendingEvents: number }> {
    const [productsCount, invoicesCount, pendingCount] = await Promise.all([db.products.count(), db.invoices.count(), db.pendingSync.count()]);

    return {
      products: productsCount,
      invoices: invoicesCount,
      pendingEvents: pendingCount
    };
  }
}

export default new LocalDBService();
