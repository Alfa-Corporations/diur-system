import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { Button, Table, Badge, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import type { RootState } from '../redux/store';
import { fetchOrdersStart, fetchOrdersSuccess, fetchOrdersFailure, createOrderStart, createOrderSuccess, createOrderFailure, updateOrderItemStatusSuccess, cancelOrderSuccess } from '../redux/slices/orderSlice';
import { fetchProductsStart, fetchProductsSuccess, fetchProductsFailure } from '../redux/slices/productSlice';
import type { Order, OrderItem } from '../../../shared/types';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';
import socketService from '../services/socketService';

/**
 * Página de Pedidos de Compra
 * Gestiona pedidos de compra a proveedores con estados individuales por producto
 */
const compraOrdersPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { orders, loading, error } = useAppSelector((state: RootState) => state.orders);
  const { products } = useAppSelector((state: RootState) => state.products);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<Array<{ productId: number; quantity: number }>>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tempQuantity, setTempQuantity] = useState<{ [key: number]: number }>({});

  // Esto debes traerlo desde backend o redux luego
  const suppliers = React.useMemo(() => {
    const map = new Map();

    products.forEach(product => {
      if (product.supplier) {
        map.set(product.supplier.id, product.supplier);
      }
    });

    return Array.from(map.values());
  }, [products]);

  useEffect(() => {
    loadOrders();
    loadProducts();

    // Escuchar cambios de conectividad
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Suscribirse a eventos de socket
    socketService.on('pedido_creado', handleOrderUpdate);
    socketService.on('pedido_actualizado', handleOrderUpdate);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      socketService.off('pedido_creado', handleOrderUpdate);
      socketService.off('pedido_actualizado', handleOrderUpdate);
    };
  }, []);

  const handleOrderUpdate = (data: any) => {
    if (data.type !== 'compra') return;

    dispatch(
      updateOrderItemStatusSuccess({
        orderId: data.orderId,
        item: data.item
      })
    );
  };

  const loadOrders = async () => {
    dispatch(fetchOrdersStart());
    try {
      let ordersData;
      if (isOnline) {
        const response = await apiService.getOrders({ type: 'compra' });
        ordersData = response.orders;
        await localDBService.saveOrders(ordersData);
      } else {
        ordersData = (await localDBService.getOrders()).filter(o => o.type === 'compra');
      }
      dispatch(fetchOrdersSuccess({ orders: ordersData, totalCount: ordersData.length }));
    } catch (error) {
      dispatch(fetchOrdersFailure('Error al cargar pedidos'));
    }
  };

  const loadProducts = async () => {
    dispatch(fetchProductsStart());
    try {
      let productsData;
      if (isOnline) {
        const response = await apiService.getProducts();
        productsData = response.products;
        await localDBService.saveProducts(productsData);
      } else {
        productsData = await localDBService.getProducts();
      }
      dispatch(fetchProductsSuccess({ products: productsData, totalCount: productsData.length }));
    } catch (error) {
      dispatch(fetchProductsFailure('Error al cargar productos'));
    }
  };

  const handleCreateOrder = async () => {
    if (orderItems.length === 0) return;

    dispatch(createOrderStart());

    try {
      const orderData = {
        userId: 1,
        supplierId: selectedSupplierId, // 🔥 IMPORTANTE
        type: 'compra',
        items: orderItems.map(item => ({
          productId: item.productId,
          quantityRequested: item.quantity,
          quantityProcessed: 0,
          status: 'pendiente'
        }))
      };

      if (isOnline) {
        const createdOrder = await apiService.createOrder(orderData);
        dispatch(createOrderSuccess(createdOrder));
      } else {
        await localDBService.addPendingEvent({
          id: `sync_${Date.now()}`,
          type: 'crear_orden',
          data: orderData,
          timestamp: new Date().toISOString(),
          synced: false
        });

        dispatch(
          createOrderSuccess({
            id: Date.now(),
            ...orderData,
            status: 'pendiente',
            total: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: orderData.items
          })
        );
      }

      setShowCreateModal(false);
      setOrderItems([]);
      setSelectedSupplierId(null);
    } catch (error) {
      dispatch(createOrderFailure('Error al crear pedido'));
    }
  };

 const handleUpdateItemStatus = async (orderId: number, productId: number, quantityToAdd: number) => {
   try {
     const order = orders.find(o => o.id === orderId);
     const item = order?.items?.find(i => i.productId === productId);

     if (!item) return;

     const newProcessed = item.quantityProcessed + quantityToAdd;

     if (newProcessed > item.quantityRequested) {
       alert('No puedes procesar más de lo solicitado');
       return;
     }

     const payload = {
       quantityProcessed: quantityToAdd
     };

     if (isOnline) {
       await apiService.updateOrderItemStatus(orderId, productId, payload);
     } else {
       await localDBService.addPendingEvent({
         id: `sync_${Date.now()}`,
         type: 'actualizar_orden',
         data: { orderId, productId, ...payload },
         timestamp: new Date().toISOString(),
         synced: false
       });
     }

     // 🔥 optimista UI
     dispatch(
       updateOrderItemStatusSuccess({
         orderId,
         item: {
           ...item,
           quantityProcessed: newProcessed
         }
       })
     );
     setSelectedOrder(null)
   } catch (error) {
     console.error(error);
   }
 };

  const handleCancelOrder = async (orderId: number) => {
    try {
      if (isOnline) {
        const updatedOrder = await apiService.updateOrderStatus(orderId, 'cancelado');
        dispatch(cancelOrderSuccess(updatedOrder));
      } else {
        await localDBService.addPendingEvent({
          id: `sync_${Date.now()}`,
          type: 'actualizar_orden',
          data: { orderId, status: 'cancelado' },
          timestamp: new Date().toISOString(),
          synced: false
        });
        const order = orders.find(o => o.id === orderId);
        if (order) {
          dispatch(cancelOrderSuccess({ ...order, status: 'cancelado' }));
        }
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
    }
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
        <h2>Pedidos de Compra</h2>
        <div>
          <Button variant='outline-secondary' className='me-2' onClick={() => window.history.back()}>
            ← Volver
          </Button>
          <Button variant='primary' onClick={() => setShowCreateModal(true)} disabled={!isOnline && loading}>
            Nuevo Pedido
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
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>ID</th>
              <th>Estado</th>
              <th>Total</th>
              <th>Productos</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{getStatusBadge(order.status)}</td>
                <td>${order.total}</td>
                <td>
                  {order.items?.map(item => (
                    <div key={item.id} className='mb-1'>
                      {item.product?.name} (x{item.quantityRequested}) - {getItemStatusBadge(item.status)}
                    </div>
                  ))}
                </td>
                <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                <td>
                  <Button variant='outline-info' size='sm' className='me-1' onClick={() => setSelectedOrder(order)}>
                    Ver
                  </Button>
                  {order.status !== 'cancelado' && (
                    <Button variant='outline-danger' size='sm' onClick={() => handleCancelOrder(order.id)}>
                      Cancelar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size='lg' centered>
        <Modal.Header closeButton>
          <Modal.Title>Nuevo Pedido de Compra</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form>
            {/* 🔵 PROVEEDOR */}
            <Form.Group className='mb-3'>
              <Form.Label>Proveedor</Form.Label>
              <Form.Select
                value={selectedSupplierId || ''}
                onChange={e => {
                  const supplierId = parseInt(e.target.value);
                  setSelectedSupplierId(supplierId);
                  setOrderItems([]);
                }}
              >
                <option value=''>Seleccionar proveedor</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            {/* 🔍 BUSCADOR */}
            {selectedSupplierId && (
              <>
                <Form.Control type='text' placeholder='Buscar producto...' className='mb-3' onChange={e => setSearchTerm(e.target.value)} />

                {/* 🔵 LISTA PRODUCTOS */}
                <div style={{ maxHeight: '200px', overflowY: 'auto' }} className='mb-3 border rounded p-2'>
                  {products
                    .filter(p => p.supplier?.id === selectedSupplierId && p.name.toLowerCase().includes(searchTerm.toLowerCase()))
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
                          {/* 🔢 CONTROLES CANTIDAD */}
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

                          {/* ❌ ELIMINAR */}
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

          <Button variant='primary' onClick={handleCreateOrder} disabled={orderItems.length === 0 || !selectedSupplierId}>
            Crear Pedido
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de detalle de pedido */}
      <Modal show={!!selectedOrder} onHide={() => setSelectedOrder(null)} size='lg' centered>
        <Modal.Header closeButton>
          <Modal.Title>Pedido #{selectedOrder?.id}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {selectedOrder && (
            <div>
              {/* 🔵 INFO GENERAL */}
              <div className='mb-3 p-3 border rounded'>
                <div className='d-flex justify-content-between align-items-center mb-2'>
                  <strong>Estado</strong>
                  {getStatusBadge(selectedOrder.status)}
                </div>

                <div className='d-flex justify-content-between'>
                  <span>Total</span>
                  <strong>${selectedOrder.total}</strong>
                </div>

                <div className='mt-2 text-muted' style={{ fontSize: '0.85rem' }}>
                  {new Date(selectedOrder.createdAt).toLocaleString()}
                </div>
              </div>

              {/* 🛒 PRODUCTOS */}
              <h6 className='mb-3'>Productos</h6>

              {selectedOrder.items?.map(item => {
                const progress = (item.quantityProcessed / item.quantityRequested) * 100;

                return (
                  <div key={item.id} className='border rounded p-3 mb-3 shadow-sm'>
                    {/* 🔹 NOMBRE */}
                    <div className='mb-2'>
                      <strong style={{ fontSize: '1rem' }}>{item.product?.name}</strong>
                    </div>

                    {/* 🔹 PROGRESO */}
                    <div className='mb-2'>
                      <div className='d-flex justify-content-between'>
                        <small className='text-muted'>Progreso</small>
                        <small>
                          {item.quantityProcessed} / {item.quantityRequested}
                        </small>
                      </div>

                      <div className='progress' style={{ height: '8px' }}>
                        <div className='progress-bar' role='progressbar' style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    {/* 🔹 INFO */}
                    <div className='d-flex justify-content-between mb-2'>
                      <div>
                        <small className='text-muted'>Solicitado</small>
                        <div>{item.quantityRequested}</div>
                      </div>

                      <div>
                        <small className='text-muted'>Procesado</small>
                        <div>{item.quantityProcessed}</div>
                      </div>

                      <div className='text-end'>
                        <small className='text-muted'>Estado</small>
                        <div>{getItemStatusBadge(item.status)}</div>
                      </div>
                    </div>

                    {/* 🔹 INPUT CANTIDAD */}
                    <div className='d-flex gap-2 mt-3 align-items-center'>
                      <Form.Control
                        type='number'
                        min={1}
                        placeholder='Cantidad'
                        value={tempQuantity[item.productId] || ''}
                        onChange={e =>
                          setTempQuantity({
                            ...tempQuantity,
                            [item.productId]: parseInt(e.target.value)
                          })
                        }
                        style={{ maxWidth: '90px' }}
                      />

                      <Button variant='outline-success' size='sm' className='w-100' onClick={() => handleUpdateItemStatus(selectedOrder.id, item.productId, tempQuantity[item.productId] || 1)}>
                        📦 Ingresar
                      </Button>
                    </div>

                    {/* 🔹 BOTÓN RÁPIDO COMPLETAR */}
                    {item.quantityProcessed < item.quantityRequested && (
                      <Button variant='outline-primary' size='sm' className='w-100 mt-2' onClick={() => handleUpdateItemStatus(selectedOrder.id, item.productId, item.quantityRequested - item.quantityProcessed)}>
                        ⚡ Completar todo
                      </Button>
                    )}
                  </div>
                );
              })}

              {selectedOrder.items?.length === 0 && <div className='text-center text-muted'>No hay productos en este pedido</div>}
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default compraOrdersPage;
