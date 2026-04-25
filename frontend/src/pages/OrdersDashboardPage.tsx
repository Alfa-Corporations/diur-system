import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { Button, Table, Badge, Alert, Row, Col, Card } from 'react-bootstrap';
import type { RootState } from '../redux/store';
import { fetchOrdersStart, fetchOrdersSuccess, fetchOrdersFailure } from '../redux/slices/orderSlice';
import type { Order, OrderItem } from '../../../shared/types';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';
import socketService from '../services/socketService';

/**
 * Dashboard de Pedidos
 * Vista global de todos los pedidos con estados individuales
 */
const OrdersDashboardPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { orders, loading, error } = useAppSelector((state: RootState) => state.orders);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [filterType, setFilterType] = useState<'all' | 'compra' | 'venta'>('all');

  useEffect(() => {
    loadOrders();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    socketService.on('pedido_creado', loadOrders);
    socketService.on('pedido_actualizado', loadOrders);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      socketService.off('pedido_creado', loadOrders);
      socketService.off('pedido_actualizado', loadOrders);
    };
  }, []);

  const loadOrders = async () => {
    dispatch(fetchOrdersStart());
    try {
      let ordersData;
      if (isOnline) {
        const response = await apiService.getOrders();
        ordersData = response.orders;
        localDBService.saveOrders(ordersData);
      } else {
        ordersData = await localDBService.getOrders();
      }
      dispatch(fetchOrdersSuccess({ orders: ordersData, totalCount: ordersData.length }));
    } catch (error) {
      dispatch(fetchOrdersFailure('Error al cargar pedidos'));
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filterType === 'all') return true;
    return order.type === filterType;
  });

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

  const getTypeBadge = (type: Order['type']) => {
    return <Badge bg={type === 'compra' ? 'info' : 'success'}>{type}</Badge>;
  };

  // Estadísticas
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pendiente').length,
    partial: orders.filter(o => o.status === 'en_transito').length,
    completed: orders.filter(o => o.status === 'cancelado').length,
    compra: orders.filter(o => o.type === 'compra').length,
    venta: orders.filter(o => o.type === 'venta').length
  };

  return (
    <div className='container mt-4'>
      <div className='d-flex justify-content-between align-items-center mb-4'>
        <h2>📊 Dashboard de Pedidos</h2>
        <Button variant='outline-secondary' onClick={() => window.history.back()}>
          <svg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='#000000'>
            <path d='m142-480 294 294q15 15 14.5 35T435-116q-15 15-35 15t-35-15L57-423q-12-12-18-27t-6-30q0-15 6-30t18-27l308-308q15-15 35.5-14.5T436-844q15 15 15 35t-15 35L142-480Z' />
          </svg>
        </Button>
      </div>

      {!isOnline && (
        <Alert variant='warning' className='mb-3'>
          Modo offline - Algunos datos pueden estar desactualizados
        </Alert>
      )}

      {/* Estadísticas */}
      <Row className='mb-4'>
        <Col md={2}>
          <Card className='text-center'>
            <Card.Body>
              <Card.Title className='h3 text-primary'>{stats.total}</Card.Title>
              <Card.Text>Total Pedidos</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className='text-center'>
            <Card.Body>
              <Card.Title className='h3 text-warning'>{stats.pending}</Card.Title>
              <Card.Text>Pendientes</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className='text-center'>
            <Card.Body>
              <Card.Title className='h3 text-info'>{stats.partial}</Card.Title>
              <Card.Text>Parciales</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className='text-center'>
            <Card.Body>
              <Card.Title className='h3 text-success'>{stats.completed}</Card.Title>
              <Card.Text>Completados</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className='text-center'>
            <Card.Body>
              <Card.Title className='h3 text-info'>{stats.compra}</Card.Title>
              <Card.Text>Compras</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={2}>
          <Card className='text-center'>
            <Card.Body>
              <Card.Title className='h3 text-success'>{stats.venta}</Card.Title>
              <Card.Text>Ventas</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filtros */}
      <div className='mb-3'>
        <Button variant={filterType === 'all' ? 'primary' : 'outline-primary'} className='me-2' onClick={() => setFilterType('all')}>
          Todos
        </Button>
        <Button variant={filterType === 'compra' ? 'primary' : 'outline-primary'} className='me-2' onClick={() => setFilterType('compra')}>
          Compras
        </Button>
        <Button variant={filterType === 'venta' ? 'primary' : 'outline-primary'} onClick={() => setFilterType('venta')}>
          Ventas
        </Button>
      </div>

      {error && <Alert variant='danger'>{error}</Alert>}

      {loading ? (
        <div className='text-center'>Cargando pedidos...</div>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo</th>
              <th>Estado General</th>
              <th>Cliente/Proveedor</th>
              <th>Total</th>
              <th>Estados de Productos</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => (
              <tr key={order.id}>
                <td>{order.id}</td>
                <td>{getTypeBadge(order.type)}</td>
                <td>{getStatusBadge(order.status)}</td>
                <td>{order.customerName || 'N/A'}</td>
                <td>${order.total}</td>
                <td>
                  <div className='d-flex flex-wrap gap-1'>
                    {order.items?.map(item => (
                      <small key={item.id} className='me-1'>
                        {item.product?.name}: {getItemStatusBadge(item.status)}
                      </small>
                    ))}
                  </div>
                </td>
                <td>{new Date(order.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default OrdersDashboardPage;
