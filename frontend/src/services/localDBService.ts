import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Product, Invoice, SyncEvent, Order, Customer, Visit, User, Permission } from '../../../shared/types';

type CachedRecord = { id: number; [key: string]: unknown };
type Supplier = { id: number; name: string };

/**
 * Base de datos local IndexedDB
 * Gestiona almacenamiento offline de datos
 */
export class LocalDatabase extends Dexie {
  products!: Table<Product>;
  invoices!: Table<Invoice>;
  orders!: Table<Order>;
  customers!: Table<Customer>;
  visits!: Table<Visit>;
  accountsReceivable!: Table<CachedRecord>;
  users!: Table<User>;
  permissions!: Table<Permission>;
  suppliers!: Table<Supplier>;
  pendingSync!: Table<SyncEvent>;

  constructor() {
    super('DiurSystemDB');

    this.version(1).stores({
      products: 'id, name, partnumber, category, isActive, updatedAt',
      invoices: 'id, invoiceNumber, userId, status, total, createdAt, updatedAt',
      orders: 'id, userId, type, status, total, createdAt, updatedAt',
      pendingSync: 'id, type, timestamp, synced'
    });

    this.version(2).stores({
      products: 'id, name, partnumber, category, isActive, updatedAt',
      invoices: 'id, invoiceNumber, userId, status, total, createdAt, updatedAt',
      orders: 'id, userId, type, status, total, createdAt, updatedAt',
      customers: 'id, name, identificationNumber, updatedAt',
      visits: 'id, userId, customerId, visitDate, arrivalAt, departureAt',
      accountsReceivable: 'id, customerId, status, updatedAt',
      users: 'id, username, email, role, updatedAt',
      permissions: 'id, name',
      suppliers: 'id, name',
      pendingSync: 'id, type, timestamp, synced, status'
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

  async saveCustomers(customers: Customer[]): Promise<void> {
    await db.customers.bulkPut(customers);
  }

  async getCustomers(): Promise<Customer[]> {
    return db.customers.toArray();
  }

  async getCustomerById(id: number): Promise<Customer | undefined> {
    return db.customers.get(id);
  }

  async saveCustomer(customer: Customer): Promise<void> {
    await db.customers.put(customer);
  }

  async deleteCustomer(id: number): Promise<void> {
    await db.customers.delete(id);
  }

  async saveVisits(visits: Visit[]): Promise<void> {
    await db.visits.bulkPut(visits);
  }

  async getVisits(): Promise<Visit[]> {
    return db.visits.toArray();
  }

  async saveVisit(visit: Visit): Promise<void> {
    await db.visits.put(visit);
  }

  async getVisitById(id: number): Promise<Visit | undefined> {
    return db.visits.get(id);
  }

  async saveAccounts(accounts: CachedRecord[]): Promise<void> {
    await db.accountsReceivable.bulkPut(accounts);
  }

  async getAccounts(): Promise<CachedRecord[]> {
    return db.accountsReceivable.toArray();
  }

  async saveUsers(users: User[]): Promise<void> {
    await db.users.bulkPut(users);
  }

  async getUsers(): Promise<User[]> {
    return db.users.toArray();
  }

  async savePermissions(permissions: Permission[]): Promise<void> {
    await db.permissions.bulkPut(permissions);
  }

  async getPermissions(): Promise<Permission[]> {
    return db.permissions.toArray();
  }

  async saveSuppliers(suppliers: Supplier[]): Promise<void> {
    await db.suppliers.bulkPut(suppliers);
  }

  async getSuppliers(): Promise<Supplier[]> {
    return db.suppliers.toArray();
  }

  // Eventos de sincronización pendientes
  async addPendingEvent(event: SyncEvent): Promise<void> {
    await db.pendingSync.put(event);
    await this.syncPendingEventsMirror();
  }

  async getPendingEvents(): Promise<SyncEvent[]> {
    const events = await db.pendingSync.toArray();
    return events.filter(event => !event.synced && event.status !== 'conflict').sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getConflicts(): Promise<SyncEvent[]> {
    return db.pendingSync.where('status').equals('conflict').toArray();
  }

  async resolveConflict(eventId: string, resolution: 'server' | 'local', baseUpdatedAt?: string): Promise<void> {
    if (resolution === 'server') {
      await db.pendingSync.delete(eventId);
      await this.syncPendingEventsMirror();
      return;
    }

    await db.pendingSync.update(eventId, {
      status: 'pending',
      error: undefined,
      baseUpdatedAt,
    });
    await this.syncPendingEventsMirror();
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
    await db.transaction('rw', [
      db.products, db.invoices, db.orders, db.customers, db.visits,
      db.accountsReceivable, db.users, db.permissions, db.suppliers, db.pendingSync
    ], async () => {
      await Promise.all([
        db.products.clear(), db.invoices.clear(), db.orders.clear(), db.customers.clear(),
        db.visits.clear(), db.accountsReceivable.clear(), db.users.clear(),
        db.permissions.clear(), db.suppliers.clear(), db.pendingSync.clear()
      ]);
    });
    localStorage.removeItem('pendingEvents');
  }

  // Utilidades
  async getStorageInfo(): Promise<{ products: number; invoices: number; pendingEvents: number }> {
    const [productsCount, invoicesCount, pendingCount] = await Promise.all([db.products.count(), db.invoices.count(), db.pendingSync.where('synced').equals(0).count()]);

    return {
      products: productsCount,
      invoices: invoicesCount,
      pendingEvents: pendingCount
    };
  }
}

export default new LocalDBService();
