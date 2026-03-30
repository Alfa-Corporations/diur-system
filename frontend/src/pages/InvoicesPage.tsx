import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { fetchInvoicesStart, fetchInvoicesSuccess, fetchInvoicesFailure, createInvoiceSuccess, updateInvoiceSuccess, deleteInvoiceSuccess } from '../redux/slices/invoiceSlice';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';
import type { Invoice, InvoiceItem } from '../../../shared/types';

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'check', label: 'Cheque' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'other', label: 'Otro' }
] as const;

type PaymentMethod = (typeof PAYMENT_OPTIONS)[number]['value'];

const InvoicesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { invoices, loading, error } = useAppSelector(state => state.invoices);
  const { products } = useAppSelector(state => state.products);
  const { isOnline } = useAppSelector(state => state.sync);
  const { user } = useAppSelector(state => state.auth);

  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [invoiceToPay, setInvoiceToPay] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [productSearch, setProductSearch] = useState('');
  const [invoiceStatusSelection, setInvoiceStatusSelection] = useState<Invoice['status']>('pending');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');

  useEffect(() => {
    void loadInvoices();
  }, [isOnline]);

  const toNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatCurrency = (value: unknown) => `$${toNumber(value).toFixed(2)}`;

  const loadInvoices = async () => {
    dispatch(fetchInvoicesStart());

    try {
      if (isOnline) {
        const { invoices: apiInvoices } = await apiService.getInvoices();
        await localDBService.saveInvoices(apiInvoices);
        dispatch(fetchInvoicesSuccess({ invoices: apiInvoices, totalCount: apiInvoices.length }));
      } else {
        const localInvoices = await localDBService.getInvoices();
        dispatch(fetchInvoicesSuccess({ invoices: localInvoices, totalCount: localInvoices.length }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar facturas';
      dispatch(fetchInvoicesFailure(message));
    }
  };

  const calculateTotal = (items: InvoiceItem[]) => items.reduce((sum, item) => sum + (toNumber(item.total) || toNumber(item.price) * toNumber(item.quantity)), 0);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();

    return products.filter(product => {
      const searchableText = `${product.name} ${product.sku} ${product.category ?? ''}`.toLowerCase();
      return product.isActive && searchableText.includes(term);
    });
  }, [products, productSearch]);

  const resetPaymentState = () => {
    setInvoiceStatusSelection('pending');
    setPaymentMethod('cash');
    setPaymentReference('');
    setInvoiceToPay(null);
    setShowPaymentModal(false);
  };

  const resetForm = () => {
    setEditingInvoice(null);
    setInvoiceItems([]);
    setSelectedProductId('');
    setQuantity('1');
    setProductSearch('');
    resetPaymentState();
  };

  const persistInvoiceLocally = async (invoice: Invoice) => {
    await localDBService.saveInvoice({
      ...invoice,
      total: toNumber(invoice.total),
      items: invoice.items?.map(item => ({
        ...item,
        price: toNumber(item.price),
        total: toNumber(item.total)
      }))
    } as Invoice);
  };

  const handleAddItem = () => {
    const selectedProduct = products.find(product => product.id === Number(selectedProductId));
    const qty = Number(quantity);

    if (!selectedProduct || qty <= 0) return;

    const unitPrice = toNumber(selectedProduct.price);
    const timestamp = new Date().toISOString();
    const newItem: InvoiceItem = {
      id: Date.now(),
      invoiceId: editingInvoice?.id ?? 0,
      productId: selectedProduct.id,
      quantity: qty,
      price: unitPrice,
      total: unitPrice * qty,
      product: {
        ...selectedProduct,
        price: unitPrice
      },
      createdAt: timestamp,
      updatedAt: timestamp
    };

    setInvoiceItems(prev => [...prev, newItem]);
    setSelectedProductId('');
    setQuantity('1');
    setProductSearch('');
  };

  const handleRemoveItem = (index: number) => {
    setInvoiceItems(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (invoiceItems.length === 0 || !user) {
      return;
    }

    const targetStatus = invoiceStatusSelection === 'paid' ? 'paid' : 'pending';
    const invoiceData = {
      items: invoiceItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      customerName: user.username,
      customerEmail: user.email
    };

    try {
      let savedInvoice: Invoice;

      if (editingInvoice) {
        savedInvoice = isOnline
          ? await apiService.updateInvoice(editingInvoice.id, invoiceData)
          : ({
              ...editingInvoice,
              items: invoiceItems,
              total: calculateTotal(invoiceItems),
              updatedAt: new Date().toISOString()
            } as Invoice);

        if (!isOnline) {
          await localDBService.addPendingEvent({
            id: `update_invoice_${Date.now()}`,
            type: 'update_invoice',
            data: { id: editingInvoice.id, ...invoiceData, status: targetStatus, paymentMethod, paymentReference },
            timestamp: new Date().toISOString(),
            synced: false
          });
        }
      } else {
        savedInvoice = isOnline
          ? await apiService.createInvoice(invoiceData)
          : ({
              id: Date.now(),
              invoiceNumber: `TMP-${Date.now()}`,
              userId: user.id,
              status: targetStatus,
              total: calculateTotal(invoiceItems),
              customerName: user.username,
              customerEmail: user.email,
              items: invoiceItems,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            } as Invoice);

        if (!isOnline) {
          await localDBService.addPendingEvent({
            id: `create_invoice_${Date.now()}`,
            type: 'create_invoice',
            data: { ...invoiceData, status: targetStatus, paymentMethod, paymentReference },
            timestamp: new Date().toISOString(),
            synced: false
          });
        }
      }

      if (targetStatus === 'paid') {
        savedInvoice = isOnline
          ? await apiService.updateInvoiceStatus(savedInvoice.id, 'paid', { paymentMethod, paymentReference })
          : ({
              ...savedInvoice,
              status: 'paid',
              paidAt: new Date().toISOString(),
              paymentMethod,
              paymentReference
            } as Invoice);
      }

      const normalizedInvoice: Invoice = {
        ...savedInvoice,
        total: toNumber(savedInvoice.total || calculateTotal(invoiceItems)),
        items: savedInvoice.items?.length ? savedInvoice.items : invoiceItems,
        paymentMethod: targetStatus === 'paid' ? paymentMethod : savedInvoice.paymentMethod,
        paymentReference: targetStatus === 'paid' ? paymentReference : savedInvoice.paymentReference,
        paidAt: targetStatus === 'paid' ? savedInvoice.paidAt || new Date().toISOString() : savedInvoice.paidAt
      };

      await persistInvoiceLocally(normalizedInvoice);

      if (editingInvoice) {
        dispatch(updateInvoiceSuccess(normalizedInvoice));
      } else {
        dispatch(createInvoiceSuccess(normalizedInvoice));
      }

      setShowModal(false);
      resetForm();
      await loadInvoices();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar la factura';
      alert(message);
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setInvoiceItems(invoice.items ?? []);
    setInvoiceStatusSelection(invoice.status);
    setPaymentMethod((invoice.paymentMethod as PaymentMethod) || 'cash');
    setPaymentReference(invoice.paymentReference || '');
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm('¿Está seguro de eliminar esta factura?');
    if (!confirmed) return;

    try {
      if (isOnline) {
        await apiService.deleteInvoice(id);
      } else {
        await localDBService.addPendingEvent({
          id: `delete_invoice_${id}_${Date.now()}`,
          type: 'delete_invoice',
          data: { id },
          timestamp: new Date().toISOString(),
          synced: false
        });
      }

      await localDBService.deleteInvoice(id);
      dispatch(deleteInvoiceSuccess(id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar la factura';
      alert(message);
    }
  };

  const openPaymentModal = (invoice: Invoice) => {
    setInvoiceToPay(invoice);
    setPaymentMethod((invoice.paymentMethod as PaymentMethod) || 'cash');
    setPaymentReference(invoice.paymentReference || '');
    setShowPaymentModal(true);
  };

  const handlePayInvoice = async () => {
    if (!invoiceToPay) return;

    try {
      const updatedInvoice = isOnline
        ? await apiService.updateInvoiceStatus(invoiceToPay.id, 'paid', { paymentMethod, paymentReference })
        : ({
            ...invoiceToPay,
            status: 'paid',
            paidAt: new Date().toISOString(),
            paymentMethod,
            paymentReference,
            updatedAt: new Date().toISOString()
          } as Invoice);

      const normalizedInvoice: Invoice = {
        ...updatedInvoice,
        total: toNumber(updatedInvoice.total),
        paymentMethod,
        paymentReference,
        paidAt: updatedInvoice.paidAt || new Date().toISOString()
      };

      if (!isOnline) {
        await localDBService.addPendingEvent({
          id: `pay_invoice_${invoiceToPay.id}_${Date.now()}`,
          type: 'update_invoice',
          data: { id: invoiceToPay.id, status: 'paid', paymentMethod, paymentReference },
          timestamp: new Date().toISOString(),
          synced: false
        });
      }

      await persistInvoiceLocally(normalizedInvoice);
      dispatch(updateInvoiceSuccess(normalizedInvoice));
      resetPaymentState();
      await loadInvoices();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo pagar la factura';
      alert(message);
    }
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    const invoiceLines = (invoice.items ?? [])
      .map(
        item => `
          <tr>
            <td>${item.product?.name ?? `Producto #${item.productId}`}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${formatCurrency(item.total)}</td>
          </tr>`
      )
      .join('');

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Permite las ventanas emergentes para imprimir la factura.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Factura ${invoice.invoiceNumber || invoice.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin-bottom: 4px; }
            p { margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border-bottom: 1px solid #d1d5db; padding: 10px; text-align: left; }
            .total { margin-top: 20px; font-size: 20px; font-weight: bold; }
            .note { margin-top: 16px; color: #4b5563; }
          </style>
        </head>
        <body>
          <h1>Sistema DIUR</h1>
          <p><strong>Factura:</strong> ${invoice.invoiceNumber || `#${invoice.id}`}</p>
          <p><strong>Fecha:</strong> ${new Date(invoice.createdAt).toLocaleString()}</p>
          <p><strong>Cliente:</strong> ${invoice.customerName || 'Consumidor final'}</p>
          <p><strong>Estado:</strong> ${invoice.status === 'paid' ? 'Pagada' : invoice.status === 'pending' ? 'Pendiente' : 'Cancelada'}</p>
          <p><strong>Método:</strong> ${invoice.paymentMethod || 'No indicado'}</p>

          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${invoiceLines}</tbody>
          </table>

          <div class="total">Monto total: ${formatCurrency(invoice.total)}</div>
          <div class="note">El navegador mostrará las impresoras disponibles en el diálogo de impresión.</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const canManageInvoices = user?.role === 'admin' || user?.role === 'cashier';
  const pendingInvoices = invoices.filter(invoice => invoice.status === 'pending').length;
  const paidInvoices = invoices.filter(invoice => invoice.status === 'paid').length;
  const totalBilled = invoices.reduce((sum, invoice) => sum + toNumber(invoice.total), 0);
  const draftTotal = calculateTotal(invoiceItems);

  return (
    <div className='page-shell container-fluid p-4'>
      <div className='page-header'>
        <div>
          <span className='eyebrow mb-2'>Facturación</span>
          <h2 className='mb-1'>Gestión de Facturas</h2>
          <p className='mb-0'>Ahora puedes crear, pagar e imprimir facturas con múltiples métodos de pago.</p>
        </div>
        <div className='page-actions'>
          <button className='btn btn-outline-secondary' onClick={() => void loadInvoices()}>
            Actualizar
          </button>
          {canManageInvoices && (
            <button
              className='btn btn-primary'
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
            >
              ➕ Nueva Factura
            </button>
          )}
        </div>
      </div>

      <div className='row g-3 mb-4'>
        <div className='col-12 col-md-4'>
          <div className='stat-card'>
            <div className='metric-label'>Facturas pagadas</div>
            <div className='metric-value'>{paidInvoices}</div>
          </div>
        </div>
        <div className='col-12 col-md-4'>
          <div className='stat-card'>
            <div className='metric-label'>Pendientes</div>
            <div className='metric-value'>{pendingInvoices}</div>
          </div>
        </div>
        <div className='col-12 col-md-4'>
          <div className='stat-card'>
            <div className='metric-label'>Monto total</div>
            <div className='metric-value'>{formatCurrency(totalBilled)}</div>
          </div>
        </div>
      </div>

      {!isOnline && <div className='alert offline-banner'>⚠️ Modo offline activo. Los cambios se sincronizarán luego.</div>}
      {error && <div className='alert alert-danger'>{error}</div>}

      <div className='section-card'>
        {loading ? (
          <div className='text-center py-4'>Cargando facturas...</div>
        ) : (
          <div className='table-responsive'>
            <table className='table table-hover table-modern mb-0'>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Fecha</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Método</th>
                  <th>Items</th>
                  {canManageInvoices && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {invoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td className='fw-semibold'>{invoice.invoiceNumber || `#${invoice.id}`}</td>
                    <td>{new Date(invoice.createdAt).toLocaleDateString()}</td>
                    <td>{formatCurrency(invoice.total)}</td>
                    <td>
                      <span className={`badge ${invoice.status === 'paid' ? 'bg-success' : invoice.status === 'pending' ? 'bg-warning' : 'bg-danger'}`}>
                        {invoice.status === 'paid' ? 'Pagada' : invoice.status === 'pending' ? 'Pendiente' : 'Cancelada'}
                      </span>
                    </td>
                    <td>{invoice.paymentMethod || '—'}</td>
                    <td>{invoice.items?.length ?? 0}</td>
                    {canManageInvoices && (
                      <td>
                        <div className='d-flex flex-wrap gap-2'>
                          {invoice.status !== 'paid' && (
                            <button className='btn btn-sm btn-outline-success' onClick={() => openPaymentModal(invoice)}>
                              💳 Pagar
                            </button>
                          )}
                          <button className='btn btn-sm btn-outline-secondary' onClick={() => handlePrintInvoice(invoice)}>
                            🖨️ Imprimir
                          </button>
                          <button className='btn btn-sm btn-outline-primary' onClick={() => handleEdit(invoice)}>
                            ✏️ Editar
                          </button>
                          <button className='btn btn-sm btn-outline-danger' onClick={() => handleDelete(invoice.id)}>
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
          <div className='modal-dialog modal-lg modal-dialog-centered'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h5 className='modal-title'>{editingInvoice ? 'Editar Factura' : 'Nueva Factura'}</h5>
                <button type='button' className='btn-close' onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className='modal-body'>
                  <div className='stat-card mb-4'>
                    <div className='metric-label'>Total actual</div>
                    <div className='metric-value'>{formatCurrency(draftTotal)}</div>
                  </div>

                  <div className='row g-2 mb-3'>
                    <div className='col-12 col-md-5'>
                      <input type='text' className='form-control' placeholder='Buscar producto por nombre, SKU o categoría...' value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                    </div>
                    <div className='col-12 col-md-4'>
                      <select className='form-select' value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                        <option value=''>Seleccionar producto...</option>
                        {filteredProducts.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name} - {formatCurrency(product.price)} (Stock: {product.stock})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className='col-6 col-md-1'>
                      <input type='number' className='form-control' min='1' value={quantity} onChange={e => setQuantity(e.target.value)} />
                    </div>
                    <div className='col-6 col-md-2'>
                      <button type='button' className='btn btn-outline-primary w-100' onClick={handleAddItem}>
                        Agregar
                      </button>
                    </div>
                  </div>

                  <div className='row g-3 mb-4'>
                    <div className='col-12 col-md-4'>
                      <label className='form-label'>Estado de cobro</label>
                      <select className='form-select' value={invoiceStatusSelection} onChange={e => setInvoiceStatusSelection(e.target.value as Invoice['status'])}>
                        <option value='pending'>Pendiente</option>
                        <option value='paid'>Pagada</option>
                      </select>
                    </div>
                    {invoiceStatusSelection === 'paid' && (
                      <>
                        <div className='col-12 col-md-4'>
                          <label className='form-label'>Método de pago</label>
                          <select className='form-select' value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}>
                            {PAYMENT_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className='col-12 col-md-4'>
                          <label className='form-label'>Referencia</label>
                          <input type='text' className='form-control' placeholder='Últimos 4 dígitos, banco, nro. cheque...' value={paymentReference} onChange={e => setPaymentReference(e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>

                  {invoiceItems.length === 0 ? (
                    <p className='text-muted'>No hay productos agregados.</p>
                  ) : (
                    <div className='table-responsive'>
                      <table className='table table-sm table-modern'>
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>Precio</th>
                            <th>Total</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceItems.map((item, index) => (
                            <tr key={`${item.id}-${index}`}>
                              <td>{item.product?.name ?? item.productId}</td>
                              <td>{item.quantity}</td>
                              <td>{formatCurrency(item.price)}</td>
                              <td>{formatCurrency(item.total)}</td>
                              <td>
                                <button type='button' className='btn btn-sm btn-outline-danger' onClick={() => handleRemoveItem(index)}>
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th colSpan={3}>Total</th>
                            <th>{formatCurrency(draftTotal)}</th>
                            <th></th>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
                <div className='modal-footer'>
                  <button type='button' className='btn btn-secondary' onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                  <button type='submit' className='btn btn-primary' disabled={invoiceItems.length === 0}>
                    {editingInvoice ? 'Guardar factura' : 'Crear factura'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && invoiceToPay && (
        <div className='modal show d-block' tabIndex={-1}>
          <div className='modal-dialog modal-dialog-centered'>
            <div className='modal-content'>
              <div className='modal-header'>
                <h5 className='modal-title'>Pagar factura {invoiceToPay.invoiceNumber || `#${invoiceToPay.id}`}</h5>
                <button type='button' className='btn-close' onClick={resetPaymentState}></button>
              </div>
              <div className='modal-body'>
                <p className='mb-3'>Selecciona cómo deseas registrar el pago de esta factura.</p>
                <div className='mb-3'>
                  <label className='form-label'>Método de pago</label>
                  <select className='form-select' value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}>
                    {PAYMENT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className='mb-3'>
                  <label className='form-label'>Referencia / Nota</label>
                  <input type='text' className='form-control' placeholder='Ej: VISA 4455, cheque 1021, transferencia móvil...' value={paymentReference} onChange={e => setPaymentReference(e.target.value)} />
                </div>
                <div className='stat-card'>
                  <div className='metric-label'>Monto a pagar</div>
                  <div className='metric-value'>{formatCurrency(invoiceToPay.total)}</div>
                </div>
              </div>
              <div className='modal-footer'>
                <button type='button' className='btn btn-secondary' onClick={resetPaymentState}>
                  Cancelar
                </button>
                <button type='button' className='btn btn-success' onClick={() => void handlePayInvoice()}>
                  Confirmar pago
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesPage;
