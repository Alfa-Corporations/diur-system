import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { fetchProductsStart, fetchProductsSuccess, createProductSuccess, updateProductSuccess, deleteProductSuccess } from '../redux/slices/productSlice';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';
import type { Product } from '../../../shared/types';
import JsBarcode from 'jsbarcode';

const LOCAL_STORAGE_KEY = 'products_cache';
const SUPPLIERS_CACHE_KEY = 'suppliers_cache';

interface Supplier {
  id: number;
  name: string;
}

interface ProductFormData {
  name: string;
  partnumber: string;
  brand: string;
  categoria: string;
  price: string;
  pricecaja: string;
  priceb: string;
  stock: string;
  supplierId: string;
  util: string;
  costiva: string;
  interno: string;
  piezas: string;
  importacion: boolean;
}

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { products } = useAppSelector(state => state.products);
  const { isOnline } = useAppSelector(state => state.sync);
  const { user } = useAppSelector(state => state.auth);

  const [showModal, setShowModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [filters, setFilters] = useState({ search: '' });

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    partnumber: '',
    brand: '',
    categoria: '',
    price: '',
    pricecaja: '',
    priceb: '',
    stock: '',
    supplierId: '',
    util: '',
    costiva: '',
    interno: '',
    piezas: '',
    importacion: false
  });

  // =========================
  // LOCAL STORAGE
  // =========================
  const saveToLocal = (data: Product[]) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  };

  const getFromLocal = (): Product[] => {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  };

  const cacheSuppliers = (data: Supplier[]) => {
    localStorage.setItem(SUPPLIERS_CACHE_KEY, JSON.stringify(data));
  };

  const getCachedSuppliers = (): Supplier[] => {
    const data = localStorage.getItem(SUPPLIERS_CACHE_KEY);
    return data ? JSON.parse(data) : [];
  };

  // =========================
  // LOAD SUPPLIERS
  // =========================
  const loadSuppliers = async () => {
    try {
      const cachedSuppliers = getCachedSuppliers();
      if (cachedSuppliers.length > 0) {
        setSuppliers(cachedSuppliers);
      }

      if (isOnline) {
        try {
          const response = await apiService.getSuppliers?.();
          if (response?.suppliers) {
            setSuppliers(response.suppliers);
            cacheSuppliers(response.suppliers);
          }
        } catch (apiError) {
          console.warn('Could not fetch suppliers from API, using cache');
          const cached = getCachedSuppliers();
          if (cached.length > 0) {
            setSuppliers(cached);
          }
        }
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
      const cached = getCachedSuppliers();
      if (cached.length > 0) {
        setSuppliers(cached);
      }
    }
  };

  // =========================
  // SYNC
  // =========================
  const syncProducts = async () => {
    try {
      const { products: apiProducts } = await apiService.getProducts();

      await localDBService.saveProducts(apiProducts);
      saveToLocal(apiProducts);

      dispatch(
        fetchProductsSuccess({
          products: apiProducts,
          totalCount: apiProducts.length
        })
      );

      console.log('✅ Inventario actualizado');
    } catch {
      console.log('⚠️ Sync falló');
    }
  };

  // =========================
  // LOAD
  // =========================
  const loadProducts = async () => {
    dispatch(fetchProductsStart());

    const local = getFromLocal();

    if (local.length) {
      dispatch(
        fetchProductsSuccess({
          products: local,
          totalCount: local.length
        })
      );
    }

    if (isOnline) {
      await syncProducts();
    }

    await loadSuppliers();
  };

  useEffect(() => {
    void loadProducts();
  }, [isOnline]);

  // =========================
  // AUTO SYNC
  // =========================
  useEffect(() => {
    const interval = setInterval(
      () => {
        const hour = new Date().getHours();

        if (hour === 8 || hour === 14) {
          void syncProducts();
        }
      },
      1000 * 60 * 30
    );

    return () => clearInterval(interval);
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

  // =========================
  // FILTER
  // =========================
  const filteredProducts = products.filter(p => {
    const s = filters.search.toLowerCase();

    return s === '' || p.name.toLowerCase().includes(s) || p.partnumber.toLowerCase().includes(s);
  });

  // =========================
  // CRUD
  // =========================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('El nombre del producto es obligatorio');
      return;
    }

    const data: any = {
      name: formData.name,
      partnumber: formData.partnumber,
      brand: formData.brand,
      categoria: formData.categoria,
      price: formData.price ? parseFloat(formData.price) : 0,
      pricecaja: formData.pricecaja ? parseFloat(formData.pricecaja) : 0,
      priceb: formData.priceb ? parseFloat(formData.priceb) : 0,
      stock: formData.stock ? parseInt(formData.stock) : 0,
      supplierId: formData.supplierId ? parseInt(formData.supplierId) : null,
      util: formData.util ? parseFloat(formData.util) : 0,
      costiva: formData.costiva ? parseFloat(formData.costiva) : 0,
      interno: formData.interno,
      piezas: formData.piezas ? parseInt(formData.piezas) : null,
      importacion: formData.importacion
    };

    try {
      if (editingProduct) {
        const updated = await apiService.updateProduct(editingProduct.id, data);
        dispatch(updateProductSuccess(updated));
      } else {
        const created = await apiService.createProduct(data);
        dispatch(createProductSuccess(created));
      }

      setShowModal(false);
      resetForm();
      await loadProducts();
    } catch (error) {
      console.error('Error al guardar producto:', error);
      alert('Error al guardar el producto');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      partnumber: '',
      brand: '',
      categoria: '',
      price: '',
      pricecaja: '',
      priceb: '',
      stock: '',
      supplierId: '',
      util: '',
      costiva: '',
      interno: '',
      piezas: '',
      importacion: false
    });
    setEditingProduct(null);
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      partnumber: product.partnumber || '',
      brand: (product as any).brand || '',
      categoria: (product as any).categoria || '',
      price: product.price?.toString() || '',
      pricecaja: (product as any).pricecaja?.toString() || '',
      priceb: (product as any).priceb?.toString() || '',
      stock: product.stock?.toString() || '',
      supplierId: (product as any).supplierId?.toString() || '',
      util: (product as any).util?.toString() || '',
      costiva: (product as any).costiva?.toString() || '',
      interno: (product as any).interno || '',
      piezas: (product as any).piezas?.toString() || '',
      importacion: (product as any).importacion || false
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Está seguro de eliminar este producto?')) {
      try {
        await apiService.deleteProduct(id);
        dispatch(deleteProductSuccess(id));
        await loadProducts();
      } catch (error) {
        console.error('Error al eliminar producto:', error);
      }
    }
  };

  const canManage = user?.permissions?.some(p => ['crear_producto', 'actualizar_producto', 'eliminar_producto'].includes(p.name));

  const handleOpenModal = () => {
    resetForm();
    setShowModal(true);
  };

  // =========================
  // BARCODE FUNCTIONS
  // =========================
  const generateBarcode = (partnumber: string): string => {
    const canvas = document.createElement('canvas');
    try {
      JsBarcode(canvas, partnumber || 'N/A', {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: true
      });
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error generando código de barras:', error);
      return '';
    }
  };

  const downloadBarcode = (product: Product) => {
    try {
      const barcode = generateBarcode(product.partnumber);
      if (!barcode) {
        alert('No se pudo generar el código de barras');
        return;
      }

      const link = document.createElement('a');
      link.href = barcode;
      link.download = `barcode-${product.partnumber || product.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error descargando código de barras:', error);
      alert('Error al descargar el código de barras');
    }
  };

  const printBarcode = (product: Product) => {
    try {
      const barcode = generateBarcode(product.partnumber);
      if (!barcode) {
        alert('No se pudo generar el código de barras');
        return;
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Por favor, habilita las ventanas emergentes');
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>Código de Barras - ${product.name}</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                font-family: Arial, sans-serif;
                background: white;
              }
              .barcode-container {
                text-align: center;
                padding: 20px;
                border: 1px solid #ccc;
                border-radius: 8px;
                background: white;
              }
              img {
                max-width: 100%;
                height: auto;
                margin: 10px 0;
              }
              h3, p {
                margin: 5px 0;
              }
              code {
                background: #f0f0f0;
                padding: 5px 10px;
                border-radius: 4px;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class='barcode-container'>
              <h3>${product.name}</h3>
              <img src='${barcode}' alt='Barcode'/>
              <p><code>${product.partnumber}</code></p>
              <p>💲 ${(Number(product.price) || 0).toFixed(2)}</p>
              <p style="font-size: 12px; color: #666;">Stock: ${product.stock}</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error('Error imprimiendo código de barras:', error);
      alert('Error al imprimir el código de barras');
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div className='container-fluid p-4' style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div className='mb-4 text-center'>
        {/* TÍTULO */}
        <h2 className='fw-bold mb-3'>📦 Gestión de Productos</h2>

        {/* BOTONES */}
        <div className='d-flex justify-content-center align-items-center gap-2 flex-wrap'>
          <button className='btn btn-light border d-flex align-items-center gap-2 px-3 shadow-sm' onClick={syncProducts}>
            <span>🔄</span>
            <span className='d-none d-md-inline'>Actualizar</span>
          </button>

          <button className='btn btn-light border d-flex align-items-center gap-2 px-3 shadow-sm' onClick={() => setShowScanner(true)}>
            <span>📷</span>
            <span className='d-none d-md-inline'>Escanear</span>
          </button>

          <button className='btn btn-light border d-flex align-items-center gap-2 px-3 shadow-sm' onClick={() => navigate('/products/importer')}>
            <span>📥</span>
            <span className='d-none d-md-inline'>Importar</span>
          </button>

          {canManage && (
            <button className='btn btn-primary d-flex align-items-center gap-2 px-3 shadow-sm' onClick={handleOpenModal}>
              <span>➕</span>
              <span>Nuevo Producto</span>
            </button>
          )}
        </div>
      </div>

      {/* BUSCADOR */}
      <div className='mb-4'>
        <input className='form-control form-control-lg' placeholder='🔍 Buscar por nombre o código de barras...' onChange={e => setFilters({ search: e.target.value })} style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
      </div>

      {/* LISTA */}
      <div className='row'>
        {filteredProducts.length === 0 ? (
          <div className='col-12'>
            <div className='alert alert-info text-center'>
              <strong>No hay productos</strong>. {canManage && 'Haz clic en "Nuevo Producto" para crear uno.'}
            </div>
          </div>
        ) : (
          filteredProducts.map(p => (
            <div key={p.id} className='col-md-6 col-lg-4 mb-4'>
              <div className='card shadow-sm h-100' style={{ borderRadius: '12px', overflow: 'hidden', border: 'none' }}>
                <div className='card-body'>
                  <h5 className='card-title fw-bold mb-2'>{p.name}</h5>

                  <div className='mb-2'>
                    <small className='text-muted'>Código:</small>
                    <p className='mb-1'>
                      <code>{p.partnumber}</code>
                    </p>
                  </div>

                  <div className='row text-center mb-2'>
                    <div className='col-6'>
                      <small className='text-muted'>Precio A</small>
                      <p className='mb-0 fw-bold text-success'>${(Number(p.price) || 0).toFixed(2)}</p>
                    </div>
                    <div className='col-6'>
                      <small className='text-muted'>Stock</small>
                      <p className='mb-0 fw-bold'>{p.stock}</p>
                    </div>
                  </div>

                  {(p as any).pricecaja || (p as any).priceb ? (
                    <div className='row text-center mb-2'>
                      {(p as any).pricecaja && (
                        <div className='col-6'>
                          <small className='text-muted'>Precio B</small>
                          <p className='mb-0 fw-bold'>${(Number((p as any).pricecaja) || 0).toFixed(2)}</p>
                        </div>
                      )}
                      {(p as any).priceb && (
                        <div className='col-6'>
                          <small className='text-muted'>Precio C</small>
                          <p className='mb-0 fw-bold'>${(Number((p as any).priceb) || 0).toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {(p as any).categoria && (
                    <div className='mb-2'>
                      <span className='badge bg-info'>{(p as any).categoria}</span>
                    </div>
                  )}

                  {/* BOTONES DE CÓDIGO DE BARRAS */}
                  <div className='d-flex gap-2 mt-3 mb-3'>
                    <button className='btn btn-sm btn-outline-primary flex-grow-1' onClick={() => downloadBarcode(p)} title='Descargar código de barras'>
                      📥 Descargar
                    </button>
                    <button className='btn btn-sm btn-outline-secondary flex-grow-1' onClick={() => printBarcode(p)} title='Imprimir código de barras'>
                      🖨️ Imprimir
                    </button>
                  </div>

                  {canManage && (
                    <div className='d-flex gap-2 mt-3'>
                      <button className='btn btn-sm btn-warning flex-grow-1' onClick={() => handleEditClick(p)}>
                        ✏️ Editar
                      </button>
                      <button className='btn btn-sm btn-danger flex-grow-1' onClick={() => handleDelete(p.id)}>
                        🗑️ Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

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

      {/* MODAL MEJORADO */}
      {showModal && (
        <div className='modal d-block' style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className='modal-dialog modal-lg'>
            <div className='modal-content'>
              <div className='modal-header bg-primary text-white'>
                <h5 className='modal-title fw-bold'>{editingProduct ? '✏️ Editar Producto' : '➕ Crear Nuevo Producto'}</h5>
                <button
                  type='button'
                  className='btn-close btn-close-white'
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                ></button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className='modal-body' style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                  {/* INFORMACIÓN BÁSICA */}
                  <div className='mb-4'>
                    <h6 className='fw-bold mb-3'>📋 Información Básica</h6>

                    <div className='row mb-3'>
                      <div className='col-md-8'>
                        <label className='form-label fw-bold'>Nombre *</label>
                        <input className='form-control' placeholder='Nombre del producto' value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                      </div>
                      <div className='col-md-4'>
                        <label className='form-label fw-bold'>Código/Partnumber</label>
                        <input className='form-control' placeholder='P-123456' value={formData.partnumber} onChange={e => setFormData({ ...formData, partnumber: e.target.value })} />
                      </div>
                    </div>

                    <div className='row mb-3'>
                      <div className='col-md-6'>
                        <label className='form-label fw-bold'>Marca</label>
                        <input className='form-control' placeholder='Marca del producto' value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} />
                      </div>
                      <div className='col-md-6'>
                        <label className='form-label fw-bold'>Categoría</label>
                        <input className='form-control' placeholder='Ej: Electrónica, Herramientas' value={formData.categoria} onChange={e => setFormData({ ...formData, categoria: e.target.value })} />
                      </div>
                    </div>

                    <div className='row mb-3'>
                      <div className='col-md-6'>
                        <label className='form-label fw-bold'>Interno</label>
                        <input className='form-control' placeholder='Código interno' value={formData.interno} onChange={e => setFormData({ ...formData, interno: e.target.value })} />
                      </div>
                      <div className='col-md-6'>
                        <label className='form-label fw-bold'>Proveedor</label>
                        <select className='form-control' value={formData.supplierId} onChange={e => setFormData({ ...formData, supplierId: e.target.value })}>
                          <option value=''>-- Seleccionar proveedor --</option>
                          {suppliers.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <hr />

                  {/* PRECIOS */}
                  <div className='mb-4'>
                    <h6 className='fw-bold mb-3'>💰 Precios</h6>

                    <div className='row mb-3'>
                      <div className='col-md-6'>
                        <label className='form-label fw-bold'>Precio A (Venta Estándar)</label>
                        <input className='form-control' type='number' step='0.01' placeholder='0.00' value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                      </div>
                      <div className='col-md-6'>
                        <label className='form-label fw-bold'>Precio B (Caja)</label>
                        <input className='form-control' type='number' step='0.01' placeholder='0.00' value={formData.pricecaja} onChange={e => setFormData({ ...formData, pricecaja: e.target.value })} />
                      </div>
                    </div>

                    <div className='row mb-3'>
                      <div className='col-md-6'>
                        <label className='form-label fw-bold'>Precio C (Mayorista)</label>
                        <input className='form-control' type='number' step='0.01' placeholder='0.00' value={formData.priceb} onChange={e => setFormData({ ...formData, priceb: e.target.value })} />
                      </div>
                      <div className='col-md-6'>
                        <label className='form-label fw-bold'>Costo IVA</label>
                        <input className='form-control' type='number' step='0.01' placeholder='0.00' value={formData.costiva} onChange={e => setFormData({ ...formData, costiva: e.target.value })} />
                      </div>
                    </div>

                    <div className='row mb-3'>
                      <div className='col-md-6'>
                        <label className='form-label fw-bold'>Utilidad</label>
                        <input className='form-control' type='number' step='0.01' placeholder='0.00' value={formData.util} onChange={e => setFormData({ ...formData, util: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  <hr />

                  {/* STOCK E INVENTARIO */}
                  <div className='mb-4'>
                    <h6 className='fw-bold mb-3'>📊 Stock e Inventario</h6>

                    <div className='row mb-3'>
                      <div className='col-md-6'>
                        <label className='form-label fw-bold'>Stock Actual</label>
                        <input className='form-control' type='number' placeholder='0' value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} />
                      </div>
                      <div className='col-md-6'>
                        <label className='form-label fw-bold'>Piezas por Caja</label>
                        <input className='form-control' type='number' placeholder='0' value={formData.piezas} onChange={e => setFormData({ ...formData, piezas: e.target.value })} />
                      </div>
                    </div>

                    <div className='form-check'>
                      <input className='form-check-input' type='checkbox' id='importacionCheck' checked={formData.importacion} onChange={e => setFormData({ ...formData, importacion: e.target.checked })} />
                      <label className='form-check-label' htmlFor='importacionCheck'>
                        Es producto de importación
                      </label>
                    </div>
                  </div>
                </div>

                <div className='modal-footer'>
                  <button
                    type='button'
                    className='btn btn-secondary'
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </button>
                  <button type='submit' className='btn btn-primary'>
                    {editingProduct ? 'Actualizar' : 'Guardar'} Producto
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
