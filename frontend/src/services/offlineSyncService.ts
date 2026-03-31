import apiService from './apiService';
import localDBService from './localDBService';
import type { CreateInvoiceRequest, Invoice, Product, SyncEvent } from '../../../shared/types';

interface SyncFailure {
  eventId: string;
  error: string;
}

interface SyncResult {
  syncedEventIds: string[];
  failedEvents: SyncFailure[];
}

class OfflineSyncService {
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'No se pudo sincronizar el cambio pendiente.';
  }

  private extractLocalId(eventId: string, prefix: string): number | null {
    if (!eventId.startsWith(prefix)) {
      return null;
    }

    const match = eventId.slice(prefix.length).match(/^(\d+)/);
    if (!match) {
      return null;
    }

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private resolveMappedId(rawId: unknown, idMap: Map<number, number>): number {
    const parsed = Number(rawId);
    if (!Number.isFinite(parsed)) {
      throw new Error('El identificador del elemento pendiente no es válido.');
    }

    return idMap.get(parsed) ?? parsed;
  }

  private sanitizeProductPayload(data: Record<string, unknown>): Partial<Product> {
    const { id, localId, ...payload } = data;
    void id;
    void localId;
    return payload as Partial<Product>;
  }

  private buildInvoicePayload(data: Record<string, unknown>): CreateInvoiceRequest {
    return {
      documentType: data.documentType as CreateInvoiceRequest['documentType'],
      customer: data.customer as CreateInvoiceRequest['customer'],
      customerName: typeof data.customerName === 'string' ? data.customerName : undefined,
      customerEmail: typeof data.customerEmail === 'string' ? data.customerEmail : undefined,
      items: Array.isArray(data.items)
        ? data.items.map(item => {
            const parsedItem = item as { productId: number; quantity: number };
            return {
              productId: Number(parsedItem.productId),
              quantity: Number(parsedItem.quantity)
            };
          })
        : []
    };
  }

  private async refreshLocalSnapshots(): Promise<void> {
    const [{ products }, { invoices }] = await Promise.all([apiService.getProducts(), apiService.getInvoices()]);
    await Promise.all([localDBService.saveProducts(products), localDBService.saveInvoices(invoices)]);
  }

  async syncPendingChanges(): Promise<SyncResult> {
    const pendingEvents = (await localDBService.getPendingEvents()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const syncedEventIds: string[] = [];
    const failedEvents: SyncFailure[] = [];
    const productIdMap = new Map<number, number>();
    const invoiceIdMap = new Map<number, number>();

    for (const event of pendingEvents) {
      try {
        const payload = typeof event.data === 'object' && event.data !== null ? ({ ...event.data } as Record<string, unknown>) : {};

        switch (event.type) {
          case 'create_product': {
            const createdProduct = await apiService.createProduct(this.sanitizeProductPayload(payload) as Product);
            const localId = Number(payload.localId ?? this.extractLocalId(event.id, 'create_product_'));

            if (Number.isFinite(localId)) {
              productIdMap.set(localId, createdProduct.id);
              await localDBService.deleteProduct(localId);
            }

            await localDBService.saveProduct(createdProduct);
            break;
          }

          case 'update_product': {
            const targetId = this.resolveMappedId(payload.id, productIdMap);
            const updatedProduct = await apiService.updateProduct(targetId, this.sanitizeProductPayload(payload));
            await localDBService.saveProduct(updatedProduct);
            break;
          }

          case 'delete_product': {
            const targetId = this.resolveMappedId(payload.id, productIdMap);
            await apiService.deleteProduct(targetId);
            await localDBService.deleteProduct(targetId);
            break;
          }

          case 'create_invoice': {
            const invoicePayload = this.buildInvoicePayload(payload);
            let createdInvoice = await apiService.createInvoice(invoicePayload);
            const localId = Number(payload.localId ?? this.extractLocalId(event.id, 'create_invoice_'));

            if (payload.status === 'paid') {
              createdInvoice = await apiService.updateInvoiceStatus(createdInvoice.id, 'paid', {
                paymentMethod: payload.paymentMethod as Invoice['paymentMethod'],
                paymentReference: typeof payload.paymentReference === 'string' ? payload.paymentReference : undefined,
                amountReceived: typeof payload.amountReceived === 'number' ? payload.amountReceived : undefined,
                changeAmount: typeof payload.changeAmount === 'number' ? payload.changeAmount : undefined
              });
            }

            if (Number.isFinite(localId)) {
              invoiceIdMap.set(localId, createdInvoice.id);
              await localDBService.deleteInvoice(localId);
            }

            await localDBService.saveInvoice(createdInvoice);
            break;
          }

          case 'update_invoice': {
            const targetId = this.resolveMappedId(payload.id, invoiceIdMap);

            if (payload.status === 'paid') {
              const updatedInvoice = await apiService.updateInvoiceStatus(targetId, 'paid', {
                paymentMethod: payload.paymentMethod as Invoice['paymentMethod'],
                paymentReference: typeof payload.paymentReference === 'string' ? payload.paymentReference : undefined,
                amountReceived: typeof payload.amountReceived === 'number' ? payload.amountReceived : undefined,
                changeAmount: typeof payload.changeAmount === 'number' ? payload.changeAmount : undefined
              });
              await localDBService.saveInvoice(updatedInvoice);
              break;
            }

            const updatedInvoice = await apiService.updateInvoice(targetId, this.buildInvoicePayload(payload));
            await localDBService.saveInvoice(updatedInvoice);
            break;
          }

          case 'delete_invoice': {
            const targetId = this.resolveMappedId(payload.id, invoiceIdMap);
            const deletedInvoice = await apiService.deleteInvoice(targetId);
            await localDBService.saveInvoice(deletedInvoice);
            break;
          }

          default:
            throw new Error(`Tipo de evento no soportado: ${event.type}`);
        }

        await localDBService.markEventSynced(event.id);
        syncedEventIds.push(event.id);
      } catch (error) {
        failedEvents.push({
          eventId: event.id,
          error: this.getErrorMessage(error)
        });
      }
    }

    if (syncedEventIds.length > 0) {
      await localDBService.removeSyncedEvents();

      try {
        await this.refreshLocalSnapshots();
      } catch (error) {
        console.warn('No se pudo refrescar la base local después de sincronizar:', error);
      }
    }

    return { syncedEventIds, failedEvents };
  }
}

export default new OfflineSyncService();
