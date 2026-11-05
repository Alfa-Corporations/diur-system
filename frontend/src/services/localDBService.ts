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
  private readonly ownerStorageKey = 'diurOfflineCacheOwner';

  private async assertCurrentOwner(): Promise<void> {
    const storedUser = localStorage.getItem('authUser');
    if (!storedUser) throw new Error('No hay una cuenta autenticada para acceder a los datos offline.');
    let user: User;
    try {
      user = JSON.parse(storedUser) as User;
    } catch (error) {
      console.error('Could not read the offline user session:', error);
      throw new Error('La sesión local no es válida; conéctate para iniciar sesión nuevamente.');
    }

    const storedOwner = localStorage.getItem(this.ownerStorageKey);
    if (!storedOwner) {
      await this.ensureOwner(user.id);
      return;
    }
    if (Number(storedOwner) !== user.id) {
      throw new Error('Los datos offline pertenecen a otra cuenta. Conéctate e inicia sesión con la cuenta propietaria para sincronizarlos.');
    }
  }

  async ensureOwner(userId: number): Promise<void> {
    const storedOwner = localStorage.getItem(this.ownerStorageKey);
    if (storedOwner && Number(storedOwner) === userId) return;

    const pendingCount = (await db.pendingSync.toArray()).filter(event => !event.synced).length;
    if (storedOwner && pendingCount > 0) {
      throw new Error('Hay cambios offline pendientes de otra cuenta. Inicia sesión con esa cuenta y sincronízalos antes de cambiar de usuario.');
    }

    await db.transaction('rw', [
      db.products, db.invoices, db.orders, db.customers, db.visits,
      db.accountsReceivable, db.users, db.permissions, db.suppliers
    ], async () => {
      await Promise.all([
        db.products.clear(), db.invoices.clear(), db.orders.clear(), db.customers.clear(),
        db.visits.clear(), db.accountsReceivable.clear(), db.users.clear(),
        db.permissions.clear(), db.suppliers.clear()
      ]);
    });
    localStorage.setItem(this.ownerStorageKey, String(userId));
  }

  private async syncPendingEventsMirror(): Promise<void> {
    const pendingEvents = await db.pendingSync.toArray();
    localStorage.setItem('pendingEvents', JSON.stringify(pendingEvents));
  }

  // Productos
  async saveProducts(products: Product[]): Promise<void> {
    await this.assertCurrentOwner();
    await db.products.bulkPut(products);
  }

  async getProducts(): Promise<Product[]> {
    await this.assertCurrentOwner();
    return await db.products.toArray();
  }

  async getProductById(id: number): Promise<Product | undefined> {
    await this.assertCurrentOwner();
    return await db.products.get(id);
  }

  async saveProduct(product: Product): Promise<void> {
    await this.assertCurrentOwner();
    await db.products.put(product);
  }

  async deleteProduct(id: number): Promise<void> {
    await this.assertCurrentOwner();
    await db.products.delete(id);
  }

  // Facturas
  async saveInvoices(invoices: Invoice[]): Promise<void> {
    await this.assertCurrentOwner();
    await db.invoices.bulkPut(invoices);
  }

  async getInvoices(): Promise<Invoice[]> {
    await this.assertCurrentOwner();
    return await db.invoices.toArray();
  }

  async getInvoiceById(id: number): Promise<Invoice | undefined> {
    await this.assertCurrentOwner();
    return await db.invoices.get(id);
  }

  async saveInvoice(invoice: Invoice): Promise<void> {
    await this.assertCurrentOwner();
    await db.invoices.put(invoice);
  }

  async deleteInvoice(id: number): Promise<void> {
    await this.assertCurrentOwner();
    await db.invoices.delete(id);
  }

  // Pedidos
  async saveOrders(orders: Order[]): Promise<void> {
    await this.assertCurrentOwner();
    await db.orders.bulkPut(orders);
  }

  async getOrders(): Promise<Order[]> {
    await this.assertCurrentOwner();
    return await db.orders.toArray();
  }

  async getOrderById(id: number): Promise<Order | undefined> {
    await this.assertCurrentOwner();
    return await db.orders.get(id);
  }

  async saveOrder(order: Order): Promise<void> {
    await this.assertCurrentOwner();
    await db.orders.put(order);
  }

  async deleteOrder(id: number): Promise<void> {
    await this.assertCurrentOwner();
    await db.orders.delete(id);
  }

  async saveCustomers(customers: Customer[]): Promise<void> {
    await this.assertCurrentOwner();
    await db.customers.bulkPut(customers);
  }

  async getCustomers(): Promise<Customer[]> {
    await this.assertCurrentOwner();
    return db.customers.toArray();
  }

  async getCustomerById(id: number): Promise<Customer | undefined> {
    await this.assertCurrentOwner();
    return db.customers.get(id);
  }

  async saveCustomer(customer: Customer): Promise<void> {
    await this.assertCurrentOwner();
    await db.customers.put(customer);
  }

  async deleteCustomer(id: number): Promise<void> {
    await this.assertCurrentOwner();
    await db.customers.delete(id);
  }

  async saveVisits(visits: Visit[]): Promise<void> {
    await this.assertCurrentOwner();
    await db.visits.bulkPut(visits);
  }

  async getVisits(): Promise<Visit[]> {
    await this.assertCurrentOwner();
    return db.visits.toArray();
  }

  async saveVisit(visit: Visit): Promise<void> {
    await this.assertCurrentOwner();
    await db.visits.put(visit);
  }

  async getVisitById(id: number): Promise<Visit | undefined> {
    await this.assertCurrentOwner();
    return db.visits.get(id);
  }

  async deleteVisit(id: number): Promise<void> {
    await this.assertCurrentOwner();
    await db.visits.delete(id);
  }

  async saveAccounts(accounts: CachedRecord[]): Promise<void> {
    await this.assertCurrentOwner();
    await db.accountsReceivable.bulkPut(accounts);
  }

  async getAccounts(): Promise<CachedRecord[]> {
    await this.assertCurrentOwner();
    return db.accountsReceivable.toArray();
  }

  async saveUsers(users: User[]): Promise<void> {
    await this.assertCurrentOwner();
    await db.users.bulkPut(users);
  }

  async getUsers(): Promise<User[]> {
    await this.assertCurrentOwner();
    return db.users.toArray();
  }

  async savePermissions(permissions: Permission[]): Promise<void> {
    await this.assertCurrentOwner();
    await db.permissions.bulkPut(permissions);
  }

  async getPermissions(): Promise<Permission[]> {
    await this.assertCurrentOwner();
    return db.permissions.toArray();
  }

  async saveSuppliers(suppliers: Supplier[]): Promise<void> {
    await this.assertCurrentOwner();
    await db.suppliers.bulkPut(suppliers);
  }

  async getSuppliers(): Promise<Supplier[]> {
    await this.assertCurrentOwner();
    return db.suppliers.toArray();
  }

  // Eventos de sincronización pendientes
  async addPendingEvent(event: SyncEvent): Promise<void> {
    await this.assertCurrentOwner();
    await db.pendingSync.put(event);
    await this.syncPendingEventsMirror();
  }

  async getPendingEvents(): Promise<SyncEvent[]> {
    await this.assertCurrentOwner();
    const events = await db.pendingSync.toArray();
    return events.filter(event => !event.synced && event.status !== 'conflict').sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getConflicts(): Promise<SyncEvent[]> {
    await this.assertCurrentOwner();
    return db.pendingSync.where('status').equals('conflict').toArray();
  }

  async markEventConflict(eventId: string, message: string): Promise<void> {
    await this.assertCurrentOwner();
    await db.pendingSync.update(eventId, { status: 'conflict', error: message });
    await this.syncPendingEventsMirror();
  }

  async resolveConflict(eventId: string, resolution: 'server' | 'local', baseUpdatedAt?: string): Promise<void> {
    await this.assertCurrentOwner();
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
    await this.assertCurrentOwner();
    await db.pendingSync.update(eventId, { synced: true });
    await this.syncPendingEventsMirror();
  }

  async removeSyncedEvents(): Promise<void> {
    await this.assertCurrentOwner();
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
    const [productsCount, invoicesCount, allEvents] = await Promise.all([db.products.count(), db.invoices.count(), db.pendingSync.toArray()]);

    return {
      products: productsCount,
      invoices: invoicesCount,
      pendingEvents: allEvents.filter(event => !event.synced).length
    };
  }
}

export default new LocalDBService();
