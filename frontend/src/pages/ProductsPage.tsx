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
    return s === '' || p.name.toLowerCase().includes(s) || p.partnumber.toLowerCase().includes(s) || p.codigo2?.toLowerCase().includes(s) || p.codigo3?.toLowerCase().includes(s) || p.codigo4?.toLowerCase().includes(s);
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
        <div className='d-flex justify-content-center align-items-center gap-2'>
          {canManage && (
            <button className='btn d-flex align-items-center gap-2 px-3 shadow-sm' onClick={handleOpenModal}>
              <span>
                <svg width='24px' height='24px' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                  <path
                    d='M13 3H7C5.89543 3 5 3.89543 5 5V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V9M13 3L19 9M13 3V8C13 8.55228 13.4477 9 14 9H19M12 13V17M14 15H10'
                    stroke='#75a379'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </span>
            </button>
          )}
          <button className='btn border d-flex align-items-center gap-2 px-3 shadow-sm' onClick={syncProducts}>
            <span>
              <svg width='24px' height='24px' viewBox='-3 0 24 24' id='meteor-icon-kit__regular-sync' fill='none' xmlns='http://www.w3.org/2000/svg'>
                <path
                  fill-rule='evenodd'
                  clip-rule='evenodd'
                  d='M9.427 5.01281L10.7071 6.29289C11.0976 6.68342 11.0976 7.31658 10.7071 7.70711C10.3166 8.09763 9.6834 8.09763 9.2929 7.70711L6.29289 4.70711C5.90237 4.31658 5.90237 3.68342 6.29289 3.29289L9.2929 0.292893C9.6834 -0.0976311 10.3166 -0.0976311 10.7071 0.292893C11.0976 0.683418 11.0976 1.31658 10.7071 1.70711L9.4053 3.00896C14.1877 3.22089 18 7.16525 18 12C18 14.3981 17.0565 16.6496 15.4053 18.3224C15.0173 18.7154 14.3841 18.7195 13.9911 18.3315C13.598 17.9436 13.5939 17.3104 13.9819 16.9174C15.2673 15.6152 16 13.8668 16 12C16 8.2774 13.0942 5.23349 9.427 5.01281zM8.5947 20.991C3.81226 20.7791 0 16.8348 0 12C0 9.59706 0.94734 7.34135 2.60451 5.66773C2.9931 5.27528 3.62625 5.27215 4.0187 5.66074C4.41115 6.04933 4.41428 6.68249 4.02569 7.07494C2.73567 8.37777 2 10.1295 2 12C2 15.7226 4.90584 18.7665 8.573 18.9872L7.2929 17.7071C6.90237 17.3166 6.90237 16.6834 7.2929 16.2929C7.6834 15.9024 8.3166 15.9024 8.7071 16.2929L11.7071 19.2929C12.0976 19.6834 12.0976 20.3166 11.7071 20.7071L8.7071 23.7071C8.3166 24.0976 7.6834 24.0976 7.2929 23.7071C6.90237 23.3166 6.90237 22.6834 7.2929 22.2929L8.5947 20.991z'
                  fill='#75a379'
                />
              </svg>
            </span>
          </button>

          <button className='btn border d-flex align-items-center gap-2 px-3 shadow-sm' onClick={() => setShowScanner(true)}>
            <span>
              <svg width='24px' height='24px' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                <path
                  d='M7 21H5.4A2.4 2.4 0 0 1 3 18.6V17m14 4h1.6a2.4 2.4 0 0 0 2.4-2.4V17m0-10V5.4A2.4 2.4 0 0 0 18.6 3H17M7 3H5.4A2.4 2.4 0 0 0 3 5.4V7'
                  stroke='#75a379'
                  stroke-width='1.5'
                  stroke-miterlimit='10'
                  stroke-linecap='round'
                  stroke-linejoin='round'
                />
                <path d='M1 12h22' stroke='#75a379' stroke-width='1.5' stroke-miterlimit='10' stroke-linecap='round' />
              </svg>
            </span>
          </button>

          <button className='btn border d-flex align-items-center gap-2 px-3 shadow-sm' onClick={() => navigate('/products/importer')}>
            <span>
              <svg width='24px' height='24px' viewBox='0 0 24 24' version='1.1' xmlns='http://www.w3.org/2000/svg'>
                <g id='1' stroke='none' stroke-width='1' fill='none' fill-rule='evenodd'>
                  <g id='File' transform='translate(-240.000000, -144.000000)' fill-rule='nonzero'>
                    <g id='file_import_fill' transform='translate(240.000000, 144.000000)'>
                      <path
                        d='M24,0 L24,24 L0,24 L0,0 L24,0 Z M12.5934901,23.257841 L12.5819402,23.2595131 L12.51svg77,23.2950439 L12.4918791,23.2987469 L12.4918791,23.2987469 L12.4767152,23.2950439 L12.4056548,23.2595131 C12.3958229,23.2563662 12.3870493,23.2590235 12.3821421,23.2649074 L12.3780323,23.275831 L12.360941,23.7031097 L12.3658947,23.7234994 L12.3769048,23.7357139 L12.4804777,23.8096931 L12.4953491,23.8136134 L12.4953491,23.8136134 L12.5071152,23.8096931 L12.6106902,23.7357139 L12.6232938,23.7196733 L12.6232938,23.7196733 L12.6266527,23.7031097 L12.609561,23.275831 C12.6075724,23.2657013 12.6010112,23.2592993 12.5934901,23.257841 L12.5934901,23.257841 Z M12.8583906,23.1452862 L12.8445485,23.1473072 L12.6598443,23.2396597 L12.6498822,23.2499052 L12.6498822,23.2499052 L12.6471943,23.2611114 L12.6650943,23.6906389 L12.6699349,23.7034178 L12.6699349,23.7034178 L12.678386,23.7104931 L12.8793402,23.8032389 C12.8914285,23.8068999 12.9022333,23.8029875 12.9078286,23.7952264 L12.9118235,23.7811639 L12.8776777,23.1665331 C12.8752882,23.1545897 12.8674102,23.1470016 12.8583906,23.1452862 L12.8583906,23.1452862 Z M12.1430473,23.1473072 C12.1332178,23.1423925 12.1221763,23.1452606 12.1156365,23.1525954 L12.1099173,23.1665331 L12.0757714,23.7811639 C12.0751323,23.7926639 12.0828099,23.8018602 12.0926481,23.8045676 L12.108256,23.8032389 L12.3092106,23.7104931 L12.3186497,23.7024347 L12.3186497,23.7024347 L12.3225043,23.6906389 L12.340401,23.2611114 L12.337245,23.2485176 L12.337245,23.2485176 L12.3277531,23.2396597 L12.1430473,23.1473072 Z'
                        id='MingCute'
                        fill-rule='nonzero'
                      ></path>
                      <path
                        d='M12,2 L12,8.5 C12,9.32843 12.6716,10 13.5,10 L20,10 L20,20 C20,21.1046 19.1046,22 18,22 L6,22 C4.89543,22 4,21.1046 4,20 L4,19 L7.41416,19 L6.29284,20.1213 C5.90231,20.5118 5.90231,21.145 6.29284,21.5355 C6.68336,21.9261 7.31652,21.9261 7.70705,21.5355 L10.5355,18.7071 C10.926,18.3166 10.926,17.6834 10.5355,17.2929 L7.70705,14.4645 C7.31652,14.0739 6.68336,14.0739 6.29284,14.4645 C5.90231,14.855 5.90231,15.4882 6.29284,15.8787 L7.41416,17 L4,17 L4,4 C4,2.89543 4.89543,2 6,2 L12,2 Z M4,17 L4,19 L3,19 C2.44772,19 2,18.5523 2,18 C2,17.4477 2.44772,17 3,17 L4,17 Z M14,2.04336 C14.3759,2.12295 14.7241,2.30991 15,2.58579 L19.4142,7 C19.6901,7.27588 19.8771,7.62406 19.9566,8 L14,8 L14,2.04336 Z'
                        id='1'
                        fill='#75a379'
                      ></path>
                    </g>
                  </g>
                </g>
              </svg>
            </span>
          </button>
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
