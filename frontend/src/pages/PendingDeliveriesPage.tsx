import React, { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import type { Order, OrderItem } from '../../../shared/types';
import { useAppSelector } from '../hooks/redux';
import { usePermissions } from '../hooks/permissions';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';

type PendingDelivery = {
  order: Order;
  item: OrderItem;
  remaining: number;
};

type DraftInvoiceItem = {
  order: Order;
  orderItem: OrderItem;
  quantity: number;
  price: number;
};

const normalizeCustomerValue = (value?: string | null) => value?.trim().toLocaleLowerCase() || '';

const isSameCustomer = (firstOrder: Order, secondOrder: Order) => {
  const firstCustomerId = firstOrder.customer?.id;
  const secondCustomerId = secondOrder.customer?.id;
  if (firstCustomerId != null && secondCustomerId != null) {
    return String(firstCustomerId) === String(secondCustomerId);
  }

  const firstIdentification = normalizeCustomerValue(firstOrder.customer?.identificationNumber);
  const secondIdentification = normalizeCustomerValue(secondOrder.customer?.identificationNumber);
  if (firstIdentification && secondIdentification) {
    return firstIdentification === secondIdentification;
  }

  const firstName = normalizeCustomerValue(firstOrder.customer?.name || firstOrder.customerName);
  const secondName = normalizeCustomerValue(secondOrder.customer?.name || secondOrder.customerName);
  return Boolean(firstName && secondName && firstName === secondName);
};

const PendingDeliveriesPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const { user } = useAppSelector(state => state.auth);
  const canDispatch = hasPermission('actualizar_orden') || hasPermission('gestionar_items_orden') || user?.role === 'admin';
  const canCreateInvoice = hasPermission('crear_factura') || user?.role === 'admin';
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<DraftInvoiceItem[]>([]);
  const [invoiceNumberExternal, setInvoiceNumberExternal] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const orderData = isOnline ? (await apiService.getOrders()).orders : await localDBService.getOrders();
        if (active) setOrders(orderData);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las órdenes.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadOrders();
    return () => {
      active = false;
    };
  }, [isOnline, refreshKey]);

  const pendingDeliveries = useMemo<PendingDelivery[]>(() => {
    return orders
      .filter(order => order.type !== 'compra' && order.status !== 'cancelado')
      .flatMap(order =>
        (order.items || [])
          .map(item => ({ order, item, remaining: Math.max(0, item.quantityRequested - item.quantityProcessed) }))
          .filter(delivery => delivery.remaining > 0)
      );
  }, [orders]);

  const deliveriesByCustomer = useMemo(() => {
    const groups = new Map<string, { name: string; deliveries: PendingDelivery[] }>();
    pendingDeliveries.forEach(delivery => {
      const name = delivery.order.customer?.name || delivery.order.customerName || 'Cliente sin nombre';
      const normalizedName = name.trim().toLocaleLowerCase();
      const key = delivery.order.customer?.id
        ? `customer-${delivery.order.customer.id}`
        : name === 'Cliente sin nombre'
          ? `order-${delivery.order.id}`
          : `name-${normalizedName}`;
      const group = groups.get(key) || { name, deliveries: [] as PendingDelivery[] };
      group.deliveries.push(delivery);
      groups.set(key, group);
    });
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [pendingDeliveries]);

  const activeOrdersCount = orders.filter(order => order.type !== 'compra' && order.status !== 'cancelado').length;
  const pendingOrdersCount = new Set(pendingDeliveries.map(delivery => delivery.order.id)).size;
  const pendingUnitsCount = pendingDeliveries.reduce((total, delivery) => total + delivery.remaining, 0);

  const updateQuantity = (itemId: number, value: string) => {
    setQuantities(current => ({ ...current, [itemId]: value }));
  };

  const toggleItemDetails = (itemId: number) => {
    setExpandedItems(current => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleAddToInvoice = (delivery: PendingDelivery) => {
    if (!isOnline || !canDispatch || !canCreateInvoice || invoiceLoading) return;

    const quantity = Number(quantities[delivery.item.id] || delivery.remaining);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > delivery.remaining) {
      setError(`Ingresa una cantidad entera entre 1 y ${delivery.remaining}.`);
      setSuccess(null);
      return;
    }

    if (invoiceOrder && !isSameCustomer(invoiceOrder, delivery.order)) {
      setError('La pre-factura solo puede incluir productos del mismo cliente.');
      setSuccess(null);
      return;
    }

    if (invoiceItems.some(item => item.orderItem.id === delivery.item.id)) {
      setError('Este producto ya está agregado a la pre-factura.');
      setSuccess(null);
      return;
    }

    setError(null);
    setSuccess(null);
    setInvoiceOrder(delivery.order);
    setInvoiceItems(current => [
      ...current,
      {
        order: delivery.order,
        orderItem: delivery.item,
        quantity,
        price: Number(delivery.item.unitPrice || delivery.item.product?.price || 0)
      }
    ]);
    setQuantities(current => ({ ...current, [delivery.item.id]: '' }));
  };

  const handleRemoveInvoiceItem = (orderItemId: number) => {
    const remainingItems = invoiceItems.filter(item => item.orderItem.id !== orderItemId);
    setInvoiceItems(remainingItems);
    if (remainingItems.length === 0) setInvoiceOrder(null);
  };

  const handleCreateInvoice = async () => {
    if (!isOnline || !canDispatch || !canCreateInvoice || !invoiceOrder || invoiceItems.length === 0 || invoiceLoading) return;

    const externalNumber = invoiceNumberExternal.trim();
    if (!externalNumber) {
      setError('Ingresa el número de referencia de la factura.');
      setSuccess(null);
      return;
    }

    setInvoiceLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const customerOrder = invoiceItems.find(item => item.order.customer)?.order || invoiceOrder;
      const customer = customerOrder.customer;
      const invoice = await apiService.createInvoice({
        invoiceNumberExternal: `001-011-${String(externalNumber).padStart(10, '0')}`,
        documentType: customer?.name || customerOrder.customerName ? 'sales_note' : 'consumer_final',
        customer: {
          name: customer?.name || customerOrder.customerName || 'Cliente ocasional',
          email: customer?.email || undefined,
          phone: customer?.phone || undefined,
          identificationType: customer?.identificationType || 'none',
          identificationNumber: customer?.identificationNumber || undefined,
          address: customer?.address || customerOrder.customerAddress || undefined
        },
        items: invoiceItems.map(({ orderItem, quantity, price }) => ({
          productId: orderItem.productId,
          quantity,
          price,
          orderItemId: orderItem.id
        }))
      });

      const affectedOrderIds = Array.from(new Set(invoiceItems.map(item => item.order.id)));
      setSuccess(`Factura ${invoice.invoiceNumber || `#${invoice.id}`} creada con referencia ${externalNumber}. Se actualizaron el inventario y las órdenes ${affectedOrderIds.map(id => `#${id}`).join(', ')}.`);
      setInvoiceOrder(null);
      setInvoiceItems([]);
      setInvoiceNumberExternal('');
      setQuantities({});
      setRefreshKey(current => current + 1);
    } catch (invoiceError) {
      setError(
        isAxiosError<{ message?: string }>(invoiceError)
          ? invoiceError.response?.data?.message || invoiceError.message
          : invoiceError instanceof Error
            ? invoiceError.message
            : 'No se pudo crear la factura.'
      );
    } finally {
      setInvoiceLoading(false);
    }
  };

  const getOrderBadge = (status: Order['status']) => {
    const variants: Record<Order['status'], string> = {
      pendiente: 'warning',
      parcial: 'info',
      completado: 'success',
      cancelado: 'danger'
    };
    return <Badge bg={variants[status]}>{status}</Badge>;
  };

  return (
    <main className='container-fluid pending-deliveries-page'>
      <header className='pending-deliveries-header'>
        <div>
          <span className='eyebrow'>Operaciones</span>
          <h1 className='mt-2 mb-1'>Despachos pendientes</h1>
          <p className='mb-0'>Vista global de los productos por entregar, agrupados por cliente y orden.</p>
        </div>
        <Button variant='outline-primary' onClick={() => setRefreshKey(current => current + 1)} disabled={loading} aria-label='Actualizar órdenes'>
          Actualizar
        </Button>
      </header>

      {!isOnline && <Alert variant='warning'>Modo sin conexión: puedes consultar los datos guardados, pero no despachar.</Alert>}
      {!canDispatch && <Alert variant='info'>Tu usuario puede consultar los pendientes, pero no tiene permiso para despachar.</Alert>}
      {canDispatch && !canCreateInvoice && <Alert variant='info'>Para despachar productos desde este módulo también necesitas permiso para crear facturas.</Alert>}
      {error && <Alert variant='danger' dismissible onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant='success' dismissible onClose={() => setSuccess(null)}>{success}</Alert>}

      {invoiceOrder && invoiceItems.length > 0 && (
        <section className='border rounded bg-white p-3 mb-4' aria-label='Pre-factura'>
          <div className='d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3'>
            <div>
              <span className='pending-section-label'>Pre-factura</span>
              <h2 className='h5 mb-1'>{invoiceOrder.customer?.name || invoiceOrder.customerName || 'Cliente sin nombre'}</h2>
              <small className='text-muted'>
                Órdenes incluidas: {Array.from(new Set(invoiceItems.map(item => item.order.id))).map(id => `#${id}`).join(', ')}
              </small>
            </div>
            <strong>
              Total: ${invoiceItems.reduce((total, item) => total + item.quantity * item.price, 0).toFixed(2)}
            </strong>
          </div>
          <div className='table-responsive'>
            <table className='table table-sm align-middle'>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Orden</th>
                  <th>Cantidad</th>
                  <th>Precio unitario</th>
                  <th>Subtotal</th>
                  <th><span className='visually-hidden'>Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {invoiceItems.map(({ order, orderItem, quantity, price }) => (
                  <tr key={orderItem.id}>
                    <td>{orderItem.product?.name || `Producto #${orderItem.productId}`}</td>
                    <td>#{order.id}</td>
                    <td>{quantity}</td>
                    <td>${price.toFixed(2)}</td>
                    <td>${(quantity * price).toFixed(2)}</td>
                    <td>
                      <Button variant='outline-danger' size='sm' onClick={() => handleRemoveInvoiceItem(orderItem.id)} disabled={invoiceLoading}>
                        Retirar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Form.Group className='mb-3' controlId='invoiceNumberExternal'>
            <Form.Label>Número de referencia de la factura</Form.Label>
            <Form.Control
              value={invoiceNumberExternal}
              onChange={event => setInvoiceNumberExternal(event.target.value)}
              placeholder='123'
              required
              disabled={invoiceLoading}
            />
          </Form.Group>
          <Button variant='success' onClick={() => void handleCreateInvoice()} disabled={!isOnline || invoiceLoading || !invoiceNumberExternal.trim()}>
            {invoiceLoading ? <><Spinner animation='border' size='sm' className='me-2' />Creando factura...</> : 'Crear factura y confirmar despacho'}
          </Button>
        </section>
      )}

      <section className='pending-deliveries-stats' aria-label='Resumen de despachos'>
        <div className='pending-stat-card'>
          <span>Órdenes activas</span>
          <strong>{activeOrdersCount}</strong>
        </div>
        <div className='pending-stat-card'>
          <span>Órdenes con pendientes</span>
          <strong>{pendingOrdersCount}</strong>
        </div>
        <div className='pending-stat-card pending-stat-card--highlight'>
          <span>Unidades por entregar</span>
          <strong>{pendingUnitsCount}</strong>
        </div>
      </section>

      {loading ? (
        <div className='pending-deliveries-loading'><Spinner animation='border' role='status' /><span>Cargando órdenes...</span></div>
      ) : pendingDeliveries.length === 0 ? (
        <section className='pending-deliveries-empty'>
          <span aria-hidden='true'>✓</span>
          <h2 className='h5'>Todo al día</h2>
          <p className='mb-0'>No hay productos pendientes de entrega.</p>
        </section>
      ) : (
        <section className='pending-customer-list' aria-label='Productos pendientes por cliente'>
          {deliveriesByCustomer.map(customer => (
            <article className='pending-customer-card' key={customer.name + customer.deliveries[0].order.id}>
              <header className='pending-customer-heading'>
                <div>
                  <span className='pending-section-label'>Cliente</span>
                  <h2>{customer.name}</h2>
                </div>
                <Badge bg='primary'>{customer.deliveries.reduce((total, delivery) => total + delivery.remaining, 0)} pendientes</Badge>
              </header>

              <div className='pending-delivery-list'>
                {customer.deliveries.map(delivery => {
                  const expanded = expandedItems.has(delivery.item.id);
                  return (
                    <div className='pending-delivery-row' key={delivery.item.id}>
                      <div className='pending-delivery-main'>
                        <div className='pending-delivery-product'>
                          <strong>{delivery.item.product?.name || `Producto #${delivery.item.productId}`}</strong>
                          <span>{delivery.remaining} por entregar</span>
                        </div>
                        <div className='pending-delivery-order'>
                          <span>Orden #{delivery.order.id}</span>
                          <span>{delivery.order.type === 'venta al mayor' ? 'Venta al mayor' : 'Venta'}</span>
                        </div>
                        <div className='pending-delivery-actions'>
                          <Button variant='link' size='sm' className='pending-details-toggle' onClick={() => toggleItemDetails(delivery.item.id)} aria-expanded={expanded}>
                            {expanded ? 'Ver menos' : 'Ver más'}
                          </Button>
                          <Form.Control
                            className='pending-quantity-input'
                            type='number'
                            min={1}
                            max={delivery.remaining}
                            step={1}
                            aria-label={`Cantidad a despachar de ${delivery.item.product?.name || 'producto'}`}
                            value={quantities[delivery.item.id] ?? delivery.remaining}
                            onChange={event => updateQuantity(delivery.item.id, event.target.value)}
                            disabled={!isOnline || !canDispatch || !canCreateInvoice || invoiceLoading}
                          />
                          <Button
                            variant='primary'
                            onClick={() => handleAddToInvoice(delivery)}
                            disabled={!isOnline || !canDispatch || !canCreateInvoice || invoiceLoading}
                          >
                            Agregar a pre-factura
                          </Button>
                        </div>
                      </div>
                      <div className={`pending-delivery-details${expanded ? ' is-expanded' : ''}`}>
                        <span>Solicitado: <strong>{delivery.item.quantityRequested}</strong></span>
                        <span>Despachado: <strong>{delivery.item.quantityProcessed}</strong></span>
                        <span>Estado: {getOrderBadge(delivery.order.status)}</span>
                        <span>Fecha: <strong>{new Date(delivery.order.createdAt).toLocaleDateString()}</strong></span>
                        <span>Precio unitario: <strong>${Number(delivery.item.unitPrice || 0).toFixed(2)}</strong></span>
                        <span>Total de la orden: <strong>${Number(delivery.order.total || 0).toFixed(2)}</strong></span>
                        {delivery.item.product?.partnumber && <span>Código: <strong>{delivery.item.product.partnumber}</strong></span>}
                        {(delivery.order.customer?.phone || delivery.order.customerAddress || delivery.order.customer?.address) && (
                          <span className='pending-delivery-contact'>
                            Contacto: <strong>{delivery.order.customer?.phone || '—'}</strong>
                            {(delivery.order.customerAddress || delivery.order.customer?.address) && ` · ${delivery.order.customerAddress || delivery.order.customer.address}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
};

export default PendingDeliveriesPage;
