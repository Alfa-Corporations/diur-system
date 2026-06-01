/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { Button, Badge, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import type { RootState } from '../redux/store';

import { fetchOrdersStart, fetchOrdersSuccess, fetchOrdersFailure, createOrderStart, createOrderSuccess, createOrderFailure, updateOrderItemStatusSuccess, cancelOrderSuccess } from '../redux/slices/orderSlice';

import { fetchProductsStart, fetchProductsSuccess, fetchProductsFailure } from '../redux/slices/productSlice';

import { fetchCustomersStart, fetchCustomersSuccess, fetchCustomersFailure } from '../redux/slices/customerSlice';

import apiService from '../services/apiService';
import socketService from '../services/socketService';
import type { Order, OrderItem } from '../../../shared/types';
import { Html5Qrcode } from 'html5-qrcode';

const WholesaleSalesPage: React.FC = () => {
  const dispatch = useAppDispatch();

  const { orders, loading, error } = useAppSelector((state: RootState) => state.orders);
  const { products } = useAppSelector((state: RootState) => state.products);
  const { customers } = useAppSelector((state: RootState) => state.customers);
  const { user } = useAppSelector((state: RootState) => state.auth);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<Array<{ productId: number; quantity: number }>>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [invoiceQuantities, setInvoiceQuantities] = useState<{ [key: number]: number }>({});
  const [invoicePriceTier, setInvoicePriceTier] = useState<{ [key: number]: 1 | 2 | 3 }>({});
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [isOnline] = useState(navigator.onLine);
  const [filters, setFilters] = useState({ search: '' });
  const [showScanner, setShowScanner] = useState(false);

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

  // =========================
  // SCANNER
  // =========================
  useEffect(() => {
    if (!showScanner) return;

    const scanner = new Html5Qrcode('reader');
    let lastScan = '';
    let isRunning = false;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        async decodedText => {
          // 🚫 Evitar lecturas duplicadas
          if (decodedText === lastScan) return;
          lastScan = decodedText;

          try {
            setFilters({ search: decodedText });

            // 🔊 (opcional) sonido de éxito
            const audio = new Audio('/scan.mp3');
            audio.play().catch(() => {});

            // ⏹ detener scanner correctamente
            if (isRunning) {
              isRunning = false;
              await scanner.stop();
              setShowScanner(false);
            }
          } catch (error) {
            console.error('Error al procesar escaneo:', error);
          }
        },
        () => {
          // 👇 ignoramos errores frecuentes del escáner
        }
      )
      .then(() => {
        isRunning = true;
      })
      .catch(error => {
        console.error('Error al iniciar scanner:', error);
      });

    return () => {
      if (isRunning) {
        scanner.stop().catch(() => {
          // Ignorar errores al detener el scanner
        });
      }
    };
  }, [showScanner]);

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
      return res.orders;
    } catch {
      dispatch(fetchOrdersFailure('Error al cargar pedidos'));
      return [];
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

      // Mostrar alerta con número de orden para facilitar edición posterior
      alert(`Orden creada: #${created.id}`);

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

  const getProductPriceByTier = (product: any, tier: 1 | 2 | 3) => {
    if (!product) return 0;
    if (tier === 2) return Number(product.pricecaja ?? product.price ?? 0);
    if (tier === 3) return Number(product.priceb ?? product.price ?? 0);
    return Number(product.price ?? 0);
  };

  const handleInvoiceItem = async (orderId: number, item: OrderItem) => {
    const product = item.product as any;
    const remaining = item.quantityRequested - item.quantityProcessed;
    const quantity = invoiceQuantities[item.productId] || 0;
    const tier = invoicePriceTier[item.productId] || 1;

    if (quantity <= 0) {
      alert('Ingresa una cantidad válida para facturar.');
      return;
    }

    if (quantity > remaining) {
      alert('La cantidad no puede ser mayor al restante.');
      return;
    }

    const price = getProductPriceByTier(product, tier);

    const invoicePayload = {
      documentType: selectedOrder?.customer?.name || selectedOrder?.customerName ? 'sales_note' : 'consumer_final',
      customer: {
        name: selectedOrder?.customer?.name || selectedOrder?.customerName || 'Cliente Mayorista',
        email: selectedOrder?.customer?.email || undefined,
        phone: selectedOrder?.customer?.phone || undefined,
        identificationType: selectedOrder?.customer?.identificationType || 'none',
        identificationNumber: selectedOrder?.customer?.identificationNumber || undefined,
        address: selectedOrder?.customer?.address || selectedOrder?.customerAddress || undefined
      },
      items: [
        {
          productId: item.productId,
          quantity,
          price,
          orderItemId: item.id
        }
      ]
    };

    setInvoiceLoading(true);
    try {
      const invoice = await apiService.createInvoice(invoicePayload as any);
      alert(`Factura creada: ${invoice.invoiceNumber || invoice.id}`);

      const refreshedOrders = await loadOrders();
      const updated = refreshedOrders.find(order => order.id === orderId) || null;
      setSelectedOrder(updated);
      setInvoiceQuantities(prev => ({ ...prev, [item.productId]: 0 }));
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Error creando la factura');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleBulkInvoice = async (orderId: number) => {
    if (!selectedOrder) return;

    const itemsToInvoice =
      selectedOrder.items?.filter(item => {
        const quantity = invoiceQuantities[item.productId] || 0;
        const remaining = item.quantityRequested - item.quantityProcessed;
        return quantity > 0 && quantity <= remaining;
      }) || [];

    if (itemsToInvoice.length === 0) {
      alert('No hay productos con cantidades válidas para facturar.');
      return;
    }

    const invoiceItems = itemsToInvoice.map(item => {
      const quantity = invoiceQuantities[item.productId] || 0;
      const tier = invoicePriceTier[item.productId] || 1;
      const price = getProductPriceByTier(item.product as any, tier);
      return {
        productId: item.productId,
        quantity,
        price,
        orderItemId: item.id
      };
    });

    const invoicePayload = {
      documentType: selectedOrder.customer?.name || selectedOrder.customerName ? 'sales_note' : 'consumer_final',
      customer: {
        name: selectedOrder.customer.name,
        email: selectedOrder.customer.email,
        phone: selectedOrder.customer.phone,
        identificationType: selectedOrder.customer.identificationType,
        identificationNumber: selectedOrder.customer.identificationNumber,
        address: selectedOrder.customer.address
      },
      items: invoiceItems
    };

    setInvoiceLoading(true);
    try {
      const invoice = await apiService.createInvoice(invoicePayload as any);
      alert(`Factura creada: ${invoice.invoiceNumber || invoice.id}`);

      const refreshedOrders = await loadOrders();
      const updated = refreshedOrders.find(order => order.id === orderId) || null;
      setSelectedOrder(updated);
      setInvoiceQuantities({});
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Error creando la factura');
    } finally {
      setInvoiceLoading(false);
    }
  };

  // 🔍 Normalizar texto para búsqueda flexible
  const filteredProducts = products.filter(p => {
    const s = filters.search.toLowerCase();

    return s === '' || p.name.toLowerCase().includes(s) || p.partnumber.toLowerCase().includes(s);
  });

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
        </div>
      </div>

      {!isOnline && <Alert variant='warning'>Modo offline - Los cambios se sincronizarán cuando se restablezca la conexión</Alert>}

      <Button variant='primary' className='sales-orders-fab' onClick={() => setShowCreateModal(true)} disabled={!isOnline && loading} style={{ display: showCreateModal || !!selectedOrder ? 'none' : 'flex' }}>
        +
      </Button>

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
              <div className='mb-2 d-flex flex-column'>
                <small className='text-muted'>Cliente</small>
                <b>{order.customer?.name}</b>
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
                <Button
                  variant='outline-info'
                  size='sm'
                  onClick={() => {
                    setSelectedOrder(order);
                    setInvoiceQuantities({});
                    setInvoicePriceTier({});
                  }}
                >
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

      {/* SCANNER */}
      {showScanner && (
        <div className='modal d-block' style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <div className='modal-dialog modal-fullscreen'>
            <div className='modal-content bg-dark'>
              <div className='modal-header'>
                <h5 className='modal-title text-white'>📷 Escanear Código de Barras</h5>
                <button type='button' className='btn-close btn-close-white' onClick={() => setShowScanner(false)}></button>
              </div>
              <div className='modal-body p-0'>
                <div id='reader' style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
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
                <div className='d-flex mb-3 gap-2'>
                  {/* BUSCADOR */}
                  <div className='mb-4 d-flex'>
                    <input
                      className='form-control form-control-lg'
                      placeholder='🔍 Buscar por nombre o código de barras...'
                      onChange={e => setFilters({ search: e.target.value })}
                      style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                    />
                    {/* <button className='btn btn-light border d-flex align-items-center gap-2 shadow-sm' onClick={() => setShowScanner(true)}>
                      <span>📷</span>
                      <span className='d-none d-md-inline'>Escanear</span>
                    </button> */}
                  </div>
                </div>

                {/* 🔵 LISTA PRODUCTOS */}
                <div style={{ maxHeight: '200px', overflowY: 'auto' }} className='mb-3 border rounded p-2'>
                  {filteredProducts.map(product => (
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
                  <span>Cliente</span>
                  <strong>{selectedOrder.customer?.name || selectedOrder.customerName || 'N/A'}</strong>
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

              {/* BOTÓN FACTURAR SELECCIONADOS */}
              <div className='mb-3'>
                <Button variant='success' onClick={() => handleBulkInvoice(selectedOrder.id)} disabled={invoiceLoading || selectedOrder.status === 'cancelado' || !Object.values(invoiceQuantities).some(q => q > 0)}>
                  {invoiceLoading ? 'Facturando...' : '📄 Facturar Seleccionados'}
                </Button>
              </div>

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
                        <div>{selectedOrder.status === 'cancelado' ? getStatusBadge('cancelado') : getItemStatusBadge(item.status)}</div>
                      </div>
                    </div>

                    {/* 🔹 REMANENTE */}
                    <div className='d-flex justify-content-between align-items-center mb-2'>
                      <div>
                        <small className='text-muted'>Restante</small>
                        <div>{item.quantityRequested - item.quantityProcessed}</div>
                      </div>
                      <div>
                        <small className='text-muted'>Precio</small>
                        <Form.Select size='sm' value={invoicePriceTier[item.productId] || 1} onChange={e => setInvoicePriceTier({ ...invoicePriceTier, [item.productId]: Number(e.target.value) as 1 | 2 | 3 })}>
                          <option value={1}>Precio 1 - ${(Number((item.product as any)?.price) || 0).toFixed(2)}</option>
                          <option value={2}>Precio 2 - ${(Number((item.product as any)?.pricecaja) || Number((item.product as any)?.price) || 0).toFixed(2)}</option>
                          <option value={3}>Precio 3 - ${(Number((item.product as any)?.priceb) || Number((item.product as any)?.price) || 0).toFixed(2)}</option>
                        </Form.Select>
                      </div>
                    </div>

                    {/* 🔹 INPUT CANTIDAD FACTURAR */}
                    <div className='d-flex gap-2 mt-3 align-items-center'>
                      <Form.Control
                        type='number'
                        min={1}
                        max={item.quantityRequested - item.quantityProcessed}
                        placeholder='Cantidad a facturar'
                        value={invoiceQuantities[item.productId] || ''}
                        onChange={e =>
                          setInvoiceQuantities({
                            ...invoiceQuantities,
                            [item.productId]: Number(e.target.value)
                          })
                        }
                        style={{ maxWidth: '120px' }}
                        disabled={selectedOrder.status === 'cancelado' || item.quantityProcessed === item.quantityRequested}
                      />

                      <Button
                        disabled={selectedOrder.status === 'cancelado' || item.quantityProcessed === item.quantityRequested || invoiceLoading}
                        variant='outline-success'
                        size='sm'
                        className='w-100'
                        onClick={() => handleInvoiceItem(selectedOrder.id, item)}
                      >
                        {invoiceLoading ? 'Facturando...' : 'Facturar ahora'}
                      </Button>
                    </div>

                    {/* 🔹 BOTÓN RÁPIDO COMPLETAR */}
                    {item.quantityProcessed < item.quantityRequested && (
                      <Button
                        variant='outline-primary'
                        size='sm'
                        className='w-100 mt-2'
                        onClick={() => {
                          setInvoiceQuantities({
                            ...invoiceQuantities,
                            [item.productId]: item.quantityRequested - item.quantityProcessed
                          });
                        }}
                      >
                        ⚡ Usar restante
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

export default WholesaleSalesPage;
