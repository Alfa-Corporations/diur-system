import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { fetchInvoicesStart, fetchInvoicesSuccess, fetchInvoicesFailure, createInvoiceSuccess, updateInvoiceSuccess, cancelInvoiceSuccess } from '../redux/slices/invoiceSlice';
import { fetchProductsStart, fetchProductsSuccess, fetchProductsFailure } from '../redux/slices/productSlice';
import apiService from '../services/apiService';
import localDBService from '../services/localDBService';
import type { Invoice, InvoiceItem } from '../../../shared/types';

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'check', label: 'Cheque' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'credit', label: 'Crédito' },
  { value: 'other', label: 'Otro' }
] as const;

const DOCUMENT_OPTIONS = [
  { value: 'consumer_final', label: 'Consumidor final' },
  { value: 'sales_note', label: 'Nota de venta con datos' }
] as const;

const IDENTIFICATION_OPTIONS = [
  { value: 'none', label: 'Sin identificación' },
  { value: 'cedula', label: 'Cédula' },
  { value: 'ruc', label: 'RUC' },
  { value: 'passport', label: 'Pasaporte' }
] as const;

type PaymentMethod = (typeof PAYMENT_OPTIONS)[number]['value'];
type InvoiceDocumentType = Extract<NonNullable<Invoice['documentType']>, 'consumer_final' | 'sales_note'>;
type CustomerIdentificationType = NonNullable<Invoice['customerIdentificationType']>;

const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { invoices, loading, error } = useAppSelector(state => state.invoices);
  const { products } = useAppSelector(state => state.products);
  const { isOnline } = useAppSelector(state => state.sync);
  const { user } = useAppSelector(state => state.auth);
  const isAdmin = user?.role === 'admin';

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
  const [amountReceived, setAmountReceived] = useState('');
  const [printAfterPayment, setPrintAfterPayment] = useState(true);
  const [documentType, setDocumentType] = useState<InvoiceDocumentType>('consumer_final');
  const [customerName, setCustomerName] = useState('Consumidor Final');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerIdentificationType, setCustomerIdentificationType] = useState<CustomerIdentificationType>('none');
  const [customerIdentification, setCustomerIdentification] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [sendingEmailId, setSendingEmailId] = useState<number | null>(null);
  const [invoiceViewMode, setInvoiceViewMode] = useState<'active' | 'deleted'>('active');

  const adjustLocalProductStock = async (items: InvoiceItem[], multiplier: 1 | -1) => {
    const currentProducts = await localDBService.getProducts();
    const updatedProducts = currentProducts
      .map(product => {
        const relatedItems = items.filter(item => item.productId === product.id);
        if (relatedItems.length === 0) {
          return null;
        }

        const stockDelta = relatedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0) * multiplier;

        return {
          ...product,
          stock: Math.max(0, Number(product.stock || 0) + stockDelta),
          updatedAt: new Date().toISOString()
        };
      })
      .filter((product): product is (typeof currentProducts)[number] => product !== null);

    await Promise.all(updatedProducts.map(product => localDBService.saveProduct(product)));
  };

  const toNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatCurrency = (value: unknown) => `$${toNumber(value).toFixed(2)}`;

  const loadInvoices = useCallback(
    async (statusFilter?: Invoice['status']) => {
      dispatch(fetchInvoicesStart());

      try {
        const pendingEvents = await localDBService.getPendingEvents();
        const shouldPreferLocal = !isOnline || pendingEvents.length > 0;

        if (!shouldPreferLocal) {
          const params = statusFilter ? { status: statusFilter } : undefined;
          const { invoices: apiInvoices } = await apiService.getInvoices(params);
          await localDBService.saveInvoices(apiInvoices);
          dispatch(fetchInvoicesSuccess({ invoices: apiInvoices, totalCount: apiInvoices.length }));
          return;
        }

        const localInvoices = await localDBService.getInvoices();
        const filteredInvoices = statusFilter ? localInvoices.filter(invoice => invoice.status === statusFilter) : localInvoices.filter(invoice => invoice.status !== 'cancelled');
        dispatch(fetchInvoicesSuccess({ invoices: filteredInvoices, totalCount: filteredInvoices.length }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al cargar facturas';
        dispatch(fetchInvoicesFailure(message));

        try {
          const localInvoices = await localDBService.getInvoices();
          const filteredInvoices = statusFilter ? localInvoices.filter(invoice => invoice.status === statusFilter) : localInvoices.filter(invoice => invoice.status !== 'cancelled');
          dispatch(fetchInvoicesSuccess({ invoices: filteredInvoices, totalCount: filteredInvoices.length }));
        } catch {
          dispatch(fetchInvoicesFailure(message));
        }
      }
    },
    [dispatch, isOnline]
  );

  const loadProducts = useCallback(async () => {
    dispatch(fetchProductsStart());

    try {
      const pendingEvents = await localDBService.getPendingEvents();
      const shouldPreferLocal = !isOnline || pendingEvents.length > 0;

      if (!shouldPreferLocal) {
        const { products: apiProducts } = await apiService.getProducts();
        await localDBService.saveProducts(apiProducts);
        dispatch(fetchProductsSuccess({ products: apiProducts, totalCount: apiProducts.length }));
        return;
      }

      const localProducts = await localDBService.getProducts();
      dispatch(fetchProductsSuccess({ products: localProducts, totalCount: localProducts.length }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar productos';
      dispatch(fetchProductsFailure(message));

      try {
        const localProducts = await localDBService.getProducts();
        dispatch(fetchProductsSuccess({ products: localProducts, totalCount: localProducts.length }));
      } catch {
        dispatch(fetchProductsFailure(message));
      }
    }
  }, [dispatch, isOnline]);

  useEffect(() => {
    const requestedStatus = isAdmin && invoiceViewMode === 'deleted' ? 'cancelled' : undefined;
    void Promise.all([loadInvoices(requestedStatus), loadProducts()]);
  }, [invoiceViewMode, isAdmin, loadInvoices, loadProducts]);

  const calculateTotal = (items: InvoiceItem[]) => items.reduce((sum, item) => sum + (toNumber(item.total) || toNumber(item.price) * toNumber(item.quantity)), 0);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();

    return products.filter(product => {
      const searchableText = `${product.name} ${product.partnumber} ${product.category ?? ''}`.toLowerCase();
      return product.isActive && searchableText.includes(term);
    });
  }, [products, productSearch]);

  const handleDocumentTypeChange = (value: InvoiceDocumentType) => {
    setDocumentType(value);

    if (value === 'consumer_final') {
      setCustomerName('Consumidor Final');
      setCustomerEmail('');
      setCustomerPhone('');
      setCustomerIdentificationType('none');
      setCustomerIdentification('');
      setCustomerAddress('');
    }
  };

  const buildCustomerPayload = () => {
    if (documentType === 'consumer_final') {
      return {
        name: 'Consumidor Final',
        email: '',
        phone: '',
        identificationType: 'none' as const,
        identificationNumber: '9999999999999',
        address: 'N/A'
      };
    }

    return {
      name: customerName.trim(),
      email: customerEmail.trim(),
      phone: customerPhone.trim(),
      identificationType: customerIdentificationType,
      identificationNumber: customerIdentification.trim(),
      address: customerAddress.trim()
    };
  };

  const resetPaymentState = () => {
    setInvoiceStatusSelection('pending');
    setPaymentMethod('cash');
    setPaymentReference('');
    setAmountReceived('');
    setPrintAfterPayment(true);
    setInvoiceToPay(null);
    setShowPaymentModal(false);
  };

  const resetForm = () => {
    setEditingInvoice(null);
    setInvoiceItems([]);
    setSelectedProductId('');
    setQuantity('1');
    setProductSearch('');
    setDocumentType('consumer_final');
    setCustomerName('Consumidor Final');
    setCustomerEmail('');
    setCustomerPhone('');
    setCustomerIdentificationType('none');
    setCustomerIdentification('');
    setCustomerAddress('');
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
      id: new Date(timestamp).getTime(),
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
    const invoiceTotal = calculateTotal(invoiceItems);
    // Para crédito, no hay monto recibido. Para otros métodos no-cash, se asume que se recibe el total
    const receivedAmount = targetStatus === 'paid' ? (paymentMethod === 'cash' ? toNumber(amountReceived) : paymentMethod === 'credit' ? 0 : invoiceTotal) : undefined;
    const computedChange = targetStatus === 'paid' ? Math.max((receivedAmount || 0) - invoiceTotal, 0) : undefined;
    const customerPayload = buildCustomerPayload();
    const eventTimestamp = new Date();
    const eventTimestampIso = eventTimestamp.toISOString();
    const eventId = eventTimestamp.getTime();

    if (documentType !== 'consumer_final' && !customerPayload.name) {
      alert('Ingresa al menos el nombre del cliente para emitir la nota de venta.');
      return;
    }

    if (targetStatus === 'paid' && paymentMethod === 'cash' && receivedAmount !== undefined && receivedAmount < invoiceTotal) {
      alert('El monto recibido no puede ser menor al total de la factura.');
      return;
    }

    const invoiceData = {
      documentType,
      customer: customerPayload,
      customerName: customerPayload.name,
      customerEmail: customerPayload.email,
      ...(targetStatus === 'paid' && { paymentMethod }),
      items: invoiceItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }))
    };

    try {
      let savedInvoice: Invoice;

      if (editingInvoice) {
        savedInvoice = isOnline
          ? await apiService.updateInvoice(editingInvoice.id, invoiceData)
          : ({
              ...editingInvoice,
              documentType,
              items: invoiceItems,
              total: invoiceTotal,
              customerName: customerPayload.name,
              customerEmail: customerPayload.email,
              customerPhone: customerPayload.phone,
              customerIdentificationType: customerPayload.identificationType,
              customerIdentification: customerPayload.identificationNumber,
              customerAddress: customerPayload.address,
              updatedAt: eventTimestampIso
            } as Invoice);

        if (!isOnline) {
          await localDBService.addPendingEvent({
            id: `actualizar_factura_${eventId}`,
            type: 'actualizar_factura',
            data: { id: editingInvoice.id, ...invoiceData, status: targetStatus, paymentMethod, paymentReference, amountReceived: receivedAmount, changeAmount: computedChange },
            timestamp: eventTimestampIso,
            synced: false
          });
        }
      } else {
        savedInvoice = isOnline
          ? await apiService.createInvoice(invoiceData)
          : ({
              id: eventId,
              invoiceNumber: `TMP-${eventId}`,
              userId: user.id,
              status: targetStatus,
              documentType,
              sriStatus: 'not_applicable',
              total: invoiceTotal,
              paymentMethod: targetStatus === 'paid' ? paymentMethod : undefined,
              paymentReference: targetStatus === 'paid' ? paymentReference : undefined,
              amountReceived: targetStatus === 'paid' ? receivedAmount : undefined,
              changeAmount: targetStatus === 'paid' ? computedChange : undefined,
              customerName: customerPayload.name,
              customerEmail: customerPayload.email,
              customerPhone: customerPayload.phone,
              customerIdentificationType: customerPayload.identificationType,
              customerIdentification: customerPayload.identificationNumber,
              customerAddress: customerPayload.address,
              items: invoiceItems,
              createdAt: eventTimestampIso,
              updatedAt: eventTimestampIso
            } as Invoice);

        if (!isOnline) {
          await localDBService.addPendingEvent({
            id: `crear_factura_${eventId}`,
            type: 'crear_factura',
            data: { localId: eventId, ...invoiceData, status: targetStatus, paymentMethod, paymentReference, amountReceived: receivedAmount, changeAmount: computedChange },
            timestamp: eventTimestampIso,
            synced: false
          });
          await adjustLocalProductStock(invoiceItems, -1);
        }
      }

      if (targetStatus === 'paid') {
        savedInvoice = isOnline
          ? await apiService.updateInvoiceStatus(savedInvoice.id, 'paid', {
              paymentMethod,
              paymentReference,
              amountReceived: receivedAmount,
              changeAmount: computedChange
            })
          : ({
              ...savedInvoice,
              status: 'paid',
              paidAt: eventTimestampIso,
              paymentMethod,
              paymentReference,
              amountReceived: receivedAmount,
              changeAmount: computedChange
            } as Invoice);
      }

      const normalizedInvoice: Invoice = {
        ...savedInvoice,
        total: toNumber(savedInvoice.total || invoiceTotal),
        items: savedInvoice.items?.length ? savedInvoice.items : invoiceItems,
        documentType,
        customerName: savedInvoice.customerName || customerPayload.name,
        customerEmail: savedInvoice.customerEmail || customerPayload.email,
        customerPhone: savedInvoice.customerPhone || customerPayload.phone,
        customerIdentificationType: savedInvoice.customerIdentificationType || customerPayload.identificationType,
        customerIdentification: savedInvoice.customerIdentification || customerPayload.identificationNumber,
        customerAddress: savedInvoice.customerAddress || customerPayload.address,
        paymentMethod: targetStatus === 'paid' ? paymentMethod : savedInvoice.paymentMethod,
        paymentReference: targetStatus === 'paid' ? paymentReference : savedInvoice.paymentReference,
        amountReceived: targetStatus === 'paid' ? receivedAmount : savedInvoice.amountReceived,
        changeAmount: targetStatus === 'paid' ? computedChange : savedInvoice.changeAmount,
        paidAt: targetStatus === 'paid' ? savedInvoice.paidAt || eventTimestampIso : savedInvoice.paidAt
      };

      await persistInvoiceLocally(normalizedInvoice);

      if (editingInvoice) {
        dispatch(updateInvoiceSuccess(normalizedInvoice));
      } else {
        dispatch(createInvoiceSuccess(normalizedInvoice));
      }

      if (targetStatus === 'paid' && printAfterPayment) {
        handlePrintInvoice(normalizedInvoice);
      }

      setShowModal(false);
      resetForm();
      await loadInvoices(isAdmin && invoiceViewMode === 'deleted' ? 'cancelled' : undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar la factura';
      alert(message);
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setInvoiceItems(invoice.items ?? []);
    handleDocumentTypeChange((invoice.documentType as InvoiceDocumentType) || 'consumer_final');
    setCustomerName(invoice.customerName || 'Consumidor Final');
    setCustomerEmail(invoice.customerEmail || '');
    setCustomerPhone(invoice.customerPhone || '');
    setCustomerIdentificationType((invoice.customerIdentificationType as CustomerIdentificationType) || 'none');
    setCustomerIdentification(invoice.customerIdentification || '');
    setCustomerAddress(invoice.customerAddress || '');
    setInvoiceStatusSelection(invoice.status);
    setPaymentMethod((invoice.paymentMethod as PaymentMethod) || 'cash');
    setPaymentReference(invoice.paymentReference || '');
    setAmountReceived(invoice.amountReceived !== undefined ? String(toNumber(invoice.amountReceived)) : String(toNumber(invoice.total)));
    setPrintAfterPayment(true);
    setShowModal(true);
  };

  const handleDelete = async (invoice: Invoice) => {
    const confirmed = window.confirm('¿Está seguro de marcar esta factura como eliminada?');
    if (!confirmed) return;

    try {
      const deleteTimestamp = new Date();
      const deletedAtIso = deleteTimestamp.toISOString();
      const deletedInvoice = isOnline
        ? await apiService.deleteInvoice(invoice.id)
        : ({
            ...invoice,
            status: 'cancelled',
            updatedAt: deletedAtIso
          } as Invoice);

      if (!isOnline) {
        await localDBService.addPendingEvent({
          id: `delete_invoice_${invoice.id}_${deleteTimestamp.getTime()}`,
          type: 'delete_invoice',
          data: { id: invoice.id, status: 'cancelled' },
          timestamp: deletedAtIso,
          synced: false
        });
      }

      await persistInvoiceLocally(deletedInvoice);
      dispatch(cancelInvoiceSuccess(deletedInvoice));
      await loadInvoices(isAdmin && invoiceViewMode === 'deleted' ? 'cancelled' : undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar la factura';
      alert(message);
    }
  };

  const openPaymentModal = (invoice: Invoice) => {
    setInvoiceToPay(invoice);
    setPaymentMethod((invoice.paymentMethod as PaymentMethod) || 'cash');
    setPaymentReference(invoice.paymentReference || '');
    setAmountReceived(invoice.amountReceived !== undefined ? String(toNumber(invoice.amountReceived)) : String(toNumber(invoice.total)));
    setPrintAfterPayment(true);
    setShowPaymentModal(true);
  };

  const handlePayInvoice = async () => {
    if (!invoiceToPay) return;

    const invoiceTotal = toNumber(invoiceToPay.total);
    const receivedAmount = paymentMethod === 'cash' ? toNumber(amountReceived) : invoiceTotal;
    const computedChange = Math.max(receivedAmount - invoiceTotal, 0);
    const paymentTimestamp = new Date();
    const paymentTimestampIso = paymentTimestamp.toISOString();

    if (paymentMethod === 'cash' && receivedAmount < invoiceTotal) {
      alert('El dinero recibido no puede ser menor al total a pagar.');
      return;
    }

    try {
      const updatedInvoice = isOnline
        ? await apiService.updateInvoiceStatus(invoiceToPay.id, 'paid', {
            paymentMethod,
            paymentReference,
            amountReceived: receivedAmount,
            changeAmount: computedChange
          })
        : ({
            ...invoiceToPay,
            status: 'paid',
            paidAt: paymentTimestampIso,
            paymentMethod,
            paymentReference,
            amountReceived: receivedAmount,
            changeAmount: computedChange,
            updatedAt: paymentTimestampIso
          } as Invoice);

      const normalizedInvoice: Invoice = {
        ...updatedInvoice,
        total: toNumber(updatedInvoice.total),
        paymentMethod,
        paymentReference,
        amountReceived: receivedAmount,
        changeAmount: computedChange,
        paidAt: updatedInvoice.paidAt || paymentTimestampIso
      };

      if (!isOnline) {
        await localDBService.addPendingEvent({
          id: `pay_invoice_${invoiceToPay.id}_${paymentTimestamp.getTime()}`,
          type: 'actualizar_factura',
          data: { id: invoiceToPay.id, status: 'paid', paymentMethod, paymentReference, amountReceived: receivedAmount, changeAmount: computedChange },
          timestamp: paymentTimestampIso,
          synced: false
        });
      }

      await persistInvoiceLocally(normalizedInvoice);
      dispatch(updateInvoiceSuccess(normalizedInvoice));

      if (printAfterPayment) {
        handlePrintInvoice(normalizedInvoice);
      }

      resetPaymentState();
      await loadInvoices(isAdmin && invoiceViewMode === 'deleted' ? 'cancelled' : undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo pagar la factura';
      alert(message);
    }
  };

  const handleSendInvoiceEmail = async (invoice: Invoice) => {
    const recipient = invoice.customerEmail || window.prompt('Ingresa el correo del cliente para enviar la nota de venta:', '');

    if (!recipient) {
      return;
    }

    try {
      setSendingEmailId(invoice.id);
      const updatedInvoice = await apiService.sendInvoiceEmail(invoice.id, recipient);
      await persistInvoiceLocally(updatedInvoice);
      dispatch(updateInvoiceSuccess(updatedInvoice));
      alert(`Nota de venta enviada correctamente a ${recipient}.`);
      await loadInvoices(isAdmin && invoiceViewMode === 'deleted' ? 'cancelled' : undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo enviar el correo';
      alert(message);
    } finally {
      setSendingEmailId(null);
    }
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    const invoiceLines = (invoice.items ?? [])
      .map(
        item => `
          <tr>
            <td>${item.product?.name ?? `Producto #${item.productId}`}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">${formatCurrency(item.total)}</td>
          </tr>`
      )
      .join('');

    const documentLabel = invoice.documentType === 'sales_note' ? 'NOTA DE VENTA' : 'RECIBO';
    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) {
      alert('Permite las ventanas emergentes para imprimir la factura.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${documentLabel} ${invoice.invoiceNumber || invoice.id}</title>
          <style>
            @page { size: 80mm auto; margin: 3mm; }
            body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; color: #111827; font-size: 12px; }
            .center { text-align: center; }
            .divider { border-top: 1px dashed #111827; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 4px 0; vertical-align: top; }
            .totals td { padding-top: 4px; }
            .strong { font-weight: bold; }
            .small { font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="strong">DIUR SYSTEM</div>
            <div>${documentLabel}</div>
            <div class="small">Documento referencial no válido como factura electrónica SRI</div>
          </div>

          <div class="divider"></div>
          <div><span class="strong">Nro:</span> ${invoice.invoiceNumber || `#${invoice.id}`}</div>
          <div><span class="strong">Fecha:</span> ${new Date(invoice.createdAt).toLocaleString()}</div>
          <div><span class="strong">Cliente:</span> ${invoice.customerName || 'Consumidor Final'}</div>
          <div><span class="strong">Doc:</span> ${invoice.customerIdentification || '9999999999999'}</div>
          <div><span class="strong">Correo:</span> ${invoice.customerEmail || 'No registrado'}</div>
          <div><span class="strong">Estado:</span> ${invoice.status === 'paid' ? 'Pagada' : invoice.status === 'pending' ? 'Creada' : 'Eliminada'}</div>

          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th>Detalle</th>
                <th style="text-align:center;">Cant.</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>${invoiceLines}</tbody>
          </table>

          <div class="divider"></div>
          <table class="totals">
            <tr><td>Método</td><td style="text-align:right;">${invoice.paymentMethod || 'No indicado'}</td></tr>
            <tr><td>Referencia</td><td style="text-align:right;">${invoice.paymentReference || '—'}</td></tr>
            <tr><td>Recibido</td><td style="text-align:right;">${formatCurrency(invoice.amountReceived)}</td></tr>
            <tr><td>Vuelto</td><td style="text-align:right;">${formatCurrency(invoice.changeAmount)}</td></tr>
            <tr class="strong"><td>TOTAL</td><td style="text-align:right;">${formatCurrency(invoice.total)}</td></tr>
          </table>

          <div class="divider"></div>
          <div class="center small">Gracias por su compra</div>
          <div class="center small">App preparada para futura integración con SRI Ecuador</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const canCreateInvoices = Boolean(user);
  const canPayInvoices = Boolean(user);
  const canEditInvoices = user?.role === 'admin' || user?.role === 'caja';
  const isDeletedView = isAdmin && invoiceViewMode === 'deleted';
  const visibleInvoices = isDeletedView ? invoices.filter(invoice => invoice.status === 'cancelled') : invoices.filter(invoice => invoice.status !== 'cancelled');
  const createdInvoices = visibleInvoices.filter(invoice => invoice.status === 'pending').length;
  const paidInvoices = visibleInvoices.filter(invoice => invoice.status === 'paid').length;
  const deletedInvoices = visibleInvoices.filter(invoice => invoice.status === 'cancelled').length;
  const totalBilled = visibleInvoices.reduce((sum, invoice) => sum + toNumber(invoice.total), 0);
  const draftTotal = calculateTotal(invoiceItems);
  const paymentPreviewTotal = invoiceToPay ? toNumber(invoiceToPay.total) : draftTotal;
  const receivedPreview = amountReceived === '' ? 0 : toNumber(amountReceived);
  const changePreview = Math.max(receivedPreview - paymentPreviewTotal, 0);

  const getInvoiceStatusLabel = (status: Invoice['status']) => {
    if (status === 'paid') return 'Pagada';
    if (status === 'pending') return 'Creada';
    return 'Eliminada';
  };

  const getInvoiceStatusClass = (status: Invoice['status']) => {
    if (status === 'paid') return 'bg-success';
    if (status === 'pending') return 'bg-warning';
    return 'bg-danger';
  };

  const getDocumentLabel = (invoice: Invoice) => (invoice.documentType === 'sales_note' ? 'Nota de venta' : 'Consumidor final');

  return (
    <div className='page-shell container-fluid p-4'>
      <div className='page-header'>
        <div>
          <span className='eyebrow mb-2'>Facturación</span>
          <h2 className='mb-1'>Gestión de Facturas</h2>
          <p className='mb-0'>Las facturas creadas y pagadas están visibles para admin y caja; las eliminadas solo aparecen en la vista administrativa.</p>
        </div>
        <div className='page-actions'>
          <button className='btn btn-goback' onClick={() => navigate(-1)}>
            <svg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='#000000'>
              <path d='m142-480 294 294q15 15 14.5 35T435-116q-15 15-35 15t-35-15L57-423q-12-12-18-27t-6-30q0-15 6-30t18-27l308-308q15-15 35.5-14.5T436-844q15 15 15 35t-15 35L142-480Z' />
            </svg>
          </button>
          <button className='btn btn-outline-secondary' onClick={() => void Promise.all([loadInvoices(isDeletedView ? 'cancelled' : undefined), loadProducts()])}>
            Actualizar
          </button>
          {canCreateInvoices && (
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
            <div className='metric-label'>{isDeletedView ? 'Facturas eliminadas' : 'Facturas creadas'}</div>
            <div className='metric-value'>{isDeletedView ? deletedInvoices : createdInvoices}</div>
          </div>
        </div>
        <div className='col-12 col-md-4'>
          <div className='stat-card'>
            <div className='metric-label'>{isDeletedView ? 'Facturas pagadas en vista actual' : 'Facturas pagadas'}</div>
            <div className='metric-value'>{paidInvoices}</div>
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

      {isAdmin && (
        <div className='section-card mb-4'>
          <div className='d-flex flex-wrap gap-2 align-items-center justify-content-between'>
            <div>
              <h6 className='mb-1'>Vista administrativa de facturas</h6>
              <p className='mb-0 text-muted'>Solo el administrador puede entrar a la sección de eliminadas.</p>
            </div>
            <div className='btn-group'>
              <button type='button' className={`btn ${!isDeletedView ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setInvoiceViewMode('active')}>
                Creadas y pagadas
              </button>
              <button type='button' className={`btn ${isDeletedView ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setInvoiceViewMode('deleted')}>
                Eliminadas
              </button>
            </div>
          </div>
        </div>
      )}

      <div className='section-card'>
        {loading ? (
          <div className='text-center py-4'>Cargando facturas...</div>
        ) : visibleInvoices.length === 0 ? (
          <div className='text-center py-4 text-muted'>{isDeletedView ? 'No hay facturas eliminadas registradas.' : 'No hay facturas creadas o pagadas todavía.'}</div>
        ) : (
          <>
            <div className='invoice-mobile-list d-grid gap-3 d-lg-none'>
              {visibleInvoices.map(invoice => (
                <article key={invoice.id} className='invoice-mobile-card'>
                  <div className='invoice-mobile-card__header'>
                    <div>
                      <div className='invoice-mobile-card__number'>{invoice.invoiceNumber || `#${invoice.id}`}</div>
                      <small className='text-muted'>{new Date(invoice.createdAt).toLocaleString()}</small>
                    </div>
                    <span className={`badge ${getInvoiceStatusClass(invoice.status)}`}>{getInvoiceStatusLabel(invoice.status)}</span>
                  </div>

                  <div className='invoice-mobile-card__amount'>{formatCurrency(invoice.total)}</div>

                  <div className='invoice-mobile-meta'>
                    <div className='invoice-mobile-meta__item'>
                      <span className='invoice-mobile-meta__label'>Cliente</span>
                      <strong>{invoice.customerName || 'Consumidor Final'}</strong>
                      <small>{invoice.customerIdentification || '9999999999999'}</small>
                    </div>
                    <div className='invoice-mobile-meta__item'>
                      <span className='invoice-mobile-meta__label'>Documento</span>
                      <strong>{getDocumentLabel(invoice)}</strong>
                      <small>{invoice.paymentMethod || 'Sin método'}</small>
                    </div>
                    <div className='invoice-mobile-meta__item'>
                      <span className='invoice-mobile-meta__label'>Items</span>
                      <strong>{invoice.items?.length ?? 0}</strong>
                      <small>{invoice.customerEmail || 'Sin correo registrado'}</small>
                    </div>
                    <div className='invoice-mobile-meta__item'>
                      <span className='invoice-mobile-meta__label'>Pago</span>
                      <strong>{invoice.paymentReference || 'Sin referencia'}</strong>
                      <small>Vuelto: {formatCurrency(invoice.changeAmount)}</small>
                    </div>
                  </div>

                  {canPayInvoices && (
                    <div className='invoice-action-grid'>
                      {invoice.status === 'pending' && (
                        <button className='btn btn-sm btn-outline-success' onClick={() => openPaymentModal(invoice)}>
                          💳 Pagar
                        </button>
                      )}
                      <button className='btn btn-sm btn-outline-secondary' onClick={() => handlePrintInvoice(invoice)}>
                        🖨️ Imprimir
                      </button>
                      {invoice.status !== 'cancelled' && (
                        <button className='btn btn-sm btn-outline-dark' onClick={() => void handleSendInvoiceEmail(invoice)} disabled={sendingEmailId === invoice.id}>
                          {sendingEmailId === invoice.id ? 'Enviando...' : '✉️ Correo'}
                        </button>
                      )}
                      {canEditInvoices && invoice.status !== 'cancelled' && (
                        <>
                          <button className='btn btn-sm btn-outline-primary' onClick={() => handleEdit(invoice)}>
                            ✏️ Editar
                          </button>
                          <button className='btn btn-sm btn-outline-danger' onClick={() => handleDelete(invoice)}>
                            🗑️ Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>

            <div className='table-responsive d-none d-lg-block'>
              <table className='table table-hover table-modern mb-0'>
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Documento</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Método</th>
                    <th>Items</th>
                    {canPayInvoices && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibleInvoices.map(invoice => (
                    <tr key={invoice.id}>
                      <td className='fw-semibold'>{invoice.invoiceNumber || `#${invoice.id}`}</td>
                      <td>{new Date(invoice.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div className='fw-semibold'>{invoice.customerName || 'Consumidor Final'}</div>
                        <small className='text-muted'>{invoice.customerIdentification || '9999999999999'}</small>
                      </td>
                      <td>{getDocumentLabel(invoice)}</td>
                      <td>{formatCurrency(invoice.total)}</td>
                      <td>
                        <span className={`badge ${getInvoiceStatusClass(invoice.status)}`}>{getInvoiceStatusLabel(invoice.status)}</span>
                      </td>
                      <td>{invoice.paymentMethod || '—'}</td>
                      <td>{invoice.items?.length ?? 0}</td>
                      {canPayInvoices && (
                        <td>
                          <div className='d-flex flex-wrap gap-2'>
                            {invoice.status === 'pending' && (
                              <button className='btn btn-sm btn-outline-success' onClick={() => openPaymentModal(invoice)}>
                                💳 Pagar
                              </button>
                            )}
                            <button className='btn btn-sm btn-outline-secondary' onClick={() => handlePrintInvoice(invoice)}>
                              🖨️ Imprimir
                            </button>
                            {invoice.status !== 'cancelled' && (
                              <button className='btn btn-sm btn-outline-dark' onClick={() => void handleSendInvoiceEmail(invoice)} disabled={sendingEmailId === invoice.id}>
                                {sendingEmailId === invoice.id ? 'Enviando...' : '✉️ Correo'}
                              </button>
                            )}
                            {canEditInvoices && invoice.status !== 'cancelled' && (
                              <>
                                <button className='btn btn-sm btn-outline-primary' onClick={() => handleEdit(invoice)}>
                                  ✏️ Editar
                                </button>
                                <button className='btn btn-sm btn-outline-danger' onClick={() => handleDelete(invoice)}>
                                  🗑️ Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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

                  <div className='row g-3 mb-4'>
                    <div className='col-12 col-md-4'>
                      <label className='form-label'>Tipo de comprobante</label>
                      <select className='form-select' value={documentType} onChange={e => handleDocumentTypeChange(e.target.value as InvoiceDocumentType)}>
                        {DOCUMENT_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {documentType === 'consumer_final' ? (
                      <div className='col-12 col-md-8 d-flex align-items-end'>
                        <div className='alert alert-secondary w-100 mb-0'>
                          La venta se emitirá a <strong>Consumidor Final</strong> con formato de recibo.
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className='col-12 col-md-4'>
                          <label className='form-label'>Nombre del cliente</label>
                          <input type='text' className='form-control' value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder='Ej: Juan Pérez' required={documentType === 'sales_note'} />
                        </div>
                        <div className='col-12 col-md-4'>
                          <label className='form-label'>Correo</label>
                          <input type='email' className='form-control' value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder='cliente@correo.com' />
                        </div>
                        <div className='col-12 col-md-4'>
                          <label className='form-label'>Teléfono</label>
                          <input type='text' className='form-control' value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder='0999999999' />
                        </div>
                        <div className='col-12 col-md-4'>
                          <label className='form-label'>Tipo de identificación</label>
                          <select className='form-select' value={customerIdentificationType} onChange={e => setCustomerIdentificationType(e.target.value as CustomerIdentificationType)}>
                            {IDENTIFICATION_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className='col-12 col-md-4'>
                          <label className='form-label'>Número de identificación</label>
                          <input type='text' className='form-control' value={customerIdentification} onChange={e => setCustomerIdentification(e.target.value)} placeholder='Cédula o RUC' />
                        </div>
                        <div className='col-12 col-md-4'>
                          <label className='form-label'>Dirección</label>
                          <input type='text' className='form-control' value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder='Dirección del cliente' />
                        </div>
                      </>
                    )}
                  </div>

                  <div className='row g-2 mb-3'>
                    <div className='col-12 col-md-5'>
                      <input type='text' className='form-control' placeholder='Buscar producto por código/partnumber, nombre o categoría...' value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                    </div>
                    <div className='col-12 col-md-4'>
                      <select className='form-select' value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                        <option value=''>Seleccionar producto...</option>
                        {filteredProducts.length === 0 ? (
                          <option value='' disabled>
                            No hay productos disponibles
                          </option>
                        ) : (
                          filteredProducts.map(product => (
                            <option key={product.id} value={product.id}>
                              [{product.partnumber}] {product.name} - {formatCurrency(product.price)} (Stock: {product.stock})
                            </option>
                          ))
                        )}
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
                    <div className='col-12 col-md-3'>
                      <label className='form-label'>Estado de cobro</label>
                      <select className='form-select' value={invoiceStatusSelection} onChange={e => setInvoiceStatusSelection(e.target.value as Invoice['status'])}>
                        <option value='pending'>Creada</option>
                        <option value='paid'>Pagada</option>
                      </select>
                    </div>
                    {invoiceStatusSelection === 'paid' && (
                      <>
                        <div className='col-12 col-md-3'>
                          <label className='form-label'>Método de pago</label>
                          <select className='form-select' value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}>
                            {PAYMENT_OPTIONS.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {paymentMethod !== 'credit' && (
                          <>
                            <div className='col-12 col-md-3'>
                              <label className='form-label'>Dinero recibido</label>
                              <input type='number' className='form-control' min='0' step='0.01' placeholder='0.00' value={amountReceived} onChange={e => setAmountReceived(e.target.value)} />
                            </div>
                            <div className='col-12 col-md-3'>
                              <label className='form-label'>Cambio / Vuelto</label>
                              <input type='text' className='form-control' value={formatCurrency(changePreview)} readOnly />
                            </div>
                          </>
                        )}
                        {paymentMethod === 'credit' && (
                          <div className='col-12 col-md-6 alert alert-info'>
                            <small>Se creará una cuenta por cobrar. El cliente podrá pagar esta factura más tarde.</small>
                          </div>
                        )}
                        <div className='col-12 col-md-8'>
                          <label className='form-label'>Referencia</label>
                          <input type='text' className='form-control' placeholder='Últimos 4 dígitos, banco, nro. cheque...' value={paymentReference} onChange={e => setPaymentReference(e.target.value)} />
                        </div>
                        <div className='col-12 col-md-4 d-flex align-items-end'>
                          <div className='form-check ms-md-2'>
                            <input className='form-check-input' type='checkbox' id='printAfterCreatePayment' checked={printAfterPayment} onChange={e => setPrintAfterPayment(e.target.checked)} />
                            <label className='form-check-label' htmlFor='printAfterCreatePayment'>
                              Imprimir al pagar
                            </label>
                          </div>
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
                {paymentMethod !== 'credit' && (
                  <div className='row g-3'>
                    <div className='col-12 col-md-6'>
                      <label className='form-label'>Dinero recibido</label>
                      <input type='number' className='form-control' min='0' step='0.01' placeholder='0.00' value={amountReceived} onChange={e => setAmountReceived(e.target.value)} />
                    </div>
                    <div className='col-12 col-md-6'>
                      <label className='form-label'>Cambio / Vuelto</label>
                      <input type='text' className='form-control' value={formatCurrency(changePreview)} readOnly />
                    </div>
                  </div>
                )}
                {paymentMethod === 'credit' && (
                  <div className='alert alert-info'>
                    <small>Esta factura se marcará como pagada pero no se recibirá dinero en este momento. El cliente tiene una cuenta por cobrar.</small>
                  </div>
                )}
                <div className='mb-3 mt-3'>
                  <label className='form-label'>Referencia / Nota</label>
                  <input type='text' className='form-control' placeholder='Ej: VISA 4455, cheque 1021, transferencia móvil...' value={paymentReference} onChange={e => setPaymentReference(e.target.value)} />
                </div>
                <div className='form-check mb-3'>
                  <input className='form-check-input' type='checkbox' id='printAfterPayment' checked={printAfterPayment} onChange={e => setPrintAfterPayment(e.target.checked)} />
                  <label className='form-check-label' htmlFor='printAfterPayment'>
                    Imprimir al confirmar el pago
                  </label>
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
