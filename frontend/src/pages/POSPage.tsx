import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Form, Alert, Badge, Table, Modal, ModalHeader, ModalBody, ModalTitle } from 'react-bootstrap';
import type { RootState, AppDispatch } from '../redux/store';
import { fetchProductsStart, fetchProductsSuccess, fetchProductsFailure } from '../redux/slices/productSlice';
import type { Product, CreateOrderDTO } from '../../../shared/types';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';

const POSPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { products } = useSelector((state: RootState) => state.products);

  const [cart, setCart] = useState<Array<{ product: Product; quantity: number; price: number }>>([]);
  //const [barcodeInput, setBarcodeInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showCart, setShowCart] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

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
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const filteredProducts = useMemo(() => {
    const term = normalize(searchTerm);
    return products.filter(p => {
      const matchesTerm = [p.name, p.partnumber, p.barcode, p.codigo2, p.codigo3, p.codigo4].filter(Boolean).some(field => normalize(field!).includes(term));

      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      return matchesTerm && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

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

    setShowAlert(true)
    setTimeout(() => {
      setShowAlert(false);
    }, 2000);
  };

  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) return setCart(c => c.filter(i => i.product.id !== id));
    setCart(c => c.map(i => (i.product.id === id ? { ...i, quantity: qty } : i)));
  };

  const total = useMemo(() => cart.reduce((a, b) => a + b.quantity * b.price, 0), [cart]);

  /* const handleBarcode = (value: string) => {
    const code = value.trim().replace(/[\n\r]/g, '');
    const product = products.find(p => p.barcode === code || p.partnumber === code);
    if (product) addToCart(product);
    else alert('Producto no encontrado');
    setBarcodeInput('');
  }; */

  const createSale = async () => {
    if (!cart.length) return;
    const order: CreateOrderDTO = {
      type: 'venta',
      items: cart.map(item => ({
        productId: item.product.id,
        quantityRequested: item.quantity
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
        <Button variant='outline-secondary' onClick={() => window.history.back()}>
          ← Volver
        </Button>
      </div>

      {!isOnline && <Alert variant='warning'>Modo offline activo</Alert>}

      <div className='row'>
        {/* 🟦 PRODUCTOS */}
        <div className='col-lg-8'>
          {/* BARCODE */}
          {/* <Card className='mb-3'>
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
          </Card> */}

          {/* SEARCH + CATEGORY FILTER */}
          <div className='d-flex mb-3 gap-2'>
            <Form.Control placeholder='Buscar producto...' value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <Form.Select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
              <option value=''>Todas las categorías</option>
              {[...new Set(products.map(p => p.category))].map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Form.Select>
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

                      <Button className='w-100 mt-3' variant='success' onClick={createSale}>
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
