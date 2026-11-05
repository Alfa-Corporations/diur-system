import apiService from './apiService';
import localDBService from './localDBService';
import type { CreateInvoiceRequest, Customer, Invoice, Order, Product, SyncEvent, User, Visit } from '../../../shared/types';

interface SyncFailure {
  eventId: string;
  error: string;
}

interface SyncResult {
  syncedEventIds: string[];
  failedEvents: SyncFailure[];
}

type EntityIdMap = Map<number, number>;

class OfflineSyncService {
  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'No se pudo sincronizar el cambio pendiente.';
  }

  private getPayload(event: SyncEvent): Record<string, unknown> {
    return typeof event.data === 'object' && event.data !== null
      ? { ...event.data } as Record<string, unknown>
      : {};
  }

  private resolveId(rawId: unknown, idMap: EntityIdMap): number {
    const parsed = Number(rawId);
    if (!Number.isSafeInteger(parsed) || parsed === 0) {
      throw new Error('El identificador del cambio pendiente no es válido.');
    }
    return idMap.get(parsed) ?? parsed;
  }

  private async findRemoteUpdatedAt(event: SyncEvent, id: number): Promise<string | undefined> {
    if (event.type.includes('producto') || event.type === 'actualizar_stock') {
      return (await apiService.getProducts()).products.find(record => record.id === id)?.updatedAt;
    }
    if (event.type.includes('cliente')) {
      return (await apiService.getCustomers()).customers.find(record => record.id === id)?.updatedAt;
    }
    if (event.type.includes('orden') || event.type === 'delete_order' || event.type === 'cancelar_orden') {
      return (await apiService.getOrders()).orders.find(record => record.id === id)?.updatedAt;
    }
    if (event.type.includes('factura') || event.type === 'delete_invoice') {
      return (await apiService.getInvoices()).invoices.find(record => record.id === id)?.updatedAt;
    }
    if (event.type.includes('visita')) {
      return (await apiService.getVisits()).find(record => record.id === id)?.updatedAt;
    }
    if (event.type === 'pagar_cuenta') {
      const accounts = (await apiService.getAccountsReceivable()).accounts;
      return accounts.find(record => Number(record.id) === id)?.updatedAt as string | undefined;
    }
    if (event.type.includes('usuario') || event.type === 'asignar_permisos') {
      return (await apiService.getUsers()).find(record => record.id === id)?.updatedAt;
    }
    return undefined;
  }

  private async ensureNoConflict(event: SyncEvent, targetId: number, locallyCreated: EntityIdMap): Promise<void> {
    if (!event.baseUpdatedAt || locallyCreated.has(Number(this.getPayload(event).id ?? this.getPayload(event).orderId))) return;
    const currentUpdatedAt = await this.findRemoteUpdatedAt(event, targetId);
    const baseTime = Date.parse(event.baseUpdatedAt);
    const currentTime = currentUpdatedAt ? Date.parse(currentUpdatedAt) : Number.NaN;
    if (!Number.isFinite(baseTime) || !Number.isFinite(currentTime) || baseTime !== currentTime) {
      throw new Error('CONFLICT: El registro cambió en el servidor desde que se guardó este cambio. Elige conservar el servidor o volver a aplicar el cambio offline.');
    }
  }

  private async syncEvent(
    event: SyncEvent,
    productIds: EntityIdMap,
    invoiceIds: EntityIdMap,
    customerIds: EntityIdMap,
    orderIds: EntityIdMap,
    visitIds: EntityIdMap,
    userIds: EntityIdMap
  ): Promise<void> {
    const data = this.getPayload(event);

    switch (event.type) {
      case 'crear_producto': {
        const { localId, ...productData } = data;
        const product = await apiService.createProduct({
          name: String(productData.name ?? ''),
          description: typeof productData.description === 'string' ? productData.description : undefined,
          price: Number(productData.price),
          stock: Number(productData.stock),
          category: typeof productData.category === 'string' ? productData.category : undefined,
          partnumber: String(productData.partnumber ?? ''),
          codigo1: typeof productData.codigo1 === 'string' ? productData.codigo1 : undefined,
          codigo2: typeof productData.codigo2 === 'string' ? productData.codigo2 : undefined,
          codigo3: typeof productData.codigo3 === 'string' ? productData.codigo3 : undefined,
          codigo4: typeof productData.codigo4 === 'string' ? productData.codigo4 : undefined,
          codigo5: typeof productData.codigo5 === 'string' ? productData.codigo5 : undefined,
        });
        const temporaryId = Number(localId);
        if (Number.isSafeInteger(temporaryId)) {
          productIds.set(temporaryId, product.id);
          await localDBService.deleteProduct(temporaryId);
        }
        await localDBService.saveProduct(product);
        return;
      }
      case 'actualizar_producto': {
        const id = this.resolveId(data.id, productIds);
        await this.ensureNoConflict(event, id, productIds);
        await localDBService.saveProduct(await apiService.updateProduct(id, data as Partial<Product>));
        return;
      }
      case 'actualizar_stock': {
        const id = this.resolveId(data.id, productIds);
        await this.ensureNoConflict(event, id, productIds);
        await apiService.updateStock(id, Number(data.quantity));
        return;
      }
      case 'eliminar_producto': {
        const id = this.resolveId(data.id, productIds);
        await this.ensureNoConflict(event, id, productIds);
        await apiService.deleteProduct(id);
        return;
      }
      case 'crear_cliente': {
        const { localId, ...customerData } = data;
        const customer = await apiService.createCustomer(customerData as Omit<Customer, 'id'>);
        const temporaryId = Number(localId);
        if (Number.isSafeInteger(temporaryId)) {
          customerIds.set(temporaryId, customer.id);
          await localDBService.deleteCustomer(temporaryId);
        }
        await localDBService.saveCustomer(customer);
        return;
      }
      case 'actualizar_cliente': {
        const id = this.resolveId(data.id, customerIds);
        await this.ensureNoConflict(event, id, customerIds);
        const { id: ignoredId, ...changes } = data;
        void ignoredId;
        await apiService.updateCustomer(id, changes as Parameters<typeof apiService.updateCustomer>[1]);
        return;
      }
      case 'eliminar_cliente': {
        const id = this.resolveId(data.id, customerIds);
        await this.ensureNoConflict(event, id, customerIds);
        await apiService.deleteCustomer(id);
        return;
      }
      case 'crear_orden': {
        const { localId, ...orderData } = data;
        const dto = {
          ...orderData,
          customerId: orderData.customerId === undefined ? undefined : this.resolveId(orderData.customerId, customerIds),
          items: Array.isArray(orderData.items)
            ? orderData.items.map(item => {
                const orderItem = item as { productId: number; quantityRequested: number };
                return { ...orderItem, productId: this.resolveId(orderItem.productId, productIds) };
              })
            : [],
        };
        const order = await apiService.createOrder(dto as Parameters<typeof apiService.createOrder>[0]);
        const temporaryId = Number(localId);
        if (Number.isSafeInteger(temporaryId)) {
          orderIds.set(temporaryId, order.id);
          await localDBService.deleteOrder(temporaryId);
        }
        await localDBService.saveOrder(order);
        return;
      }
      case 'actualizar_orden':
      case 'cancelar_orden': {
        const id = this.resolveId(data.id ?? data.orderId, orderIds);
        await this.ensureNoConflict(event, id, orderIds);
        if (data.productId !== undefined) {
          await apiService.updateOrderItemStatus(id, this.resolveId(data.productId, productIds), {
            quantityProcessed: Number(data.quantityProcessed),
          });
          return;
        }
        await apiService.updateOrderStatus(id, data.status as Order['status']);
        return;
      }
      case 'actualizar_item_orden': {
        const id = this.resolveId(data.orderId, orderIds);
        await this.ensureNoConflict(event, id, orderIds);
        await apiService.updateOrderItemStatus(id, this.resolveId(data.productId, productIds), {
          quantityProcessed: Number(data.quantityProcessed),
        });
        return;
      }
      case 'delete_order': {
        const id = this.resolveId(data.id, orderIds);
        await this.ensureNoConflict(event, id, orderIds);
        await apiService.deleteOrder(id);
        return;
      }
      case 'crear_factura': {
        const { localId, ...invoiceData } = data;
        const rawPayload = invoiceData as unknown as CreateInvoiceRequest;
        const invoice = await apiService.createInvoice({
          ...rawPayload,
          items: (rawPayload.items || []).map(item => ({
            ...item,
            productId: this.resolveId(item.productId, productIds),
          })),
        });
        const temporaryId = Number(localId);
        if (Number.isSafeInteger(temporaryId)) {
          invoiceIds.set(temporaryId, invoice.id);
          await localDBService.deleteInvoice(temporaryId);
        }
        let savedInvoice = invoice;
        if (data.status === 'paid' && invoice.status !== 'paid') {
          savedInvoice = await apiService.updateInvoiceStatus(invoice.id, 'paid', {
            paymentMethod: data.paymentMethod as Invoice['paymentMethod'],
            paymentReference: typeof data.paymentReference === 'string' ? data.paymentReference : undefined,
            amountReceived: typeof data.amountReceived === 'number' ? data.amountReceived : undefined,
            changeAmount: typeof data.changeAmount === 'number' ? data.changeAmount : undefined,
          });
        }
        await localDBService.saveInvoice(savedInvoice);
        return;
      }
      case 'actualizar_factura': {
        const id = this.resolveId(data.id, invoiceIds);
        await this.ensureNoConflict(event, id, invoiceIds);
        if (data.status === 'paid') {
          await apiService.updateInvoiceStatus(id, 'paid', {
            paymentMethod: data.paymentMethod as Invoice['paymentMethod'],
            paymentReference: typeof data.paymentReference === 'string' ? data.paymentReference : undefined,
            amountReceived: typeof data.amountReceived === 'number' ? data.amountReceived : undefined,
            changeAmount: typeof data.changeAmount === 'number' ? data.changeAmount : undefined,
          });
        } else {
          const invoiceData = data as unknown as CreateInvoiceRequest;
          await apiService.updateInvoice(id, {
            ...invoiceData,
            items: (invoiceData.items || []).map(item => ({
              ...item,
              productId: this.resolveId(item.productId, productIds),
            })),
          });
        }
        return;
      }
      case 'delete_invoice': {
        const id = this.resolveId(data.id, invoiceIds);
        await this.ensureNoConflict(event, id, invoiceIds);
        await apiService.deleteInvoice(id);
        return;
      }
      case 'iniciar_visita': {
        const { localId, ...visitData } = data;
        const visit = await apiService.startVisit({
          ...(visitData as Omit<Visit, 'id' | 'userId' | 'arrivalAt' | 'createdAt' | 'updatedAt'>),
          customerId: this.resolveId(visitData.customerId, customerIds),
        });
        const temporaryId = Number(localId);
        if (Number.isSafeInteger(temporaryId)) {
          visitIds.set(temporaryId, visit.id);
          await localDBService.deleteVisit(temporaryId);
        }
        await localDBService.saveVisit(visit);
        return;
      }
      case 'finalizar_visita': {
        const id = this.resolveId(data.id, visitIds);
        await this.ensureNoConflict(event, id, visitIds);
        await apiService.finishVisit(id);
        return;
      }
      case 'pagar_cuenta': {
        const id = this.resolveId(data.id, new Map());
        await this.ensureNoConflict(event, id, new Map());
        await apiService.payAccountReceivable(id, Number(data.amount), {
          paymentMethod: typeof data.paymentMethod === 'string' ? data.paymentMethod : undefined,
          paymentReference: typeof data.paymentReference === 'string' ? data.paymentReference : undefined,
        });
        return;
      }
      case 'crear_usuario': {
        const user = await apiService.createUser(data as Omit<Parameters<typeof apiService.createUser>[0], 'password'>);
        const localId = Number(data.localId);
        if (Number.isSafeInteger(localId)) userIds.set(localId, user.id);
        return;
      }
      case 'actualizar_usuario': {
        const id = this.resolveId(data.id, userIds);
        await this.ensureNoConflict(event, id, userIds);
        const { id: ignoredId, ...changes } = data;
        void ignoredId;
        await apiService.updateUser(id, changes as Parameters<typeof apiService.updateUser>[1]);
        return;
      }
      case 'eliminar_usuario': {
        const id = this.resolveId(data.id, userIds);
        await this.ensureNoConflict(event, id, userIds);
        await apiService.deleteUser(id);
        return;
      }
      case 'asignar_permisos': {
        const id = this.resolveId(data.userId, userIds);
        await this.ensureNoConflict(event, id, userIds);
        await apiService.assignPermissions(id, (data.permissionIds as number[]) || []);
        return;
      }
    }
  }

  async syncPendingChanges(): Promise<SyncResult> {
    const pendingEvents = await localDBService.getPendingEvents();
    const syncedEventIds: string[] = [];
    const failedEvents: SyncFailure[] = [];
    const productIds: EntityIdMap = new Map();
    const invoiceIds: EntityIdMap = new Map();
    const customerIds: EntityIdMap = new Map();
    const orderIds: EntityIdMap = new Map();
    const visitIds: EntityIdMap = new Map();
    const userIds: EntityIdMap = new Map();

    for (const event of pendingEvents) {
      try {
        await this.syncEvent(event, productIds, invoiceIds, customerIds, orderIds, visitIds, userIds);
        await localDBService.markEventSynced(event.id);
        syncedEventIds.push(event.id);
      } catch (error) {
        const message = this.getErrorMessage(error);
        if (message.startsWith('CONFLICT:')) {
          await localDBService.markEventConflict(event.id, message.slice('CONFLICT:'.length).trim());
        }
        failedEvents.push({ eventId: event.id, error: message });
      }
    }

    if (syncedEventIds.length > 0) await localDBService.removeSyncedEvents();
    return { syncedEventIds, failedEvents };
  }

  async refreshLocalSnapshots(user: User): Promise<string[]> {
    const permissions = new Set((user.permissions || []).map(permission => permission.name));
    const can = (...names: string[]) => user.role === 'admin' || names.some(name => permissions.has(name));
    const tasks: Array<Promise<unknown>> = [];

    if (can('leer_producto', 'gestionar_productos')) tasks.push(apiService.getProducts());
    if (can('leer_factura')) {
      tasks.push(apiService.getInvoices());
      tasks.push(apiService.getAccountsReceivable());
    }
    if (can('leer_orden')) tasks.push(apiService.getOrders());
    if (can('leer_clientes')) tasks.push(apiService.getCustomers());
    if (can('leer_visitas')) tasks.push(apiService.getVisits());
    if (can('leer_usuario', 'gestionar_usuarios', 'crud_users')) tasks.push(apiService.getUsers());
    if (can('gestionar_permisos')) tasks.push(apiService.getPermissions());
    if (can('leer_producto', 'gestionar_productos')) tasks.push(apiService.getSuppliers());

    const results = await Promise.allSettled(tasks);
    return results.flatMap(result => result.status === 'rejected' ? [this.getErrorMessage(result.reason)] : []);
  }

  async resolveConflict(event: SyncEvent, resolution: 'server' | 'local'): Promise<void> {
    if (resolution === 'server') {
      await localDBService.resolveConflict(event.id, 'server');
      return;
    }

    const data = this.getPayload(event);
    const id = Number(data.id ?? data.orderId ?? data.userId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('No se puede volver a aplicar un registro provisional en conflicto.');
    }
    const latestUpdatedAt = await this.findRemoteUpdatedAt(event, id);
    if (!latestUpdatedAt) throw new Error('No se encontró la versión actual del servidor.');
    await localDBService.resolveConflict(event.id, 'local', latestUpdatedAt);
  }
}

export default new OfflineSyncService();
