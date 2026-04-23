import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { Button, Table, Modal, Form, Alert, Spinner, InputGroup, Badge } from 'react-bootstrap';

import type { RootState } from '../redux/store';
import { fetchOrdersStart, fetchOrdersSuccess, fetchOrdersFailure, createOrderSuccess } from '../redux/slices/orderSlice';

import type { Order } from '../../../shared/types';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';

const WholesaleSalesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { orders, loading, error } = useAppSelector((s: RootState) => s.orders);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [orderItems, setOrderItems] = useState<Array<{ productId: number; quantity: number }>>([]);

  const [tempQuantity, setTempQuantity] = useState<{ [key: number]: number }>({});

  const [customerName, setCustomerName] = useState('');
  const [search, setSearch] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  /* ========================= LOAD ========================= */
  useEffect(() => {
    loadOrders();
  }, []);

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

      dispatch(fetchOrdersSuccess({ orders: data, totalCount: data.length }));
    } catch {
      dispatch(fetchOrdersFailure('Error cargando órdenes'));
    }
  };

  /* ========================= CREATE ========================= */
  const handleCreateOrder = async () => {
    if (!orderItems.length) return;

    const payload = {
      userId: 1,
      type: 'venta' as const,
      customerName: customerName || 'Cliente General',
      items: orderItems.map(i => ({
        productId: i.productId,
        quantityRequested: i.quantity
      }))
    };

    const res = await apiService.createOrder(payload);
    dispatch(createOrderSuccess(res));

    setOrderItems([]);
    setCustomerName('');
    setShowCreateModal(false);
  };

  /* ========================= FACTURAR ========================= */
  const handleInvoice = async () => {
    if (!selectedOrder?.items) {
      alert('Orden inválida');
      return;
    }

    const items =
      selectedOrder.items
        ?.filter(i => tempQuantity[i.productId] > 0)
        .map(i => ({
          productId: i.productId,
          quantity: tempQuantity[i.productId]
        })) || [];

    if (!items.length) {
      alert('Ingresa cantidades válidas');
      return;
    }

    await apiService.createInvoice({
      items,
      customer: {
        name: selectedOrder.customerName
      },
      documentType: 'consumer_final' // o 'sri_invoice'
    });

    setTempQuantity({});
    setSelectedOrder(null);
    loadOrders();
  };

  /* ========================= FILTER ========================= */
  const filteredOrders = useMemo(() => {
    return orders.filter(o => o.customerName?.toLowerCase().includes(search.toLowerCase()));
  }, [orders, search]);

  /* ========================= UI ========================= */
  return (
    <div className='container mt-4' style={{ maxWidth: 1100 }}>
      {/* HEADER */}
      <div className='d-flex justify-content-between mb-4'>
        <h4>Ventas Mayoristas</h4>
        <Button onClick={() => setShowCreateModal(true)}>+ Nueva Orden</Button>
      </div>

      {error && <Alert variant='danger'>{error}</Alert>}

      {/* SEARCH */}
      <InputGroup className='mb-3'>
        <Form.Control placeholder='Buscar cliente...' value={search} onChange={e => setSearch(e.target.value)} />
      </InputGroup>

      {/* TABLE */}
      {loading ? (
        <Spinner />
      ) : (
        <Table hover>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Progreso</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {filteredOrders.map(order => {
              const total = order.items?.length || 0;
              const done = order.items?.filter(i => i.quantityProcessed > 0).length || 0;

              return (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>{order.customerName}</td>
                  <td>
                    <Badge>
                      {done}/{total}
                    </Badge>
                  </td>
                  <td>
                    <Button size='sm' onClick={() => setSelectedOrder(order)}>
                      Ver
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {/* MODAL DETALLE */}
      <Modal show={!!selectedOrder} onHide={() => setSelectedOrder(null)} size='lg' centered>
        <Modal.Header closeButton>
          <Modal.Title>Pedido #{selectedOrder?.id}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {selectedOrder?.items?.map(item => {
            const pendiente = item.quantityRequested - item.quantityProcessed;

            return (
              <div key={item.id} className='border p-3 mb-3'>
                <strong>{item.product?.name}</strong>

                <div className='d-flex justify-content-between mt-2'>
                  <small>Pedido: {item.quantityRequested}</small>
                  <small>Procesado: {item.quantityProcessed}</small>
                  <small>Pendiente: {pendiente}</small>
                </div>

                <div className='d-flex gap-2 mt-2'>
                  <Form.Control
                    type='number'
                    min={1}
                    max={pendiente}
                    value={tempQuantity[item.productId] || ''}
                    onChange={e =>
                      setTempQuantity({
                        ...tempQuantity,
                        [item.productId]: Number(e.target.value)
                      })
                    }
                  />

                  <Button
                    variant='outline-primary'
                    onClick={() =>
                      setTempQuantity({
                        ...tempQuantity,
                        [item.productId]: pendiente
                      })
                    }
                  >
                    Todo
                  </Button>
                </div>
              </div>
            );
          })}
        </Modal.Body>

        <Modal.Footer>
          <Button onClick={() => setSelectedOrder(null)}>Cancelar</Button>
          <Button variant='success' onClick={handleInvoice}>
            💰 Facturar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* CREATE MODAL (igual al tuyo) */}
    </div>
  );
};

export default WholesaleSalesPage;
