import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import type { Order } from '../../../shared/types';
import apiService from '../services/apiService';

type DispatchLine = {
  order: Order;
  item: NonNullable<Order['items']>[number];
  remaining: number;
};

const OrderDispatchPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
      setError('');
      try {
        const result = await apiService.getOrders();
        if (active) setOrders(result.orders);
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
  }, [refreshKey]);

  const lines = useMemo<DispatchLine[]>(() => orders
    .filter(order => order.type !== 'compra' && order.status !== 'cancelado')
    .flatMap(order => (order.items || [])
      .map(item => ({
        order,
        item,
        remaining: Math.max(0, Number(item.quantityRequested) - Number(item.quantityProcessed)),
      }))
      .filter(({ item, remaining }) =>
        remaining > 0 && (item.dispatchStatus === 'pendiente' || item.dispatchStatus === 'cargando')
      )), [orders]);

  const readyLines = useMemo<DispatchLine[]>(() => orders
    .filter(order => order.type !== 'compra' && order.status !== 'cancelado')
    .flatMap(order => (order.items || [])
      .map(item => ({
        order,
        item,
        remaining: Math.max(0, Number(item.quantityRequested) - Number(item.quantityProcessed)),
      }))
      .filter(({ item }) => item.dispatchStatus === 'en_local' && Number(item.quantityLoaded) > 0)), [orders]);

  const registerLoad = async (line: DispatchLine) => {
    const value = quantities[line.item.id] ?? String(line.item.quantityLoaded || 0);
    const quantityLoaded = Number(value);
    if (!Number.isSafeInteger(quantityLoaded) || quantityLoaded < 0 || quantityLoaded > line.remaining) {
      setError(`Ingresa una cantidad entera entre 0 y ${line.remaining}.`);
      setNotice('');
      return;
    }

    setBusyItem(line.item.id);
    setError('');
    setNotice('');
    try {
      const updatedItem = await apiService.updateDispatchLoad(line.order.id, line.item.id, quantityLoaded);
      setOrders(current => current.map(order => order.id !== line.order.id ? order : {
        ...order,
        items: order.items?.map(item => item.id === updatedItem.id ? updatedItem : item),
      }));
      setQuantities(current => ({ ...current, [line.item.id]: String(updatedItem.quantityLoaded) }));
      setNotice(quantityLoaded > 0
        ? `${quantityLoaded} unidad(es) de ${line.item.product?.name || 'producto'} registradas en carga.`
        : 'Se canceló la carga de este producto y se liberó la reserva de inventario.');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo registrar la carga.');
    } finally {
      setBusyItem(null);
    }
  };

  const markArrival = async (line: DispatchLine) => {
    setBusyItem(line.item.id);
    setError('');
    setNotice('');
    try {
      const updatedItem = await apiService.markDispatchArrived(line.order.id, line.item.id);
      setOrders(current => current.map(order => order.id !== line.order.id ? order : {
        ...order,
        items: order.items?.map(item => item.id === updatedItem.id ? updatedItem : item),
      }));
      setNotice(`${line.item.product?.name || 'Producto'} recibido en el local principal. Ya puede completar su entrega y factura.`);
    } catch (arrivalError) {
      setError(arrivalError instanceof Error ? arrivalError.message : 'No se pudo registrar la llegada al local.');
    } finally {
      setBusyItem(null);
    }
  };

  const renderLine = (line: DispatchLine, isReady = false) => {
    const { order, item, remaining } = line;
    return (
      <article className='order-dispatch-line' key={item.id}>
        <div className='order-dispatch-line__info'>
          <strong>{item.product?.name || `Producto #${item.productId}`}</strong>
          <span>{order.customer?.name || order.customerName || 'Cliente sin asignar'} · Orden #{order.id}</span>
          <small>Solicitado: {item.quantityRequested} · Facturado: {item.quantityProcessed} · Pendiente: {remaining}</small>
        </div>
        <div className='order-dispatch-line__action'>
          {isReady ? (
            <Badge bg='success'>En local · {item.quantityLoaded} cargadas</Badge>
          ) : item.dispatchStatus === 'cargando' ? (
            <>
              <Badge bg='warning' text='dark'>Cargando · {item.quantityLoaded}</Badge>
              <Form.Control
                className='order-dispatch-quantity'
                type='number'
                min={0}
                max={remaining}
                step={1}
                value={quantities[item.id] ?? String(item.quantityLoaded)}
                onChange={event => setQuantities(current => ({ ...current, [item.id]: event.target.value }))}
                aria-label={`Cantidad física cargada de ${item.product?.name || 'producto'} en orden ${order.id}`}
                disabled={!isOnline || busyItem === item.id}
              />
              <Button
                variant='outline-primary'
                onClick={() => void registerLoad(line)}
                disabled={!isOnline || busyItem === item.id}
              >
                Ajustar carga
              </Button>
              <Button
                variant='success'
                onClick={() => void markArrival(line)}
                disabled={!isOnline || busyItem === item.id}
              >
                {busyItem === item.id ? <Spinner size='sm' /> : 'Marcar llegada al local'}
              </Button>
            </>
          ) : (
            <>
              <Form.Control
                className='order-dispatch-quantity'
                type='number'
                min={0}
                max={remaining}
                step={1}
                value={quantities[item.id] ?? '0'}
                onChange={event => setQuantities(current => ({ ...current, [item.id]: event.target.value }))}
                aria-label={`Cantidad física cargada de ${item.product?.name || 'producto'} en orden ${order.id}`}
                disabled={!isOnline || busyItem === item.id}
              />
              <Button
                variant='primary'
                onClick={() => void registerLoad(line)}
                disabled={!isOnline || busyItem === item.id}
              >
                {busyItem === item.id ? <Spinner size='sm' /> : 'Registrar carga'}
              </Button>
            </>
          )}
        </div>
      </article>
    );
  };

  return (
    <main className='order-dispatch-page'>
      <header className='order-dispatch-header'>
        <div>
          <p className='pending-products-eyebrow'>OPERACIONES · BODEGA Y REPARTO</p>
          <h1>Preparación de despachos</h1>
          <p>Registra lo que realmente se carga en bodega y confirma su llegada al local principal.</p>
        </div>
        <Button variant='outline-primary' onClick={() => setRefreshKey(current => current + 1)} disabled={loading}>
          Actualizar
        </Button>
      </header>

      {!isOnline && <Alert variant='warning'>Se requiere conexión para reservar existencias y registrar movimientos del despacho.</Alert>}
      {error && <Alert variant='danger' dismissible onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert variant='success' dismissible onClose={() => setNotice('')}>{notice}</Alert>}

      <section className='order-dispatch-stage'>
        <div className='order-dispatch-stage__heading'>
          <div><Badge bg='primary'>1</Badge><h2>Carga en bodega</h2></div>
          <span>Indica la cantidad física que sí se lleva. Esa cantidad se reserva del inventario.</span>
        </div>
        {loading ? <div className='pending-products-state'><Spinner animation='border' /><span>Cargando órdenes…</span></div>
          : lines.length === 0 ? <p className='order-dispatch-empty'>No hay productos pendientes de carga.</p>
            : lines.map(line => renderLine(line))}
      </section>

      <section className='order-dispatch-stage'>
        <div className='order-dispatch-stage__heading'>
          <div><Badge bg='success'>2</Badge><h2>Recibido en local principal</h2></div>
          <span>Al llegar del almacén, confirma los productos antes de enviarlos a entrega.</span>
        </div>
        {loading ? <div className='pending-products-state'><Spinner animation='border' /><span>Cargando órdenes…</span></div>
          : readyLines.length === 0 ? <p className='order-dispatch-empty'>Todavía no hay productos recibidos en el local.</p>
            : readyLines.map(line => renderLine(line, true))}
      </section>
    </main>
  );
};

export default OrderDispatchPage;
