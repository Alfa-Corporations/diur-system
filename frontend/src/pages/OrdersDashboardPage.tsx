import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { Button, Table, Badge, Alert, Row, Col } from 'react-bootstrap';
import type { RootState } from '../redux/store';
import { fetchOrdersStart, fetchOrdersSuccess, fetchOrdersFailure } from '../redux/slices/orderSlice';
import type { Order, OrderItem, RealtimeNotification } from '../../../shared/types';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';
import socketService from '../services/socketService';

/**
 * Dashboard de Pedidos
 * Vista global de todos los pedidos con estados individuales
 */
const OrdersDashboardPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const { orders, loading, error } = useAppSelector((state: RootState) => state.orders);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [filterType, setFilterType] = useState<'all' | 'compra' | 'venta'>('all');

  const loadOrders = useCallback(async () => {
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
    } catch {
      dispatch(fetchOrdersFailure('Error al cargar pedidos'));
    }
  }, [dispatch, isOnline]);

  useEffect(() => {
    void loadOrders();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleNotification = (notification: RealtimeNotification) => {
      const data = notification.data as { resource?: string } | null;
      if (data?.resource === 'orders') void loadOrders();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    socketService.on('notification', handleNotification);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      socketService.off('notification', handleNotification);
    };
  }, [loadOrders]);

  const rawStatus = searchParams.get('status');
  const statuses: Order['status'][] = ['pendiente', 'parcial', 'completado', 'cancelado'];
  const requestedStatus = statuses.includes(rawStatus as Order['status']) ? rawStatus : null;
  const filteredOrders = orders.filter(order =>
    (filterType === 'all' || (filterType === 'compra' ? order.type === 'compra' : order.type !== 'compra')) &&
    (!requestedStatus || order.status === requestedStatus)
  );
  const filterByStatus = (status?: Order['status']) => setSearchParams(status ? { status } : {});
  const filterByType = (type: 'all' | 'compra' | 'venta') => {
    setFilterType(type);
    setSearchParams({});
  };

  const getStatusBadge = (status: Order['status']) => {
    const variants: Record<Order['status'], string> = {
      pendiente: 'warning',
      parcial: 'info',
      completado: 'success',
      cancelado: 'danger'
    };
    return <Badge bg={variants[status]}>{status.replace('_', ' ')}</Badge>;
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
    partial: orders.filter(o => o.status === 'parcial').length,
    completed: orders.filter(o => o.status === 'completado').length,
    compra: orders.filter(o => o.type === 'compra').length,
    venta: orders.filter(o => o.type !== 'compra').length
  };

  return (
    <div className='container mt-4'>
      <div className='orders-dashboard-header'>
        <div>
          <span className='pending-products-eyebrow'>OPERACIONES · RESUMEN</span>
          <h1>Dashboard de pedidos</h1>
          <p>Selecciona un indicador para consultar los pedidos que lo componen.</p>
        </div>
      </div>

      {!isOnline && (
        <Alert variant='warning' className='mb-3'>
          Modo offline - Algunos datos pueden estar desactualizados
        </Alert>
      )}

      {/* Estadísticas */}
      <Row className='orders-dashboard-stats mb-4 g-3'>
        <Col xs={6} md={4} xl={2}>
          <button type='button' className='stat-card stat-card-button text-center' onClick={() => filterByType('all')} aria-pressed={!requestedStatus && filterType === 'all'}>
            <div className='metric-value text-primary'>{stats.total}</div>
            <div>Total pedidos</div>
          </button>
        </Col>
        <Col xs={6} md={4} xl={2}>
          <button type='button' className='stat-card stat-card-button text-center' onClick={() => filterByStatus('pendiente')} aria-pressed={requestedStatus === 'pendiente'}>
            <div className='metric-value text-warning'>{stats.pending}</div>
            <div>Pendientes</div>
          </button>
        </Col>
        <Col xs={6} md={4} xl={2}>
          <button type='button' className='stat-card stat-card-button text-center' onClick={() => filterByStatus('parcial')} aria-pressed={requestedStatus === 'parcial'}>
            <div className='metric-value text-info'>{stats.partial}</div>
            <div>Parciales</div>
          </button>
        </Col>
        <Col xs={6} md={4} xl={2}>
          <button type='button' className='stat-card stat-card-button text-center' onClick={() => filterByStatus('completado')} aria-pressed={requestedStatus === 'completado'}>
            <div className='metric-value text-success'>{stats.completed}</div>
            <div>Completados</div>
          </button>
        </Col>
        <Col xs={6} md={4} xl={2}>
          <button type='button' className='stat-card stat-card-button text-center' onClick={() => filterByType('compra')} aria-pressed={filterType === 'compra'}>
            <div className='metric-value text-info'>{stats.compra}</div>
            <div>Compras</div>
          </button>
        </Col>
        <Col xs={6} md={4} xl={2}>
          <button type='button' className='stat-card stat-card-button text-center' onClick={() => filterByType('venta')} aria-pressed={filterType === 'venta'}>
            <div className='metric-value text-success'>{stats.venta}</div>
            <div>Ventas</div>
          </button>
        </Col>
      </Row>

      {/* Filtros */}
      <div className='orders-dashboard-filters mb-3'>
        <Button variant={filterType === 'all' ? 'primary' : 'outline-primary'} onClick={() => filterByType('all')}>
          Todos
        </Button>
        <Button variant={filterType === 'compra' ? 'primary' : 'outline-primary'} onClick={() => filterByType('compra')}>
          Compras
        </Button>
        <Button variant={filterType === 'venta' ? 'primary' : 'outline-primary'} onClick={() => filterByType('venta')}>
          Ventas
        </Button>
        {requestedStatus && <Button variant='outline-secondary' onClick={() => filterByStatus()}>Quitar filtro de estado</Button>}
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
            {filteredOrders.length === 0 && (
              <tr><td colSpan={7} className='text-center text-muted py-4'>No hay pedidos para este filtro.</td></tr>
            )}
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
