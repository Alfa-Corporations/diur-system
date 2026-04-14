import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Form, InputGroup, Alert, Badge, Table } from 'react-bootstrap';
import type { RootState, AppDispatch } from '../redux/store';
import { fetchProductsStart, fetchProductsSuccess, fetchProductsFailure } from '../redux/slices/productSlice';
import type { Product } from '../../../shared/types';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';

const POSPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { products, loading } = useSelector((state: RootState) => state.products);

  const [cart, setCart] = useState<Array<{ product: Product; quantity: number; price: number }>>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const barcodeRef = useRef<HTMLInputElement>(null);

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

  // 🔥 FILTRO OPTIMIZADO
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return products.filter(p => p.name.toLowerCase().includes(term) || p.partnumber.toLowerCase().includes(term) || (p.barcode && p.barcode.toLowerCase().includes(term)));
  }, [products, searchTerm]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const exists = prev.find(i => i.product.id === product.id);

      if (exists) {
        return prev.map(i => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }

      return [...prev, { product, quantity: 1, price: product.price }];
    });
  };

  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) return setCart(c => c.filter(i => i.product.id !== id));

    setCart(c => c.map(i => (i.product.id === id ? { ...i, quantity: qty } : i)));
  };

  const total = useMemo(() => cart.reduce((a, b) => a + b.quantity * b.price, 0), [cart]);

  const handleBarcode = (value: string) => {
    const code = value.trim().replace(/[\n\r]/g, '');

    const product = products.find(p => p.barcode === code || p.partnumber === code);

    if (product) addToCart(product);
    else alert('Producto no encontrado');

    setBarcodeInput('');
  };

  const createSale = async () => {
    if (!cart.length) return;

    const order = {
      userId: 1,
      type: 'venta',
      customerName: 'Venta POS',
      items: cart.map(i => ({
        productId: i.product.id,
        quantityRequested: i.quantity,
        quantityProcessed: 0,
        status: 'pendiente'
      }))
    };

    if (isOnline) {
      await apiService.createOrder(order);
      alert('Venta procesada');
    } else {
      await localDBService.addPendingEvent({
        id: `sale_${Date.now()}`,
        type: 'crear_orden',
        data: order,
        timestamp: new Date().toISOString(),
        synced: false
      });

      alert('Guardado offline');
    }

    setCart([]);
  };

  return (
    <div className='container-fluid mt-3'>
      {/* HEADER */}
      <div className='d-flex justify-content-between align-items-center mb-3'>
        <h3>🛒 POS Sistema</h3>
        <Button variant='outline-secondary' onClick={() => window.history.back()}>
          ← Volver
        </Button>
      </div>

      {!isOnline && <Alert variant='warning'>Modo offline activo</Alert>}

      <div className='row'>
        {/* 🟦 PRODUCTOS */}
        <div className='col-lg-8'>
          {/* BARCODE */}
          <Card className='mb-3'>
            <Card.Body>
              <InputGroup>
                <InputGroup.Text>📦 Código</InputGroup.Text>
                <Form.Control
                  ref={barcodeRef}
                  value={barcodeInput}
                  placeholder='Escanear o escribir...'
                  onChange={e => {
                    const v = e.target.value;
                    setBarcodeInput(v);

                    if (v.includes('\n')) handleBarcode(v);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleBarcode(barcodeInput);
                  }}
                />
              </InputGroup>
            </Card.Body>
          </Card>

          {/* SEARCH */}
          <Form.Control className='mb-3' placeholder='Buscar producto...' value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />

          {/* GRID PRODUCTOS */}
          <div className='row'>
            {filteredProducts.slice(0, 24).map(p => (
              <div key={p.id} className='col-6 col-md-4 col-xl-3 mb-3'>
                <Card
                  className='h-100 shadow-sm'
                  onClick={() => addToCart(p)}
                  style={{
                    cursor: 'pointer',
                    transition: '0.2s'
                  }}
                >
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
        </div>

        {/* 🟩 CARRITO */}
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
                          <td>
                            <Form.Control size='sm' type='number' value={i.quantity} onChange={e => updateQty(i.product.id, Number(e.target.value))} style={{ width: 60 }} />
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

                  <Button className='w-100 mt-3' variant='success' onClick={createSale}>
                    💰 Procesar venta
                  </Button>
                </>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default POSPage;
