import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Table, Card, Form, InputGroup, Alert, Badge } from 'react-bootstrap';
import type { RootState, AppDispatch } from '../redux/store';
import { fetchProductsStart, fetchProductsSuccess, fetchProductsFailure } from '../redux/slices/productSlice';
import type { Product } from '../../../shared/types';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';

/**
 * Página POS (Punto de Venta)
 * Interfaz para venta en local con lector de códigos de barras
 */
const POSPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { products, loading: productsLoading } = useSelector((state: RootState) => state.products);

  const [cart, setCart] = useState<Array<{ product: Product; quantity: number; price: number }>>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProducts();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Enfocar input de código de barras
    if (barcodeRef.current) {
      barcodeRef.current.focus();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadProducts = async () => {
    dispatch(fetchProductsStart());
    try {
      let productsData;
      if (isOnline) {
        const response = await apiService.getProducts();
        productsData = response.products;
        localDBService.saveProducts(productsData);
      } else {
        productsData = await localDBService.getProducts();
      }
      dispatch(fetchProductsSuccess({ products: productsData, totalCount: productsData.length }));
    } catch (error) {
      dispatch(fetchProductsFailure('Error al cargar productos'));
    }
  };

  const handleBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Detectar entrada rápida (posiblemente de scanner)
    // Los scanners suelen enviar un Enter al final
    if (value.includes('\n') || value.includes('\r')) {
      const barcode = value.replace(/[\n\r]/g, '').trim();
      if (barcode) {
        addProductByBarcode(barcode);
      }
      setBarcodeInput('');
    } else {
      setBarcodeInput(value);
    }
  };

  const addProductByBarcode = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode || p.partnumber === barcode);
    if (product) {
      addToCart(product);
    } else {
      // Intentar buscar por nombre/partnumber parcial
      const found = products.find(p => p.name.toLowerCase().includes(barcode.toLowerCase()) || p.partnumber.toLowerCase().includes(barcode.toLowerCase()));
      if (found) {
        addToCart(found);
      } else {
        alert(`Producto no encontrado: ${barcode}`);
      }
    }
  };

  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.product.id === product.id);
      if (existing) {
        return prevCart.map(item => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      } else {
        return [...prevCart, { product, quantity: 1, price: product.price }];
      }
    });
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart => prevCart.map(item => (item.product.id === productId ? { ...item, quantity } : item)));
  };

  const removeFromCart = (productId: number) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  const getTotal = () => {
    return cart.reduce((total, item) => total + item.quantity * item.price, 0);
  };

  const handleCreateSaleOrder = async () => {
    if (cart.length === 0) return;

    try {
      const orderData = {
        userId: 1, // TODO: obtener del auth
        type: 'sale' as const,
        customerName: 'Venta en Local',
        items: cart.map(item => ({
          productId: item.product.id,
          quantityRequested: item.quantity,
          quantityProcessed: 0,
          status: 'pending' as const
        }))
      };

      if (isOnline) {
        await apiService.createOrder(orderData);
        alert('Pedido de venta creado exitosamente');
      } else {
        await localDBService.addPendingEvent({
          id: `order_${Date.now()}`,
          type: 'crear_orden',
          data: orderData,
          timestamp: new Date().toISOString(),
          synced: false
        });
        alert('Pedido guardado para sincronización offline');
      }

      setCart([]);
    } catch (error) {
      alert('Error al crear el pedido de venta');
    }
  };

  const filteredProducts = products.filter(
    product => product.name.toLowerCase().includes(searchTerm.toLowerCase()) || product.partnumber.toLowerCase().includes(searchTerm.toLowerCase()) || (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className='container-fluid mt-4'>
      <div className='d-flex justify-content-between align-items-center mb-4'>
        <h2>🛒 Punto de Venta</h2>
        <Button variant='outline-secondary' onClick={() => window.history.back()}>
          ← Volver
        </Button>
      </div>

      {!isOnline && (
        <Alert variant='warning' className='mb-3'>
          ⚠️ Modo offline - Las ventas se sincronizarán cuando se restablezca la conexión
        </Alert>
      )}

      <div className='row'>
        {/* Panel de productos */}
        <div className='col-md-8'>
          <Card className='mb-4'>
            <Card.Header>
              <div className='d-flex justify-content-between align-items-center'>
                <h5 className='mb-0'>Productos</h5>
                <Form.Control type='text' placeholder='Buscar producto...' value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '250px' }} />
              </div>
            </Card.Header>
            <Card.Body>
              {/* Input para código de barras */}
              <InputGroup className='mb-3'>
                <InputGroup.Text>📱 Código de Barras</InputGroup.Text>
                <Form.Control
                  ref={barcodeRef}
                  type='text'
                  placeholder='Escanear código de barras...'
                  value={barcodeInput}
                  onChange={handleBarcodeInput}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (barcodeInput.trim()) {
                        addProductByBarcode(barcodeInput.trim());
                        setBarcodeInput('');
                      }
                    }
                  }}
                  autoFocus
                />
              </InputGroup>

              {productsLoading ? (
                <div className='text-center'>Cargando productos...</div>
              ) : (
                <div className='row'>
                  {filteredProducts.slice(0, 20).map(product => (
                    <div key={product.id} className='col-md-4 mb-3'>
                      <Card className='h-100 cursor-pointer' onClick={() => addToCart(product)} style={{ cursor: 'pointer' }}>
                        <Card.Body className='text-center'>
                          <Card.Title className='h6'>{product.name}</Card.Title>
                          <Card.Text>
                            <strong>${product.price}</strong>
                            <br />
                            <small className='text-muted'>partnumber: {product.partnumber}</small>
                            <br />
                            {product.barcode && <small className='text-muted'>Código: {product.barcode}</small>}
                          </Card.Text>
                          <Badge bg='secondary'>Stock: {product.stock}</Badge>
                        </Card.Body>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </div>

        {/* Carrito de compras */}
        <div className='col-md-4'>
          <Card className='sticky-top' style={{ top: '20px' }}>
            <Card.Header>
              <h5 className='mb-0'>Carrito de Compras</h5>
            </Card.Header>
            <Card.Body>
              {cart.length === 0 ? (
                <p className='text-muted text-center'>El carrito está vacío</p>
              ) : (
                <>
                  <Table size='sm'>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cant.</th>
                        <th>Precio</th>
                        <th>Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map(item => (
                        <tr key={item.product.id}>
                          <td className='small'>{item.product.name}</td>
                          <td>
                            <Form.Control type='number' min='1' value={item.quantity} onChange={e => updateQuantity(item.product.id, parseInt(e.target.value))} size='sm' style={{ width: '60px' }} />
                          </td>
                          <td>${item.price}</td>
                          <td>${(item.quantity * item.price).toFixed(2)}</td>
                          <td>
                            <Button variant='outline-danger' size='sm' onClick={() => removeFromCart(item.product.id)}>
                              ×
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>

                  <hr />
                  <div className='d-flex justify-content-between'>
                    <strong>Total:</strong>
                    <strong>${getTotal().toFixed(2)}</strong>
                  </div>

                  <div className='mt-3'>
                    <Button variant='success' className='w-100' onClick={handleCreateSaleOrder} disabled={!isOnline && cart.length === 0}>
                      💰 Procesar Venta
                    </Button>
                  </div>
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
