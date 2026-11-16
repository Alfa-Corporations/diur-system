import React, { useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { Alert, Badge, Button, Form, Spinner } from 'react-bootstrap';
import type { Customer } from '../interfaces/types';
import type { Invoice, Order } from '../../../shared/types';
import { useAppSelector } from '../hooks/redux';
import apiService from '../services/apiService';

type PendingProduct = {
  order: Order;
  item: NonNullable<Order['items']>[number];
  remaining: number;
};

type SelectedProduct = PendingProduct & { quantity: number };

type CustomerInvoiceGroup = {
  key: string;
  name: string;
  order: Order;
  products: SelectedProduct[];
};

const getCustomerName = (order: Order) => order.customer?.name || order.customerName || 'Cliente sin asignar';

const getCustomerKey = (order: Order) => {
  if (order.customer?.id != null || order.customerId != null) {
    return `customer-${order.customer?.id ?? order.customerId}`;
  }
  const identification = String(order.customer?.identificationNumber || '').trim().toLocaleLowerCase();
  if (identification) return `identification-${identification}`;
  const name = String(order.customer?.name || order.customerName || '').trim().toLocaleLowerCase();
  return name ? `name-${name}` : `order-${order.id}`;
};

const PendingProductsPage: React.FC = () => {
  const { user } = useAppSelector(state => state.auth);
  const isAdmin = user?.role === 'admin';
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerFilter, setCustomerFilter] = useState('');
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [invoiceReferences, setInvoiceReferences] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [creatingInvoices, setCreatingInvoices] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recentlyCreatedInvoices, setRecentlyCreatedInvoices] = useState<Invoice[]>([]);
  const [uploadingEvidenceId, setUploadingEvidenceId] = useState<number | null>(null);
  const [evidenceUploadErrors, setEvidenceUploadErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [orderResult, customerResult] = await Promise.all([
          apiService.getOrders(),
          apiService.getCustomers(),
        ]);
        if (active) {
          setOrders(orderResult.orders);
          setCustomers(customerResult.customers);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los productos pendientes.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const pendingProducts = useMemo<PendingProduct[]>(() => orders
    .filter(order => order.type !== 'compra' && order.status !== 'cancelado')
    .flatMap(order => (order.items || [])
      .map(item => ({
        order,
        item,
        remaining: Math.max(0, Number(item.quantityRequested) - Number(item.quantityProcessed)),
      }))
      .filter(row => row.remaining > 0 && row.item.dispatchStatus === 'en_local')), [orders]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return pendingProducts.filter(({ order, item }) => {
      if (customerFilter && String(order.customerId ?? order.customer?.id ?? '') !== customerFilter) return false;
      if (!query) return true;
      const customerName = getCustomerName(order);
      return [
        item.product?.name,
        item.product?.partnumber,
        item.product?.barcode,
        customerName,
        order.id,
      ].some(value => String(value ?? '').toLocaleLowerCase().includes(query));
    });
  }, [customerFilter, pendingProducts, search]);

  const selectedProducts = useMemo<SelectedProduct[]>(() => pendingProducts.flatMap(row => {
    const quantity = Number(quantities[row.item.id] ?? row.item.quantityLoaded);
    const availableToDeliver = Math.min(row.remaining, Number(row.item.quantityLoaded));
    return Number.isSafeInteger(quantity) && quantity > 0 && quantity <= availableToDeliver
      ? [{ ...row, quantity }]
      : [];
  }), [pendingProducts, quantities]);

  const invalidQuantity = pendingProducts.find(({ item, remaining }) => {
    const value = quantities[item.id] ?? String(item.quantityLoaded);
    if (value === undefined || value === '' || value === '0') return false;
    const quantity = Number(value);
    return !Number.isSafeInteger(quantity) || quantity < 0 || quantity > Math.min(remaining, Number(item.quantityLoaded));
  });

  const selectedCustomerGroups = useMemo<CustomerInvoiceGroup[]>(() => {
    const groups = new Map<string, CustomerInvoiceGroup>();
    selectedProducts.forEach(product => {
      const key = getCustomerKey(product.order);
      const existing = groups.get(key);
      if (existing) existing.products.push(product);
      else groups.set(key, {
        key,
        name: getCustomerName(product.order),
        order: product.order,
        products: [product],
      });
    });
    return Array.from(groups.values()).sort((first, second) => first.name.localeCompare(second.name));
  }, [selectedProducts]);

  const pendingUnits = filteredProducts.reduce(
    (total, row) => total + Math.min(row.remaining, Number(row.item.quantityLoaded)),
    0
  );
  const selectedUnits = selectedProducts.reduce((total, row) => total + row.quantity, 0);

  const updateQuantity = (itemId: number, value: string) => {
    setQuantities(current => ({ ...current, [itemId]: value }));
  };

  const updateInvoiceReference = (customerKey: string, value: string) => {
    setInvoiceReferences(current => ({ ...current, [customerKey]: value }));
  };

  const attachDeliveryPhoto = async (invoiceId: number, image: File | undefined) => {
    if (!image) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 8 * 1024 * 1024) {
      setEvidenceUploadErrors(current => ({
        ...current,
        [invoiceId]: 'Selecciona una imagen JPEG, PNG o WebP de 8 MB o menos.',
      }));
      return;
    }
    setUploadingEvidenceId(invoiceId);
    setEvidenceUploadErrors(current => ({ ...current, [invoiceId]: '' }));
    try {
      const updatedInvoice = await apiService.uploadInvoiceDeliveryEvidence(invoiceId, image);
      setRecentlyCreatedInvoices(current => current.map(invoice =>
        invoice.id === invoiceId ? updatedInvoice : invoice
      ));
    } catch (uploadError) {
      setEvidenceUploadErrors(current => ({
        ...current,
        [invoiceId]: uploadError instanceof Error ? uploadError.message : 'No se pudo guardar la foto.',
      }));
    } finally {
      setUploadingEvidenceId(null);
    }
  };

  const handleCreateInvoices = async () => {
    if (!isOnline || !navigator.onLine || selectedProducts.length === 0 || creatingInvoices) return;

    if (invalidQuantity) {
      setError(`La cantidad de ${invalidQuantity.item.product?.name || `producto #${invalidQuantity.item.productId}`} debe ser un entero entre 0 y ${Math.min(invalidQuantity.remaining, Number(invalidQuantity.item.quantityLoaded))}.`);
      setSuccess('');
      return;
    }

    const missingReference = selectedCustomerGroups.find(group => !invoiceReferences[group.key]?.trim());
    if (missingReference) {
      setError(`Ingresa la referencia de factura para ${missingReference.name}.`);
      setSuccess('');
      return;
    }

    const references = selectedCustomerGroups.map(group =>
      String(invoiceReferences[group.key].trim()).padStart(10, '0')
    );
    if (new Set(references).size !== references.length) {
      setError('Cada cliente debe tener una referencia de factura distinta.');
      setSuccess('');
      return;
    }

    setCreatingInvoices(true);
    setError('');
    setSuccess('');
    const createdInvoiceRecords: Invoice[] = [];

    try {
      for (const group of selectedCustomerGroups) {
        const customer = group.order.customer;
        const reference = invoiceReferences[group.key].trim();
        try {
          const invoice = await apiService.createInvoice({
            invoiceNumberExternal: `001-011-${String(reference).padStart(10, '0')}`,
            documentType: customer?.name || group.order.customerName ? 'sales_note' : 'consumer_final',
            customer: {
              name: customer?.name || group.order.customerName || 'Cliente ocasional',
              email: customer?.email || undefined,
              phone: customer?.phone || undefined,
              identificationType: customer?.identificationType || 'none',
              identificationNumber: customer?.identificationNumber || undefined,
              address: customer?.address || group.order.customerAddress || undefined,
            },
            items: group.products.map(({ item, quantity }) => ({
              productId: item.productId,
              quantity,
              price: Number(item.unitPrice || item.product?.price || 0),
              orderItemId: item.id,
            })),
          });

          createdInvoiceRecords.push(invoice);
          const completedItemIds = new Set(group.products.map(product => product.item.id));
          setQuantities(current => Object.fromEntries(
            Object.entries(current).filter(([itemId]) => !completedItemIds.has(Number(itemId)))
          ));
          setInvoiceReferences(current => {
            const next = { ...current };
            delete next[group.key];
            return next;
          });
        } catch (invoiceError) {
          const message = isAxiosError<{ message?: string }>(invoiceError)
            ? invoiceError.response?.data?.message || invoiceError.message
            : invoiceError instanceof Error
              ? invoiceError.message
              : 'No se pudo crear la factura.';
          const uncertainResult = isAxiosError(invoiceError) && !invoiceError.response
            ? ' La conexión se interrumpió durante el envío; verifica en Facturas si se registró antes de reintentar.'
            : '';
          setError(`No se pudo crear la factura de ${group.name}: ${message}${createdInvoiceRecords.length ? ' Las facturas creadas antes de este error ya actualizaron sus órdenes e inventario.' : ''}${uncertainResult}`);
          break;
        }
      }
    } finally {
      setCreatingInvoices(false);
      if (createdInvoiceRecords.length > 0) {
        setRecentlyCreatedInvoices(current => [...createdInvoiceRecords, ...current].slice(0, 20));
        setSuccess(`Facturas creadas: ${createdInvoiceRecords.map(invoice => invoice.invoiceNumber || `#${invoice.id}`).join(' · ')}. Las cantidades se descontaron de sus órdenes correspondientes.`);
        setRefreshKey(current => current + 1);
      }
    }
  };

  return (
    <main className='pending-products-page'>
      <header className='pending-products-header'>
        <div>
          <p className='pending-products-eyebrow'>INVENTARIO · DESPACHOS</p>
          <h1>Productos pendientes de entregar</h1>
          <p>Selecciona los productos recibidos en el local y registra la referencia de factura. Solo se despachan las cantidades registradas en la preparación del camión.</p>
        </div>
        <Button variant='outline-primary' onClick={() => setRefreshKey(current => current + 1)} disabled={loading || creatingInvoices}>
          Actualizar
        </Button>
      </header>

      {!isOnline && <Alert variant='warning'>Sin conexión: puedes consultar los pendientes, pero para generar facturas y confirmar despachos debes conectarte.</Alert>}
      {!isAdmin && <Alert variant='info'>La cantidad quedó fijada según la preparación de despacho. Solo un administrador puede ajustarla.</Alert>}
      {error && <Alert variant='danger' dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant='success' dismissible onClose={() => setSuccess('')}>{success}</Alert>}
      {recentlyCreatedInvoices.length > 0 && (
        <section className='pending-products-invoices mb-4' aria-label='Fotos de facturas recién creadas'>
          <div className='pending-products-invoices-heading'>
            <div>
              <span className='pending-products-eyebrow'>EVIDENCIA DE ENTREGA</span>
              <h2>Facturas recién creadas</h2>
            </div>
          </div>
          <p className='text-muted'>Adjunta una foto ahora; desde un teléfono puedes tomarla con la cámara o elegir una imagen.</p>
          <div className='d-grid gap-2'>
            {recentlyCreatedInvoices.map(invoice => (
              <article className='pending-products-invoice-group' key={invoice.id}>
                <div>
                  <strong>{invoice.invoiceNumber || `Factura #${invoice.id}`}</strong>
                  <small>{invoice.customerName || 'Consumidor Final'} · {invoice.hasDeliveryEvidence ? 'Foto adjunta' : 'Sin foto de entrega'}</small>
                  {evidenceUploadErrors[invoice.id] && <small className='text-danger'>{evidenceUploadErrors[invoice.id]}</small>}
                </div>
                <div className='d-flex flex-wrap gap-2'>
                  <label className='btn btn-sm btn-outline-primary mb-0'>
                    Tomar foto
                    <input
                      className='visually-hidden'
                      type='file'
                      accept='image/jpeg,image/png,image/webp'
                      capture='environment'
                      disabled={!isOnline || uploadingEvidenceId === invoice.id}
                      onChange={event => {
                        const image = event.currentTarget.files?.[0];
                        event.currentTarget.value = '';
                        void attachDeliveryPhoto(invoice.id, image);
                      }}
                    />
                  </label>
                  <label className='btn btn-sm btn-primary mb-0'>
                    Subir foto
                    <input
                      className='visually-hidden'
                      type='file'
                      accept='image/jpeg,image/png,image/webp'
                      disabled={!isOnline || uploadingEvidenceId === invoice.id}
                      onChange={event => {
                        const image = event.currentTarget.files?.[0];
                        event.currentTarget.value = '';
                        void attachDeliveryPhoto(invoice.id, image);
                      }}
                    />
                  </label>
                  {uploadingEvidenceId === invoice.id && <Spinner animation='border' size='sm' role='status' />}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {!loading && pendingProducts.length === 0 && (
        <Alert variant='info'>Los productos aparecen aquí después de registrarlos en bodega y marcar su llegada al local principal.</Alert>
      )}
      {invalidQuantity && (
        <Alert variant='warning'>
          La cantidad de {invalidQuantity.item.product?.name || `producto #${invalidQuantity.item.productId}`} en la orden #{invalidQuantity.order.id} debe ser un entero entre 0 y {Math.min(invalidQuantity.remaining, Number(invalidQuantity.item.quantityLoaded))}.
        </Alert>
      )}

      <section className='pending-products-summary' aria-label='Resumen de pendientes'>
        <div><span>Productos pendientes</span><strong>{loading ? '—' : filteredProducts.length}</strong></div>
        <div><span>Unidades por entregar</span><strong>{loading ? '—' : pendingUnits}</strong></div>
        <div><span>Unidades seleccionadas</span><strong>{selectedUnits}</strong></div>
      </section>

      <section className='pending-products-filters' aria-label='Filtros'>
        <Form.Group>
          <Form.Label htmlFor='pending-products-customer'>Cliente</Form.Label>
          <Form.Select
            id='pending-products-customer'
            value={customerFilter}
            onChange={event => setCustomerFilter(event.target.value)}
          >
            <option value=''>Todos los clientes</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>{customer.name} · #{customer.id}</option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group>
          <Form.Label htmlFor='pending-products-search'>Buscar</Form.Label>
          <Form.Control
            id='pending-products-search'
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder='Producto, código u orden'
          />
        </Form.Group>
      </section>

      {selectedCustomerGroups.length > 0 && (
        <section className='pending-products-invoices' aria-label='Facturas por crear'>
          <div className='pending-products-invoices-heading'>
            <div>
              <span className='pending-products-eyebrow'>DESPACHO SELECCIONADO</span>
              <h2>Facturas por cliente</h2>
            </div>
            <Badge bg='primary'>{selectedCustomerGroups.length} cliente(s) · {selectedUnits} unidad(es)</Badge>
          </div>
          {selectedCustomerGroups.map(group => {
            const groupTotal = group.products.reduce((total, product) =>
              total + product.quantity * Number(product.item.unitPrice || product.item.product?.price || 0), 0);
            const orderIds = Array.from(new Set(group.products.map(product => product.order.id)));
            return (
              <div className='pending-products-invoice-group' key={group.key}>
                <div>
                  <strong>{group.name}</strong>
                  <small>{group.products.length} producto(s) · órdenes {orderIds.map(id => `#${id}`).join(', ')} · ${groupTotal.toFixed(2)}</small>
                </div>
                <Form.Group>
                  <Form.Label htmlFor={`invoice-reference-${group.key}`}>Referencia de factura</Form.Label>
                  <Form.Control
                    id={`invoice-reference-${group.key}`}
                    value={invoiceReferences[group.key] || ''}
                    onChange={event => updateInvoiceReference(group.key, event.target.value)}
                    placeholder='Ej. 123'
                    inputMode='numeric'
                    disabled={creatingInvoices}
                  />
                </Form.Group>
              </div>
            );
          })}
          <Button
            variant='success'
            onClick={() => void handleCreateInvoices()}
            disabled={!isOnline || !navigator.onLine || creatingInvoices || Boolean(invalidQuantity) || selectedCustomerGroups.some(group => !invoiceReferences[group.key]?.trim())}
          >
            {creatingInvoices
              ? <><Spinner animation='border' size='sm' className='me-2' />Creando facturas…</>
              : `Crear ${selectedCustomerGroups.length === 1 ? 'factura' : 'facturas'} y confirmar despacho`}
          </Button>
        </section>
      )}

      <section className='pending-products-table-card'>
        {loading ? (
          <div className='pending-products-state'><Spinner animation='border' role='status' /><span>Cargando productos pendientes…</span></div>
        ) : filteredProducts.length === 0 ? (
          <div className='pending-products-state'>
            <strong>No hay productos pendientes</strong>
            <span>{customerFilter || search ? 'Prueba cambiando los filtros.' : 'Las órdenes de venta están al día.'}</span>
          </div>
        ) : (
          <div className='table-responsive'>
            <table className='table pending-products-table mb-0'>
              <thead>
                <tr>
                  <th scope='col'>Cliente</th>
                  <th scope='col'>Orden</th>
                  <th scope='col'>Producto</th>
                  <th scope='col'>Pendiente de orden</th>
                  <th scope='col'>Cargado</th>
                  <th scope='col'>Cantidad a entregar</th>
                  <th scope='col'>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(({ order, item, remaining }) => {
                  const customerName = getCustomerName(order);
                  return (
                    <tr key={`${order.id}-${item.id}`}>
                      <td data-label='Cliente'>
                        <strong>{customerName}</strong>
                        <small>{order.customer?.identificationNumber || (order.customerId ? `Código #${order.customerId}` : 'Sin código de cliente')}</small>
                      </td>
                      <td data-label='Orden'>
                        <Badge bg='light' text='dark'>#{order.id}</Badge>
                        {order.note && <small>{order.note}</small>}
                      </td>
                      <td data-label='Producto'>
                        <strong>{item.product?.name || `Producto #${item.productId}`}</strong>
                        {item.product?.partnumber && <small>{item.product.partnumber}</small>}
                      </td>
                      <td data-label='Pendiente de orden'><Badge bg='warning' text='dark'>{remaining}</Badge></td>
                      <td data-label='Cargado'>{item.quantityLoaded}</td>
                      <td data-label='Cantidad a entregar'>
                        <Form.Control
                          className='pending-products-quantity'
                          type='number'
                          min={0}
                          max={Math.min(remaining, Number(item.quantityLoaded))}
                          step={1}
                          value={quantities[item.id] ?? String(item.quantityLoaded)}
                          onChange={event => updateQuantity(item.id, event.target.value)}
                          aria-label={`Cantidad a entregar de ${item.product?.name || `producto ${item.productId}`} en orden ${order.id}`}
                          disabled={creatingInvoices || !isAdmin}
                        />
                      </td>
                      <td data-label='Fecha'>{new Date(order.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
};

export default PendingProductsPage;
