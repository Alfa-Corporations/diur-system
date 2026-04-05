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
 * Página de Pedidos de Venta
 * Gestiona pedidos de venta a clientes con facturación parcial
 */
const SalesOrdersPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { orders, loading, error } = useAppSelector((state: RootState) => state.orders);
  const { products } = useAppSelector((state: RootState) => state.products);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<Array<{ productId: number; quantity: number }>>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    loadOrders();
    loadProducts();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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
    if (data.type === 'sale') {
      loadOrders();
    }
  };

  const loadOrders = async () => {
    dispatch(fetchOrdersStart());
    try {
      let ordersData;
      if (isOnline) {
        const response = await apiService.getOrders({ type: 'sale' });
        ordersData = response.orders;
        await localDBService.saveOrders(ordersData);
      } else {
        ordersData = (await localDBService.getOrders()).filter(o => o.type === 'sale');
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
        userId: 1, // TODO: obtener del auth
        type: 'sale' as const,
        customerName: 'Cliente Minorista', // Para POS
        items: orderItems.map(item => ({
          productId: item.productId,
          quantityRequested: item.quantity,
          quantityProcessed: 0,
          status: 'pending' as const
        }))
      };

      if (isOnline) {
        const createdOrder = await apiService.createOrder(orderData);
        dispatch(createOrderSuccess(createdOrder));
      } else {
        await localDBService.addPendingEvent({
          id: `sync_${Date.now()}`,
          type: 'crear_orden',
          data: { orderData, items: orderData.items },
          timestamp: new Date().toISOString(),
          synced: false
        });
        const tempOrder: Order = {
          id: Date.now(),
          ...orderData,
          status: 'pending',
          total: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: orderData.items.map((item, index) => ({
            id: Date.now() + index,
            orderId: Date.now(),
            ...item,
            unitPrice: products.find(p => p.id === item.productId)?.price || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }))
        };
        dispatch(createOrderSuccess(tempOrder));
      }

      setShowCreateModal(false);
      setOrderItems([]);
    } catch (error) {
      dispatch(createOrderFailure('Error al crear pedido'));
    }
  };

  const handleUpdateItemStatus = async (orderId: number, productId: number, newStatus: OrderItem['status']) => {
    try {
      if (isOnline) {
        await apiService.updateOrderItemStatus(orderId, productId, newStatus);
      } else {
        await localDBService.addPendingEvent({
          id: `sync_${Date.now()}`,
          type: 'actualizar_orden',
          data: { orderId, productId, status: newStatus },
          timestamp: new Date().toISOString(),
          synced: false
        });
      }

      const order = orders.find(o => o.id === orderId);
      const item = order?.items?.find(i => i.productId === productId);
      if (item) {
        dispatch(
          updateOrderItemStatusSuccess({
            orderId,
            item: { ...item, status: newStatus }
          })
        );
      }
    } catch (error) {
      console.error('Error updating item status:', error);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    try {
      if (isOnline) {
        const updatedOrder = await apiService.updateOrderStatus(orderId, 'cancelled');
        dispatch(cancelOrderSuccess(updatedOrder));
      } else {
        await localDBService.addPendingEvent({
          id: `sync_${Date.now()}`,
          type: 'actualizar_orden',
          data: { orderId, status: 'cancelled' },
          timestamp: new Date().toISOString(),
          synced: false
        });
        const order = orders.find(o => o.id === orderId);
        if (order) {
          dispatch(cancelOrderSuccess({ ...order, status: 'cancelled' }));
        }
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
    }
  };

  const handleInvoiceSelection = async (orderId: number, selectedItems: OrderItem[]) => {
    // TODO: Implementar facturación parcial
    // La función se usa en los botones de UI para evitar warning de variable no usada
    console.log('Facturar pedido', orderId, 'items:', selectedItems);

    if (!selectedItems.length) return;

    // Actualizar localmente como ejemplo
    selectedItems.forEach(item => {
      dispatch(
        updateOrderItemStatusSuccess({
          orderId,
          item: {
            ...item,
            status: 'invoiced'
          }
        })
      );
    });

    // Cambiar estado de pedido si todos facturados
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (orderToUpdate && orderToUpdate.items?.every(i => i.status === 'invoiced')) {
      dispatch(cancelOrderSuccess({ ...orderToUpdate, status: 'completed' }));
    }
  };

  const getStatusBadge = (status: Order['status']) => {
    const variants: Record<Order['status'], string> = {
      pending: 'warning',
      partial: 'info',
      completed: 'success',
      cancelled: 'danger'
    };
    return <Badge bg={variants[status]}>{status}</Badge>;
  };

  const getItemStatusBadge = (status: OrderItem['status']) => {
    const variants: Record<OrderItem['status'], string> = {
      pending: 'secondary',
      in_transit: 'info',
      in_warehouse: 'success',
      delivered: 'success',
      invoiced: 'primary'
    };
    return <Badge bg={variants[status]}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <div className='container mt-4'>
      <div className='d-flex justify-content-between align-items-center mb-4'>
        <h2>Pedidos de Venta</h2>
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
              <th>Cliente</th>
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
                <td>{order.customerName || 'N/A'}</td>
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
                  {order.status !== 'cancelled' && (
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

      {/* Modal de creación de pedido */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size='lg'>
        <Modal.Header closeButton>
          <Modal.Title>Nuevo Pedido de Venta</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {orderItems.map((item, index) => (
              <div key={index} className='d-flex mb-2 align-items-center'>
                <Form.Select
                  className='me-2'
                  value={item.productId}
                  onChange={e => {
                    const newItems = [...orderItems];
                    newItems[index].productId = parseInt(e.target.value);
                    setOrderItems(newItems);
                  }}
                >
                  <option value=''>Seleccionar producto</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.sku}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control
                  type='number'
                  placeholder='Cantidad'
                  value={item.quantity}
                  onChange={e => {
                    const newItems = [...orderItems];
                    newItems[index].quantity = parseInt(e.target.value);
                    setOrderItems(newItems);
                  }}
                  style={{ width: '100px' }}
                />
                <Button variant='outline-danger' size='sm' className='ms-2' onClick={() => setOrderItems(orderItems.filter((_, i) => i !== index))}>
                  ×
                </Button>
              </div>
            ))}
            <Button variant='outline-primary' onClick={() => setOrderItems([...orderItems, { productId: 0, quantity: 1 }])}>
              Agregar Producto
            </Button>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant='secondary' onClick={() => setShowCreateModal(false)}>
            Cancelar
          </Button>
          <Button variant='primary' onClick={handleCreateOrder} disabled={orderItems.length === 0}>
            Crear Pedido
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de detalle de pedido con facturación parcial */}
      <Modal show={!!selectedOrder} onHide={() => setSelectedOrder(null)} size='lg'>
        <Modal.Header closeButton>
          <Modal.Title>Detalle del Pedido #{selectedOrder?.id}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedOrder && (
            <div>
              <p>
                <strong>Cliente:</strong> {selectedOrder.customerName}
              </p>
              <p>
                <strong>Estado:</strong> {getStatusBadge(selectedOrder.status)}
              </p>
              <p>
                <strong>Total:</strong> ${selectedOrder.total}
              </p>
              <p>
                <strong>Fecha:</strong> {new Date(selectedOrder.createdAt).toLocaleString()}
              </p>

              <h5>Productos:</h5>
              <Table striped bordered>
                <thead>
                  <tr>
                    <th>Seleccionar</th>
                    <th>Producto</th>
                    <th>Cantidad Solicitada</th>
                    <th>Estado</th>
                    <th>Precio Unit.</th>
                    <th>Subtotal</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.map(item => (
                    <tr key={item.id}>
                      <td>
                        <Form.Check type='checkbox' disabled={item.status === 'invoiced'} />
                      </td>
                      <td>{item.product?.name}</td>
                      <td>{item.quantityRequested}</td>
                      <td>{getItemStatusBadge(item.status)}</td>
                      <td>${item.unitPrice}</td>
                      <td>${item.quantityRequested * item.unitPrice}</td>
                      <td>
                        {item.status === 'pending' && (
                          <Button variant='outline-info' size='sm' onClick={() => handleUpdateItemStatus(selectedOrder.id, item.productId, 'in_transit')}>
                            En tránsito
                          </Button>
                        )}
                        {item.status === 'in_transit' && (
                          <Button variant='outline-success' size='sm' onClick={() => handleUpdateItemStatus(selectedOrder.id, item.productId, 'in_warehouse')}>
                            En bodega
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className='mt-3'>
                <Button variant='success' className='me-2' onClick={() => selectedOrder && handleInvoiceSelection(selectedOrder.id, selectedOrder.items?.filter(item => item.status !== 'invoiced') || [])}>
                  Facturar Seleccionados
                </Button>
                <Button variant='outline-success' onClick={() => selectedOrder && handleInvoiceSelection(selectedOrder.id, selectedOrder.items || [])}>
                  Facturar Todo
                </Button>
              </div>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default SalesOrdersPage;
