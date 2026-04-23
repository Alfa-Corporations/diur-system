/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { Button, Badge, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import type { RootState } from '../redux/store';

import { fetchOrdersStart, fetchOrdersSuccess, fetchOrdersFailure, createOrderStart, createOrderSuccess, createOrderFailure, updateOrderItemStatusSuccess, cancelOrderSuccess } from '../redux/slices/orderSlice';

import { fetchProductsStart, fetchProductsSuccess, fetchProductsFailure } from '../redux/slices/productSlice';

import { fetchCustomersStart, fetchCustomersSuccess, fetchCustomersFailure } from '../redux/slices/customerSlice';

import apiService from '../services/apiService';
import localDBService from '../services/localDBService';
import socketService from '../services/socketService';
import type { Order, OrderItem } from '../../../shared/types';

const WholesaleSalesPage: React.FC = () => {
  const dispatch = useAppDispatch();

  const { orders, loading, error } = useAppSelector((state: RootState) => state.orders);
  const { products } = useAppSelector((state: RootState) => state.products);
  const { customers } = useAppSelector((state: RootState) => state.customers);
  const { user } = useAppSelector((state: RootState) => state.auth);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<Array<{ productId: number; quantity: number }>>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tempQuantity, setTempQuantity] = useState<{ [key: number]: number }>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    loadOrders();
    loadProducts();
    loadCustomers();

    socketService.on('notification', handleSocketNotification);

    return () => {
      socketService.off('notification', handleSocketNotification);
    };
  }, []);

  // ========================
  // SOCKETS
  // ========================
  const handleSocketNotification = (payload: any) => {
    const { type, data } = payload;

    switch (type) {
      case 'order_created':
        if (data.userId !== user?.id) {
          dispatch(createOrderSuccess(data.order));
        }
        break;

      case 'order_updated': {
        const order = ordersRef.current.find(o => o.id === data.orderId);
        if (!order) return;

        const item = order.items?.find(i => i.productId === data.productId);
        if (!item) return;

        dispatch(
          updateOrderItemStatusSuccess({
            orderId: data.orderId,
            item: {
              ...item,
              quantityProcessed: data.quantityProcessed,
              status: data.status
            }
          })
        );
        break;
      }

      case 'order_cancelled': {
        const order = ordersRef.current.find(o => o.id === data.orderId);
        if (!order) return;

        dispatch(cancelOrderSuccess({ ...order, status: 'cancelado' }));
        break;
      }
    }
  };

  // ========================
  // LOAD DATA
  // ========================
  const loadOrders = async () => {
    dispatch(fetchOrdersStart());
    try {
      const res = await apiService.getOrders({ type: 'venta al mayor' });
      dispatch(fetchOrdersSuccess({ orders: res.orders, totalCount: res.orders.length }));
    } catch {
      dispatch(fetchOrdersFailure('Error al cargar pedidos'));
    }
  };

  const loadProducts = async () => {
    dispatch(fetchProductsStart());
    try {
      const res = await apiService.getProducts();
      dispatch(fetchProductsSuccess({ products: res.products, totalCount: res.products.length }));
    } catch {
      dispatch(fetchProductsFailure('Error'));
    }
  };

  const loadCustomers = async () => {
    dispatch(fetchCustomersStart());
    try {
      const res = await apiService.getCustomers();
      dispatch(fetchCustomersSuccess(res.customers));
    } catch {
      dispatch(fetchCustomersFailure('Error'));
    }
  };

  // ========================
  // CREATE ORDER
  // ========================
  const handleCreateOrder = async () => {
    if (!selectedCustomerId || orderItems.length === 0) return;

    dispatch(createOrderStart());

    const customer = customers.find(c => c.id === selectedCustomerId);

    const orderData = {
      type: 'venta al mayor' as const,
      customerId: selectedCustomerId,
      customerName: customer?.name || '',
      items: orderItems.map(i => ({
        productId: i.productId,
        quantityRequested: i.quantity
      }))
    };

    try {
      const created = await apiService.createOrder(orderData);

      dispatch(createOrderSuccess(created));

      socketService.emit('order_created', {
        order: created,
        userId: user?.id
      });

      setShowCreateModal(false);
      setOrderItems([]);
      setSelectedCustomerId(null);
    } catch {
      dispatch(createOrderFailure('Error'));
    }
  };

  // ========================
  // UPDATE ITEM
  // ========================
  const handleUpdateItemStatus = async (orderId: number, productId: number, qty: number) => {
    const order = orders.find(o => o.id === orderId);
    const item = order?.items?.find(i => i.productId === productId);
    if (!item) return;

    const newProcessed = item.quantityProcessed + qty;

    try {
      // ✅ enviar SOLO lo que se procesa en esta acción
      const res = await apiService.updateOrderItemStatus(orderId, productId, {
        status: newProcessed === item.quantityRequested ? 'facturado' : 'en_transito',
        quantityProcessed: qty
      });

      // ✅ actualizar redux inmediatamente (optimistic UI)
      dispatch(
        updateOrderItemStatusSuccess({
          orderId,
          item: {
            ...item,
            quantityProcessed: newProcessed,
            status: newProcessed === item.quantityRequested ? 'facturado' : 'en_transito'
          }
        })
      );

      // ✅ emitir socket (ESTO TE FALTABA)
      socketService.emit('order_updated', {
        orderId,
        productId,
        quantityProcessed: newProcessed,
        status: newProcessed === item.quantityRequested ? 'facturado' : 'en_transito'
      });

      // ✅ limpiar input
      setTempQuantity(prev => ({
        ...prev,
        [productId]: 0
      }));

      // ✅ UX: cerrar modal automáticamente
      setSelectedOrder(null);
    } catch (error: any) {
      console.log('ERROR BACK:', error.response?.data);

      alert(error.response?.data?.message || 'Error al procesar');
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    const updated = await apiService.updateOrderStatus(orderId, 'cancelado');
    dispatch(cancelOrderSuccess(updated));
  };

  const getStatusBadge = (status: Order['status']) => {
    const variants: Record<Order['status'], string> = {
      pendiente: 'warning',
      en_transito: 'info',
      facturado: 'success',
      cancelado: 'danger'
    };
    return <Badge bg={variants[status]}>{status}</Badge>;
  };

  const getItemStatusBadge = (status: OrderItem['status']) => {
    const variants: Record<OrderItem['status'], string> = {
      pendiente: 'secondary',
      en_transito: 'info',
      en_bodega: 'success',
      repartidor: 'success',
      facturado: 'primary'
    };
    return <Badge bg={variants[status]}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <div className='container mt-4'>
      <div className='d-flex justify-content-between align-items-center mb-4'>
        <h2>Venta al Mayor</h2>
        <div>
          <Button variant='outline-secondary' className='me-2' onClick={() => window.history.back()}>
            ← Volver
          </Button>
          <Button variant='primary' onClick={() => setShowCreateModal(true)} disabled={!isOnline && loading}>
            Nueva Venta
          </Button>
        </div>
      </div>

      {!isOnline && <Alert variant='warning'>Modo offline - Los cambios se sincronizarán cuando se restablezca la conexión</Alert>}

      {error && <Alert variant='danger'>{error}</Alert>}

      {loading ? (
        <div className='text-center'>
          <Spinner animation='border' />
        </div>
      ) : (
        <div className='d-flex flex-column gap-3'>
          {orders.map(order => (
            <div key={order.id} className='border rounded p-3 shadow-sm'>
              {/* Header */}
              <div className='d-flex justify-content-between align-items-center mb-2'>
                <div>
                  <strong>Venta #{order.id}</strong>
                  <div className='text-muted' style={{ fontSize: '0.85rem' }}>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className='text-end'>
                  {getStatusBadge(order.status)}
                  <div className='fw-bold mt-1'>${order.total}</div>
                </div>
              </div>

              {/* Cliente */}
              <div className='mb-2'>
                <small className='text-muted'>Cliente</small>
                <div>{order.customerName}</div>
              </div>

              {/* Productos */}
              <ul className='mb-2 ps-3'>
                {order.items?.map(item => (
                  <li key={item.id} className='mb-1'>
                    <div className='d-flex justify-content-between'>
                      <span>
                        <strong>{item.product?.name}</strong> (x{item.quantityRequested})
                      </span>
                      <span>{order.status !== 'cancelado' && getItemStatusBadge(item.status)}</span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Acciones */}
              <div className='d-flex gap-2'>
                <Button variant='outline-info' size='sm' onClick={() => setSelectedOrder(order)}>
                  Ver
                </Button>

                {order.status !== 'cancelado' && (
                  <Button variant='outline-danger' size='sm' onClick={() => handleCancelOrder(order.id)}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================= */}
      {/* MODAL CREAR VENTA */}
      {/* ========================= */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size='lg' centered>
        <Modal.Header closeButton>
          <Modal.Title>Nueva Venta</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form>
            {/* 🔵 CLIENTE */}
            <Form.Group className='mb-3'>
              <Form.Label>Cliente</Form.Label>
              <Form.Select
                value={selectedCustomerId || ''}
                onChange={e => {
                  const id = parseInt(e.target.value);
                  setSelectedCustomerId(id);
                  setOrderItems([]);
                }}
              >
                <option value=''>Seleccionar cliente</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            {/* 🔍 BUSCADOR */}
            {selectedCustomerId && (
              <>
                <Form.Control type='text' placeholder='Buscar producto...' className='mb-3' onChange={e => setSearchTerm(e.target.value)} />

                {/* 🔵 LISTA PRODUCTOS */}
                <div style={{ maxHeight: '200px', overflowY: 'auto' }} className='mb-3 border rounded p-2'>
                  {products
                    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .slice(0, 10)
                    .map(product => (
                      <div key={product.id} className='d-flex justify-content-between align-items-center border-bottom py-2'>
                        <div>
                          <div style={{ fontWeight: 500 }}>{product.name}</div>
                          <small className='text-muted'>{product.partnumber}</small>
                        </div>

                        <Button
                          size='sm'
                          variant='outline-primary'
                          onClick={() => {
                            const exists = orderItems.find(i => i.productId === product.id);

                            if (exists) {
                              setOrderItems(orderItems.map(i => (i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)));
                            } else {
                              setOrderItems([...orderItems, { productId: product.id, quantity: 1 }]);
                            }
                          }}
                        >
                          +
                        </Button>
                      </div>
                    ))}
                </div>

                {/* 🛒 CARRITO */}
                <div>
                  <h6 className='mb-2'>🛒 Productos agregados</h6>

                  {orderItems.length === 0 && <small className='text-muted'>No hay productos</small>}

                  {orderItems.map((item, index) => {
                    const product = products.find(p => p.id === item.productId);

                    return (
                      <div key={index} className='border rounded p-2 mb-2 d-flex flex-column'>
                        <strong>{product?.name}</strong>
                        <small className='text-muted'>{product?.partnumber}</small>

                        <div className='d-flex justify-content-between align-items-center mt-2'>
                          <div className='d-flex align-items-center gap-2'>
                            <Button
                              size='sm'
                              variant='outline-secondary'
                              onClick={() => {
                                const newItems = [...orderItems];
                                if (newItems[index].quantity > 1) {
                                  newItems[index].quantity--;
                                }
                                setOrderItems(newItems);
                              }}
                            >
                              -
                            </Button>

                            <span>{item.quantity}</span>

                            <Button
                              size='sm'
                              variant='outline-secondary'
                              onClick={() => {
                                const newItems = [...orderItems];
                                newItems[index].quantity++;
                                setOrderItems(newItems);
                              }}
                            >
                              +
                            </Button>
                          </div>

                          <Button size='sm' variant='outline-danger' onClick={() => setOrderItems(orderItems.filter((_, i) => i !== index))}>
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant='secondary' onClick={() => setShowCreateModal(false)}>
            Cancelar
          </Button>

          <Button variant='primary' onClick={handleCreateOrder} disabled={orderItems.length === 0 || !selectedCustomerId}>
            Crear Venta
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ========================= */}
      {/* MODAL DETALLE */}
      {/* ========================= */}
      <Modal show={!!selectedOrder} onHide={() => setSelectedOrder(null)} size='lg' centered>
        <Modal.Header closeButton>
          <Modal.Title>Venta #{selectedOrder?.id}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {selectedOrder && (
            <div>
              {/* INFO */}
              <div className='mb-3 p-3 border rounded'>
                <div className='d-flex justify-content-between'>
                  <strong>Estado</strong>
                  {getStatusBadge(selectedOrder.status)}
                </div>

                <div className='d-flex justify-content-between mt-2'>
                  <span>Total</span>
                  <strong>${selectedOrder.total}</strong>
                </div>

                <div className='mt-2 text-muted' style={{ fontSize: '0.85rem' }}>
                  {new Date(selectedOrder.createdAt).toLocaleString()}
                </div>
              </div>

              {/* ITEMS */}
              {selectedOrder.items?.map(item => {
                const progress = (item.quantityProcessed / item.quantityRequested) * 100;

                return (
                  <div key={item.id} className='border rounded p-3 mb-3'>
                    <strong>{item.product?.name}</strong>

                    <div className='mt-2'>
                      {item.quantityProcessed} / {item.quantityRequested}
                    </div>

                    <div className='progress mt-2'>
                      <div className='progress-bar' style={{ width: `${progress}%` }} />
                    </div>

                    <div className='d-flex gap-2 mt-3'>
                      <Form.Control
                        type='number'
                        value={tempQuantity[item.productId] || ''}
                        onChange={e =>
                          setTempQuantity({
                            ...tempQuantity,
                            [item.productId]: parseInt(e.target.value)
                          })
                        }
                      />

                      <Button onClick={() => handleUpdateItemStatus(selectedOrder.id, item.productId, tempQuantity[item.productId] || 1)}>Procesar</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default WholesaleSalesPage;
