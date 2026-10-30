import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import type { Order, OrderItem } from '../../../shared/types';
import { useAppSelector } from '../hooks/redux';
import { usePermissions } from '../hooks/permissions';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';
import socketService from '../services/socketService';

type PendingDelivery = {
  order: Order;
  item: OrderItem;
  remaining: number;
};

const getFulfillmentStatus = (items: OrderItem[]): Order['status'] => {
  if (items.length > 0 && items.every(item => item.quantityProcessed >= item.quantityRequested)) return 'completado';
  if (items.some(item => item.quantityProcessed > 0)) return 'parcial';
  return 'pendiente';
};

const PendingDeliveriesPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const { user } = useAppSelector(state => state.auth);
  const canDispatch = hasPermission('actualizar_orden') || hasPermission('gestionar_items_orden') || user?.role === 'admin';
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [pendingItemId, setPendingItemId] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
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

  const handleDispatch = async (delivery: PendingDelivery) => {
    if (!isOnline || !canDispatch || pendingItemId !== null) return;

    const quantity = Number(quantities[delivery.item.id] || delivery.remaining);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > delivery.remaining) {
      setError(`Ingresa una cantidad entera entre 1 y ${delivery.remaining}.`);
      setSuccess(null);
      return;
    }

    setPendingItemId(delivery.item.id);
    setError(null);
    setSuccess(null);
    try {
      const updatedItem = await apiService.updateOrderItemStatus(delivery.order.id, delivery.item.productId, { quantityProcessed: quantity });
      socketService.emit('order_updated', {
        orderId: delivery.order.id,
        productId: delivery.item.productId,
        quantityProcessed: updatedItem.quantityProcessed,
        status: updatedItem.status
      });
      setOrders(current =>
        current.map(order => {
          if (order.id !== delivery.order.id) return order;
          const items = (order.items || []).map(item => (item.id === updatedItem.id ? { ...item, ...updatedItem, product: item.product } : item));
          return { ...order, items, status: getFulfillmentStatus(items) };
        })
      );
      setQuantities(current => ({ ...current, [delivery.item.id]: '' }));
      setSuccess(`${quantity} unidad(es) despachada(s) de ${delivery.item.product?.name || 'el producto'} — orden #${delivery.order.id}.`);
    } catch (dispatchError) {
      setError(dispatchError instanceof Error ? dispatchError.message : 'No se pudo despachar el producto.');
    } finally {
      setPendingItemId(null);
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
      {error && <Alert variant='danger' dismissible onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant='success' dismissible onClose={() => setSuccess(null)}>{success}</Alert>}

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
                  const dispatching = pendingItemId === delivery.item.id;
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
                            disabled={!isOnline || !canDispatch || pendingItemId !== null}
                          />
                          <Button
                            variant='primary'
                            onClick={() => void handleDispatch(delivery)}
                            disabled={!isOnline || !canDispatch || pendingItemId !== null}
                          >
                            {dispatching ? <Spinner animation='border' size='sm' /> : 'Despachar'}
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
