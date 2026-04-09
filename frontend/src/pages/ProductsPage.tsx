import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { fetchProductsStart, fetchProductsSuccess, createProductSuccess, updateProductSuccess, deleteProductSuccess } from '../redux/slices/productSlice';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';
import type { Product } from '../../../shared/types';

const LOCAL_STORAGE_KEY = 'products_cache';

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { products } = useAppSelector(state => state.products);
  const { isOnline } = useAppSelector(state => state.sync);
  const { user } = useAppSelector(state => state.auth);

  const [showModal, setShowModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [filters, setFilters] = useState({ search: '' });

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    partnumber: ''
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

    scanner.start(
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
          await scanner.stop();
          setShowScanner(false);
        } catch (error) {
          console.error('Error al procesar escaneo:', error);
        }
      },
      () => {
        // 👇 ignoramos errores frecuentes del escáner
      }
    );

    return () => {
      scanner.stop().catch(() => {});
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

    const data: any = {
      name: formData.name,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock),
      partnumber: formData.partnumber
    };

    if (editingProduct) {
      const updated = await apiService.updateProduct(editingProduct.id, data);
      dispatch(updateProductSuccess(updated));
    } else {
      const created = await apiService.createProduct(data);
      dispatch(createProductSuccess(created));
    }

    setShowModal(false);
  };

  const handleDelete = async (id: number) => {
    await apiService.deleteProduct(id);
    dispatch(deleteProductSuccess(id));
  };

  const canManage = user?.permissions?.some(p => ['crear_producto', 'actualizar_producto', 'eliminar_producto'].includes(p.name));

  // =========================
  // UI
  // =========================
  return (
    <div className='container p-4'>
      <div className='mb-4 text-center'>
        {/* TÍTULO */}
        <h2 className='fw-bold mb-3'>Productos</h2>

        {/* BOTONES */}
        <div className='d-flex justify-content-center align-items-center gap-2 '>
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
            <button className='btn btn-primary d-flex align-items-center gap-2 px-3 shadow-sm' onClick={() => setShowModal(true)}>
              <span>➕</span>
              <span>Nuevo</span>
            </button>
          )}
        </div>
      </div>

      {/* BUSCADOR */}
      <input className='form-control mb-3' placeholder='Buscar por nombre o código de barras...' onChange={e => setFilters({ search: e.target.value })} />

      {/* LISTA */}
      <div className='row'>
        {filteredProducts.map(p => (
          <div key={p.id} className='col-md-4 mb-3'>
            <div className='card shadow-sm'>
              <div className='card-body'>
                <h5>{p.name}</h5>
                <p>partnumber: {p.partnumber}</p>
                <p>💲 {p.price}</p>
                <p>Stock: {p.stock}</p>

                <div className='d-flex justify-content-end'>
                  <button className='btn btn-warning btn-sm me-2' onClick={() => setEditingProduct(p)}>
                    Editar
                  </button>
                  <button className='btn btn-danger btn-sm' onClick={() => handleDelete(p.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SCANNER */}
      {showScanner && (
        <div className='modal d-block bg-dark bg-opacity-75'>
          <div id='reader' style={{ width: '100%' }} />
          <button className='btn btn-danger w-100' onClick={() => setShowScanner(false)}>
            Cerrar
          </button>
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className='modal d-block'>
          <div className='modal-dialog'>
            <div className='modal-content'>
              <form onSubmit={handleSubmit}>
                <div className='modal-body'>
                  <input className='form-control mb-2' placeholder='Nombre' onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  <input className='form-control mb-2' placeholder='partnumber' onChange={e => setFormData({ ...formData, partnumber: e.target.value })} />
                  <input className='form-control mb-2' type='number' placeholder='Precio' onChange={e => setFormData({ ...formData, price: e.target.value })} />
                  <input className='form-control mb-2' type='number' placeholder='Stock' onChange={e => setFormData({ ...formData, stock: e.target.value })} />
                </div>

                <div className='modal-footer'>
                  <button className='btn btn-primary'>Guardar</button>
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
