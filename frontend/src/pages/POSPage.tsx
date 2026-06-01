import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Alert, Badge, Table, Modal, ModalHeader, ModalBody, ModalTitle } from 'react-bootstrap';
import type { RootState, AppDispatch } from '../redux/store';
import { fetchProductsStart, fetchProductsSuccess, fetchProductsFailure } from '../redux/slices/productSlice';
import type { Product, CreateOrderDTO } from '../../../shared/types';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';
import { Html5Qrcode } from 'html5-qrcode';

const POSPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { products } = useSelector((state: RootState) => state.products);

  const [cart, setCart] = useState<Array<{ product: Product; quantity: number; price: number }>>([]);
  //const [barcodeInput, setBarcodeInput] = useState('');
  //const [searchTerm, setSearchTerm] = useState('');
  //const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showCart, setShowCart] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'credit' | 'other'>('cash');
  const [receiveNow, setReceiveNow] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState<number | ''>('');
  const [receivedMethod, setReceivedMethod] = useState<'cash' | 'transfer' | 'other'>('cash');
  const [showAlert, setShowAlert] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [filters, setFilters] = useState({ search: '' });

  const barcodeRef = useRef<HTMLInputElement>(null);
  const itemsPerPage = 12;

  useEffect(() => {
    loadProducts();

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    barcodeRef.current?.focus();

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
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

  const loadProducts = async () => {
    dispatch(fetchProductsStart());
    try {
      let data;
      if (isOnline) {
        const res = await apiService.getProducts();
        data = res.products;
        await localDBService.saveProducts(data);
      } else {
        data = await localDBService.getProducts();
      }
      dispatch(fetchProductsSuccess({ products: data, totalCount: data.length }));
    } catch {
      dispatch(fetchProductsFailure('Error al cargar productos'));
    }
  };

  // 🔍 Normalizar texto para búsqueda flexible
  const filteredProducts = products.filter(p => {
    const s = filters.search.toLowerCase();

    return s === '' || p.name.toLowerCase().includes(s) || p.partnumber.toLowerCase().includes(s);
  });

  const paginatedProducts = useMemo(() => {
    const start = page * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, page]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const exists = prev.find(i => i.product.id === product.id);
      if (exists) {
        return prev.map(i => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { product, quantity: 1, price: product.price }];
    });

    setShowAlert(true);
    setTimeout(() => {
      setShowAlert(false);
    }, 2000);
  };

  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) return setCart(c => c.filter(i => i.product.id !== id));
    setCart(c => c.map(i => (i.product.id === id ? { ...i, quantity: qty } : i)));
  };

  const total = useMemo(() => cart.reduce((a, b) => a + b.quantity * b.price, 0), [cart]);

  const processPayment = async () => {
    if (!cart.length) return;

    const items = cart.map(i => ({ productId: i.product.id, quantity: i.quantity, price: i.price }));
    const paidNow = Number(receiveNow && receivedAmount ? receivedAmount : paymentMethod === 'credit' ? 0 : total) || 0;

    const invoicePayload: any = {
      items,
      paymentMethod: paymentMethod === 'credit' ? 'credit' : paymentMethod,
      amountReceived: paidNow,
      changeAmount: paidNow > total ? Number((paidNow - total).toFixed(2)) : 0
    };

    if (receiveNow && receivedMethod) {
      invoicePayload.paymentReference = receivedMethod;
    }

    if (isOnline) {
      try {
        const invoice = await apiService.createInvoice(invoicePayload);
        alert(`Factura creada: ${invoice.invoiceNumber || invoice.id}`);
      } catch (err: any) {
        console.error(err);
        alert(err?.message || 'Error al crear factura');
      }
    } else {
      await localDBService.addPendingEvent({
        id: `invoice_${Date.now()}`,
        type: 'crear_factura',
        data: invoicePayload,
        timestamp: new Date().toISOString(),
        synced: false
      });
      alert('Factura guardada offline');
    }

    setCart([]);
    setShowPayment(false);
    setShowCart(false);
    // reset payment fields
    setPaymentMethod('cash');
    setReceiveNow(false);
    setReceivedAmount('');
    setReceivedMethod('cash');
  };

  const createOrderFromCart = async () => {
    if (!cart.length) return;
    const order: CreateOrderDTO = {
      type: 'venta',
      items: cart.map(item => ({ productId: item.product.id, quantityRequested: item.quantity }))
    };

    if (isOnline) {
      try {
        const created = await apiService.createOrder(order);
        const id = created?.id || null;
        alert(id ? `Orden creada: #${id}` : 'Orden creada');
      } catch (err: any) {
        console.error(err);
        alert(err?.message || 'Error al crear orden');
      }
    } else {
      const tempId = Date.now();
      await localDBService.addPendingEvent({ id: `sale_${tempId}`, type: 'crear_orden', data: order, timestamp: new Date().toISOString(), synced: false });
      alert(`Orden guardada offline (id provisional: ${tempId})`);
    }

    setCart([]);
    setShowPayment(false);
    setShowCart(false);
  };

  return (
    <div className='container-fluid mt-3' style={{ position: 'relative', height: '100vh' }}>
      <Alert
        variant='success'
        style={{
          position: 'absolute',
          top: '2.5rem',
          left: '50%',
          transform: `translateX(-50%) translateY(${showAlert ? '0' : '-1000%'})`,
          zIndex: 999,
          transition: 'all .5s ease-in-out'
        }}
      >
        Producto agregado
      </Alert>
      {/* HEADER */}
      <div className='d-flex justify-content-between align-items-center mb-3'>
        <h3>🛒 POS Sistema</h3>
      </div>

      {!isOnline && <Alert variant='warning'>Modo offline activo</Alert>}

      <div className='row'>
        {/* 🟦 PRODUCTOS */}
        <div className='col-lg-8'>
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

          {/* SEARCH + CATEGORY FILTER */}
          <div className='d-flex mb-3 gap-2'>
            {/* BUSCADOR */}
            <div className='mb-4 d-flex'>
              <input className='form-control form-control-lg' placeholder='🔍 Buscar por nombre o código de barras...' onChange={e => setFilters({ search: e.target.value })} style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
              <button className='btn btn-light border d-flex align-items-center gap-2 shadow-sm' onClick={() => setShowScanner(true)}>
                <span>📷</span>
                <span className='d-none d-md-inline'>Escanear</span>
              </button>
            </div>
            {/* <Form.Select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
              <option value=''>Todas las categorías</option>
              {[...new Set(products.map(p => p.category))].map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Form.Select> */}
          </div>

          {/* GRID PRODUCTOS */}
          <div className='row'>
            {paginatedProducts.map(p => (
              <div key={p.id} className='col-6 col-md-3 col-xl-2 mb-3'>
                <Card className='h-100 shadow-sm' onClick={() => addToCart(p)} style={{ cursor: 'pointer', transition: '0.2s' }}>
                  <Card.Body className='p-2'>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                    <div className='text-muted' style={{ fontSize: 12 }}>
                      {p.partnumber}
                    </div>
                    <div className='mt-2 d-flex justify-content-between align-items-center'>
                      <strong>${p.price}</strong>
                      <Badge bg='secondary'>Stock {p.stock}</Badge>
                    </div>
                  </Card.Body>
                </Card>
              </div>
            ))}
          </div>

          {/* PAGINACIÓN */}
          <div className='d-flex justify-content-between mt-3'>
            <Button disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              ← Anterior
            </Button>
            <Button disabled={(page + 1) * itemsPerPage >= filteredProducts.length} onClick={() => setPage(p => p + 1)}>
              Siguiente →
            </Button>
          </div>
        </div>

        <Modal show={showCart} centered onHide={() => setShowCart(!showCart)}>
          <ModalHeader closeButton>
            <ModalTitle>Pedido</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <div className='col-lg-4'>
              <Card className='sticky-top' style={{ top: 10 }}>
                <Card.Header>🧾 Carrito</Card.Header>
                <Card.Body>
                  {cart.length === 0 ? (
                    <p className='text-muted'>Vacío</p>
                  ) : (
                    <>
                      <Table size='sm'>
                        <thead>
                          <tr>
                            <th>Prod</th>
                            <th>Cant</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cart.map(i => (
                            <tr key={i.product.id}>
                              <td>{i.product.name}</td>
                              <td className='d-flex align-items-center'>
                                <Button size='sm' variant='outline-secondary' onClick={() => updateQty(i.product.id, i.quantity - 1)}>
                                  -
                                </Button>
                                <span className='mx-2'>{i.quantity}</span>
                                <Button size='sm' variant='outline-secondary' onClick={() => updateQty(i.product.id, i.quantity + 1)}>
                                  +
                                </Button>
                              </td>
                              <td>${(i.price * i.quantity).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>

                      <hr />

                      <div className='d-flex justify-content-between'>
                        <strong>Total</strong>
                        <strong>${total.toFixed(2)}</strong>
                      </div>

                      <Button className='w-100 mt-2' variant='outline-primary' onClick={() => setShowPayment(true)}>
                        Seleccionar pago
                      </Button>

                      <Button
                        className='w-100 mt-2'
                        variant='success'
                        onClick={() => {
                          setShowPayment(true);
                        }}
                      >
                        💰 Procesar venta
                      </Button>
                    </>
                  )}
                </Card.Body>
              </Card>
            </div>
          </ModalBody>
        </Modal>

        {/* 🟩 CARRITO */}
        <Modal show={showPayment} centered onHide={() => setShowPayment(false)}>
          <ModalHeader closeButton>
            <ModalTitle>Procesar pago</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <div className='d-flex flex-column gap-2'>
              <div>
                <label className='form-label'>Método de pago</label>
                <select className='form-select' value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}>
                  <option value='cash'>Efectivo</option>
                  <option value='card'>Tarjeta</option>
                  <option value='transfer'>Transferencia</option>
                  <option value='credit'>Crédito</option>
                  <option value='other'>Otro</option>
                </select>
              </div>

              {paymentMethod === 'credit' && (
                <div>
                  <div className='form-check mb-2'>
                    <input className='form-check-input' type='checkbox' checked={receiveNow} id='receiveNow' onChange={e => setReceiveNow(e.target.checked)} />
                    <label className='form-check-label' htmlFor='receiveNow'>
                      Recibir abono ahora (opcional)
                    </label>
                  </div>

                  {receiveNow && (
                    <div className='d-flex gap-2 align-items-center'>
                      <input type='number' className='form-control' placeholder='Monto recibido' value={receivedAmount as any} onChange={e => setReceivedAmount(e.target.value === '' ? '' : Number(e.target.value))} />
                      <select className='form-select' value={receivedMethod} onChange={e => setReceivedMethod(e.target.value as any)}>
                        <option value='cash'>Efectivo</option>
                        <option value='transfer'>Transferencia</option>
                        <option value='other'>Otro</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className='mt-2'>
                <strong>Total:</strong> ${total.toFixed(2)}
              </div>

              <div className='d-flex gap-2 mt-3'>
                <Button variant='secondary' onClick={() => setShowPayment(false)}>
                  Cancelar
                </Button>
                <Button variant='outline-success' onClick={createOrderFromCart}>
                  Guardar como orden
                </Button>
                <Button variant='primary' onClick={processPayment}>
                  Confirmar pago
                </Button>
              </div>
            </div>
          </ModalBody>
        </Modal>
      </div>
      <button
        className='btn shadow'
        style={{
          position: 'absolute',
          bottom: '2.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999
        }}
        onClick={() => setShowCart(true)}
      >
        <svg xmlns='http://www.w3.org/2000/svg' height='30px' viewBox='0 -960 960 960' width='30px' fill='#48752C'>
          <path d='M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm0-80h480v-480h-80v80q0 17-11.5 28.5T600-520q-17 0-28.5-11.5T560-560v-80H400v80q0 17-11.5 28.5T360-520q-17 0-28.5-11.5T320-560v-80h-80v480Zm160-560h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-720ZM240-160v-480 480Z' />
        </svg>
      </button>
    </div>
  );
};

export default POSPage;
