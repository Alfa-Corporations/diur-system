import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { fetchProductsStart, fetchProductsSuccess, fetchProductsFailure, createProductSuccess, updateProductSuccess, deleteProductSuccess } from '../redux/slices/productSlice';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';
import type { Product } from '../../../shared/types';

/**
 * Página de Gestión de Productos
 * Lista, crea, edita y elimina productos
 */
const ProductsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { products, loading, error } = useAppSelector(state => state.products);
  const { isOnline } = useAppSelector(state => state.sync);
  const { user } = useAppSelector(state => state.auth);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    sku: '',
    category: ''
  });

  // Cargar productos al montar el componente
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    dispatch(fetchProductsStart());

    try {
      if (isOnline) {
        // Cargar desde API y guardar en local
        const { products: apiProducts } = await apiService.getProducts();
        await localDBService.saveProducts(apiProducts);
        dispatch(fetchProductsSuccess({ products: apiProducts, totalCount: apiProducts.length }));
      } else {
        // Cargar desde local storage
        const localProducts = await localDBService.getProducts();
        dispatch(fetchProductsSuccess({ products: localProducts, totalCount: localProducts.length }));
      }
    } catch (error: any) {
      dispatch(fetchProductsFailure(error.message));
      // Intentar cargar desde local como fallback
      try {
        const localProducts = await localDBService.getProducts();
        dispatch(fetchProductsSuccess({ products: localProducts, totalCount: localProducts.length }));
      } catch (localError) {
        dispatch(fetchProductsFailure('Error al cargar productos'));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const productData = {
      name: formData.name,
      description: formData.description || undefined,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock),
      sku: formData.sku,
      category: formData.category || undefined
    };

    try {
      if (editingProduct) {
        // Actualizar producto
        if (isOnline) {
          const updatedProduct = await apiService.updateProduct(editingProduct.id, productData);
          await localDBService.saveProduct(updatedProduct);
          dispatch(updateProductSuccess(updatedProduct));
        } else {
          // Guardar como evento pendiente
          const eventId = `update_product_${Date.now()}`;
          await localDBService.addPendingEvent({
            id: eventId,
            type: 'update_product',
            data: { id: editingProduct.id, ...productData },
            timestamp: new Date().toISOString(),
            synced: false
          });
          // Actualizar localmente
          const updatedProduct = { ...editingProduct, ...productData, updatedAt: new Date().toISOString() };
          await localDBService.saveProduct(updatedProduct);
          dispatch(updateProductSuccess(updatedProduct));
        }
      } else {
        // Crear producto
        if (isOnline) {
          const newProduct = await apiService.createProduct(productData);
          await localDBService.saveProduct(newProduct);
          dispatch(createProductSuccess(newProduct));
        } else {
          // Guardar como evento pendiente
          const eventId = `create_product_${Date.now()}`;
          await localDBService.addPendingEvent({
            id: eventId,
            type: 'create_product',
            data: productData,
            timestamp: new Date().toISOString(),
            synced: false
          });
          // Crear localmente con ID temporal
          const tempProduct: Product = {
            ...productData,
            id: Date.now(), // ID temporal
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as Product;
          await localDBService.saveProduct(tempProduct);
          dispatch(createProductSuccess(tempProduct));
        }
      }

      setShowModal(false);
      resetForm();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      stock: product.stock.toString(),
      sku: product.sku,
      category: product.category || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este producto?')) return;

    try {
      if (isOnline) {
        await apiService.deleteProduct(id);
        await localDBService.deleteProduct(id);
        dispatch(deleteProductSuccess(id));
      } else {
        // Marcar para eliminación pendiente
        await localDBService.addPendingEvent({
          id: `delete_product_${id}_${Date.now()}`,
          type: 'delete_product',
          data: { id },
          timestamp: new Date().toISOString(),
          synced: false
        });
        await localDBService.deleteProduct(id);
        dispatch(deleteProductSuccess(id));
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      stock: '',
      sku: '',
      category: ''
    });
    setEditingProduct(null);
  };

  const canManageProducts = user?.role === 'admin' || user?.role === 'warehouse';
  const activeProducts = products.filter(product => product.isActive).length;
  const lowStockProducts = products.filter(product => product.stock <= 10).length;
  const totalUnits = products.reduce((sum, product) => sum + product.stock, 0);

  return (
    <div className='page-shell container-fluid p-4'>
      <div className='page-header'>
        <div>
          <span className='eyebrow mb-2'>Inventario</span>
          <h2 className='mb-1'>Gestión de Productos</h2>
          <p className='mb-0'>Consulta, crea y edita productos con una vista limpia y adaptable.</p>
        </div>
        <div className='page-actions'>
          <button className='btn btn-outline-secondary' onClick={() => void loadProducts()}>
            Actualizar
          </button>
          {canManageProducts && (
            <button
              className='btn btn-primary'
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
            >
              ➕ Nuevo Producto
            </button>
          )}
        </div>
      </div>

      <div className='row g-3 mb-4'>
        <div className='col-12 col-md-4'>
          <div className='stat-card'>
            <div className='metric-label'>Productos activos</div>
            <div className='metric-value'>{activeProducts}</div>
          </div>
        </div>
        <div className='col-12 col-md-4'>
          <div className='stat-card'>
            <div className='metric-label'>Stock total</div>
            <div className='metric-value'>{totalUnits}</div>
          </div>
        </div>
        <div className='col-12 col-md-4'>
          <div className='stat-card'>
            <div className='metric-label'>Bajo inventario</div>
            <div className='metric-value'>{lowStockProducts}</div>
          </div>
        </div>
      </div>

      {!isOnline && <div className='alert offline-banner'>⚠️ Modo offline: los cambios se sincronizarán cuando vuelva la conexión.</div>}
      {error && <div className='alert alert-danger'>{error}</div>}

      <div className='section-card'>
        {loading ? (
          <div className='text-center py-4'>Cargando productos...</div>
        ) : (
          <div className='table-responsive'>
            <table className='table table-hover table-modern mb-0'>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>SKU</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Estado</th>
                  {canManageProducts && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id}>
                    <td className='fw-semibold'>{product.name}</td>
                    <td>{product.sku}</td>
                    <td>{product.category || '-'}</td>
                    <td>${product.price}</td>
                    <td>{product.stock}</td>
                    <td>
                      <span className={`badge ${product.isActive ? 'bg-success' : 'bg-danger'}`}>{product.isActive ? 'Activo' : 'Inactivo'}</span>
                    </td>
                    {canManageProducts && (
                      <td>
                        <div className='d-flex flex-wrap gap-2'>
                          <button className='btn btn-sm btn-outline-primary' onClick={() => handleEdit(product)}>
                            ✏️ Editar
                          </button>
                          <button className='btn btn-sm btn-outline-danger' onClick={() => handleDelete(product.id)}>
                            🗑️ Eliminar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className='modal show d-block' tabIndex={-1}>
          <div className='modal-dialog modal-dialog-centered'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h5 className='modal-title'>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h5>
                <button type='button' className='btn-close' onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className='modal-body'>
                  <div className='mb-3'>
                    <label className='form-label'>Nombre *</label>
                    <input type='text' className='form-control' value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
                  <div className='mb-3'>
                    <label className='form-label'>SKU *</label>
                    <input type='text' className='form-control' value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} required />
                  </div>
                  <div className='mb-3'>
                    <label className='form-label'>Descripción</label>
                    <textarea className='form-control' value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                  <div className='row'>
                    <div className='col-12 col-md-6 mb-3'>
                      <label className='form-label'>Precio *</label>
                      <input type='number' step='0.01' className='form-control' value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required />
                    </div>
                    <div className='col-12 col-md-6 mb-3'>
                      <label className='form-label'>Stock *</label>
                      <input type='number' className='form-control' value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} required />
                    </div>
                  </div>
                  <div className='mb-3'>
                    <label className='form-label'>Categoría</label>
                    <input type='text' className='form-control' value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                  </div>
                </div>
                <div className='modal-footer'>
                  <button type='button' className='btn btn-secondary' onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                  <button type='submit' className='btn btn-primary'>
                    {editingProduct ? 'Actualizar' : 'Crear'}
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
