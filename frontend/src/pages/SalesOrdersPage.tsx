import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { Button, Table, Modal, Form, Alert, Spinner, InputGroup } from 'react-bootstrap';

import type { RootState } from '../redux/store';
import { fetchOrdersStart, fetchOrdersSuccess, fetchOrdersFailure, createOrderSuccess, updateOrderItemStatusSuccess } from '../redux/slices/orderSlice';

import type { Order } from '../../../shared/types';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';
import socketService from '../services/socketService';

const WholesaleSalesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { orders, loading, error } = useAppSelector((s: RootState) => s.orders);
  const { products } = useAppSelector((s: RootState) => s.products);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<Array<{ productId: number; quantity: number }>>([]);

  const [search, setSearch] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  /* =========================
     LOAD DATA
  ========================== */
  useEffect(() => {
    loadOrders();

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    socketService.on('pedido_actualizado', refreshOrder);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      socketService.off('pedido_actualizado', refreshOrder);
    };
  }, []);

  const refreshOrder = (data: any) => {
    if (data.type === 'bodega') {
      loadOrders();
    }
  };

  const loadOrders = async () => {
    dispatch(fetchOrdersStart());
    try {
      let data;
      if (isOnline) {
        const res = await apiService.getOrders({ type: 'venta' });
        data = res.orders;
        await localDBService.saveOrders(data);
      } else {
        data = (await localDBService.getOrders()).filter((o: Order) => o.type === 'venta');
      }

      dispatch(
        fetchOrdersSuccess({
          orders: data,
          totalCount: data.length
        })
      );
    } catch {
      dispatch(fetchOrdersFailure('Error cargando órdenes'));
    }
  };

  /* =========================
     CREATE ORDER
  ========================== */
  const handleCreateOrder = async () => {
    if (!orderItems.length) return;

    const payload = {
      userId: 1,
      type: 'venta' as const,
      customerName: 'Cliente Mayorista',
      items: orderItems.map(i => ({
        productId: i.productId,
        quantityRequested: i.quantity,
        quantityProcessed: 0,
        status: 'pendiente'
      }))
    };

    try {
      if (isOnline) {
        const res = await apiService.createOrder(payload);
        dispatch(createOrderSuccess(res));
      } else {
        await localDBService.addPendingEvent({
          id: `sync_${Date.now()}`,
          type: 'crear_orden',
          data: payload,
          timestamp: new Date().toISOString(),
          synced: false
        });

        dispatch(
          createOrderSuccess({
            id: Date.now(),
            ...payload,
            total: 0,
            status: 'pendiente',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as any)
        );
      }

      setOrderItems([]);
      setShowCreateModal(false);
    } catch {
      alert('Error creando orden');
    }
  };

  /* =========================
     UPDATE DELIVERY
  ========================== */
  const handleDeliver = async (orderId: number, productId: number, qty: number) => {
    const order = orders.find(o => o.id === orderId);
    const item = order?.items?.find(i => i.productId === productId);
    if (!item) return;

    const newQty = item.quantityProcessed + qty;

    if (newQty > item.quantityRequested) return;

    const updated = {
      ...item,
      quantityProcessed: newQty,
      status: newQty === item.quantityRequested ? 'delivered' : 'in_transit'
    };

    dispatch(
      updateOrderItemStatusSuccess({
        orderId,
        item: {
          ...updated,
          status: updated.status as
            | 'pendiente'
            | 'en_transito'
            | 'facturado'
            | 'en_bodega'
            | 'repartidor'
        }
      })
    );
  };

  /* =========================
     FACTURACIÓN
  ========================== */
  const handleInvoice = (order: Order) => {
    const ready = order.items?.filter(i => i.quantityProcessed > 0);

    if (!ready?.length) return;

    alert(`Factura generada para ${ready.length} productos del pedido ${order.id}`);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => o.customerName?.toLowerCase().includes(search.toLowerCase()));
  }, [orders, search]);

  /* =========================
     UI
  ========================== */
  return (
    <div className='container mt-4'>
      {/* HEADER */}
      <div className='d-flex justify-content-between mb-3'>
        <h3>Ventas Mayoristas</h3>

        <div className='d-flex gap-2'>
          <Button variant='outline-secondary' onClick={() => window.history.back()}>
            ← Volver
          </Button>

          <Button onClick={() => setShowCreateModal(true)}>Nueva Orden</Button>
        </div>
      </div>

      {error && <Alert variant='danger'>{error}</Alert>}

      {/* SEARCH */}
      <InputGroup className='mb-3'>
        <Form.Control placeholder='Buscar cliente...' value={search} onChange={e => setSearch(e.target.value)} />
      </InputGroup>

      {/* TABLE */}
      {loading ? (
        <Spinner animation='border' />
      ) : (
        <Table bordered hover>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Progreso</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {filteredOrders.map(order => {
              const total = order.items?.length || 0;
              const done = order.items?.filter(i => i.quantityProcessed > 0).length || 0;

              return (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.customerName}</td>
                  <td>{order.status}</td>
                  <td>
                    {done}/{total}
                  </td>

                  <td>
                    <Button size='sm' onClick={() => setSelectedOrder(order)}>
                      Ver
                    </Button>

                    <Button size='sm' variant='success' className='ms-2' onClick={() => handleInvoice(order)}>
                      Facturar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {/* CREATE MODAL */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Nueva Orden Mayorista</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {orderItems.map((item, i) => (
            <div key={i} className='d-flex gap-2 mb-2'>
              <Form.Select
                value={item.productId}
                onChange={e => {
                  const copy = [...orderItems];
                  copy[i].productId = Number(e.target.value);
                  setOrderItems(copy);
                }}
              >
                <option>Producto</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Form.Select>

              <Form.Control
                type='number'
                value={item.quantity}
                onChange={e => {
                  const copy = [...orderItems];
                  copy[i].quantity = Number(e.target.value);
                  setOrderItems(copy);
                }}
              />
            </div>
          ))}

          <Button variant='outline-primary' onClick={() => setOrderItems([...orderItems, { productId: 0, quantity: 1 }])}>
            + Agregar producto
          </Button>
        </Modal.Body>

        <Modal.Footer>
          <Button onClick={() => setShowCreateModal(false)}>Cancelar</Button>

          <Button onClick={handleCreateOrder}>Crear</Button>
        </Modal.Footer>
      </Modal>

      {/* DETAIL MODAL */}
      <Modal show={!!selectedOrder} onHide={() => setSelectedOrder(null)} size='lg'>
        <Modal.Header closeButton>
          <Modal.Title>Detalle Orden</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {selectedOrder?.items?.map(item => (
            <div key={item.id} className='border p-2 mb-2'>
              <b>{item.product?.name}</b>

              <div>
                {item.quantityProcessed}/{item.quantityRequested}
              </div>

              <Button size='sm' onClick={() => handleDeliver(selectedOrder.id, item.productId, 1)}>
                Entregar +1
              </Button>

              <Button size='sm' className='ms-2' onClick={() => handleDeliver(selectedOrder.id, item.productId, item.quantityRequested - item.quantityProcessed)}>
                Completar
              </Button>
            </div>
          ))}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default WholesaleSalesPage;
