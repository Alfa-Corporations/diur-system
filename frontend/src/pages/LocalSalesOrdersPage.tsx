import React, { useEffect, useState } from 'react';
import { Button, Card, Alert, Spinner, Badge } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import type { RootState } from '../redux/store';
import { fetchOrdersStart, fetchOrdersSuccess, fetchOrdersFailure } from '../redux/slices/orderSlice';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';
import type { Order, OrderItem } from '../../../shared/types';

const LocalSalesOrdersPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { orders, loading, error } = useAppSelector((state: RootState) => state.orders);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    loadOrders();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadOrders = async () => {
    dispatch(fetchOrdersStart());

    try {
      let ordersData: Order[];

      if (isOnline) {
        const response = await apiService.getOrders({ type: 'venta' });
        ordersData = response.orders;
        await localDBService.saveOrders(ordersData);
      } else {
        const storedOrders = await localDBService.getOrders();
        ordersData = storedOrders.filter(order => order.type === 'venta');
      }

      dispatch(fetchOrdersSuccess({ orders: ordersData, totalCount: ordersData.length }));
    } catch (err) {
      dispatch(fetchOrdersFailure('Error al cargar los pedidos de venta local'));
    }
  };

  const getProductCode = (item: OrderItem) => {
    return item.product?.partnumber || item.product?.barcode || item.product?.codigo2 || item.product?.codigo3 || item.product?.codigo4 || String(item.productId);
  };

  const formatOrderTotal = (total: unknown) => {
    const parsed = typeof total === 'number' ? total : Number(total);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
  };

  return (
    <div className='container mt-4'>
      <div className='d-flex justify-content-between align-items-center mb-4'>
        <div>
          <h2>Pedidos de Venta en el Local</h2>
          <p className='text-muted mb-0'>
            Solo se muestran los pedidos con tipo <strong>venta</strong>.
          </p>
        </div>
        <Button variant='secondary' onClick={() => loadOrders()} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </div>

      {!isOnline && <Alert variant='warning'>Estás offline. Se cargan los pedidos locales almacenados en el navegador.</Alert>}

      {error && <Alert variant='danger'>{error}</Alert>}

      {loading ? (
        <div className='text-center'>
          <Spinner animation='border' />
        </div>
      ) : orders.length === 0 ? (
        <Alert variant='info'>No hay pedidos de tipo venta disponibles.</Alert>
      ) : (
        <div className='row g-4'>
          {orders.map(order => (
            <div key={order.id} className='col-12'>
              <Card className='shadow-sm'>
                <Card.Header className='d-flex justify-content-between align-items-start flex-column flex-md-row gap-2'>
                  <div>
                    <h5 className='mb-1'>Pedido #{order.id}</h5>
                    <small className='text-muted'>Cliente: {order.customerName || 'N/A'}</small>
                  </div>
                  <div className='text-end'>
                    <div className='fw-bold'>${formatOrderTotal(order.total)}</div>
                    <small className='text-muted'>{new Date(order.createdAt).toLocaleString()}</small>
                  </div>
                </Card.Header>
                <Card.Body>
                  <div className='mb-3'>
                    <Badge bg='success' className='me-2'>
                      Tipo: {order.type}
                    </Badge>
                    <Badge bg='secondary'>Estado: {order.status}</Badge>
                  </div>

                  <div className='row g-3'>
                    {order.items?.map(item => (
                      <div key={item.id} className='col-12 col-md-6'>
                        <Card className='h-100 border-light'>
                          <Card.Body>
                            <Card.Title className='mb-2'>{item.product?.name || 'Sin nombre'}</Card.Title>
                            <Card.Text className='mb-1'>
                              <strong>Código:</strong> {getProductCode(item)}
                            </Card.Text>
                            <Card.Text className='mb-1'>
                              <strong>Cantidad:</strong> {item.quantityRequested}
                            </Card.Text>
                            <Card.Text className='mb-0'>
                              <strong>Procesado:</strong> {item.quantityProcessed}
                            </Card.Text>
                          </Card.Body>
                        </Card>
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocalSalesOrdersPage;
