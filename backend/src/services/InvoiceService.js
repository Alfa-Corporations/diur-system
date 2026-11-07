const InvoiceRepository = require('../repositories/InvoiceRepository');
const ProductService = require('./ProductService');
const OrderService = require('./OrderService');
const { Customer, Invoice, Order, OrderItem, AccountsReceivable, AccountsReceivablePayment } = require('../models');
const { v4: uuidv4 } = require('uuid');

/**
 * Servicio de Facturas
 * Maneja la lógica de negocio para gestión de facturas.
 * Incluye creación, cálculo de totales y validaciones de stock.
 */
class InvoiceService {
  async resolveCustomer(customerData = {}, documentType = 'consumer_final') {
    if (documentType === 'consumer_final') {
      const [customer] = await Customer.findOrCreate({
        where: { name: 'Consumidor Final', isFinalConsumer: true },
        defaults: {
          email: null,
          phone: null,
          identificationType: 'none',
          identificationNumber: '9999999999999',
          address: 'N/A',
          isFinalConsumer: true,
        },
      });

      return customer;
    }

    const normalizedEmail = customerData.email?.trim()?.toLowerCase() || null;
    const normalizedIdentification = customerData.identificationNumber?.trim() || null;

    const where = normalizedIdentification
      ? { identificationNumber: normalizedIdentification }
      : normalizedEmail
        ? { email: normalizedEmail }
        : null;

    let customer = where ? await Customer.findOne({ where }) : null;

    const payload = {
      name: customerData.name?.trim() || 'Cliente ocasional',
      email: normalizedEmail,
      phone: customerData.phone?.trim() || null,
      identificationType: customerData.identificationType || 'none',
      identificationNumber: normalizedIdentification,
      address: customerData.address?.trim() || null,
      isFinalConsumer: false,
    };

    if (customer) {
      await customer.update(payload);
      return customer;
    }

    return await Customer.create(payload);
  }

  /**
   * Crea una nueva factura
   * @param {Object} invoiceData - Datos de la factura
   * @param {Array} items - Items de la factura
   * @returns {Promise<Object>} Factura creada
   */
  async createInvoice(invoiceData, items) {
    const { customer: customerData = {}, documentType = 'consumer_final', ...baseInvoiceData } = invoiceData;

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('La factura debe incluir al menos un producto');
    }

    const deliveryEvidence = baseInvoiceData.deliveryEvidence;
    delete baseInvoiceData.deliveryEvidence;
    const orderItemsById = new Map();
    const quantitiesByOrderItemId = new Map();
    const dispatchOrderItemIds = new Set();
    const regularQuantitiesByProductId = new Map();
    for (const item of items) {
      if (!Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
        throw new Error('La cantidad facturada debe ser un entero mayor a cero');
      }

      if (item.orderItemId === undefined || item.orderItemId === null) {
        regularQuantitiesByProductId.set(
          Number(item.productId),
          (regularQuantitiesByProductId.get(Number(item.productId)) || 0) + Number(item.quantity)
        );
        continue;
      }

      const orderItemId = Number(item.orderItemId);
      if (!Number.isSafeInteger(orderItemId) || orderItemId <= 0) {
        throw new Error('El producto de la orden asociado a la factura no es válido');
      }
      let orderItem = orderItemsById.get(orderItemId);
      if (!orderItem) {
        orderItem = await OrderItem.findByPk(orderItemId);
        if (!orderItem) throw new Error(`No se encontró el producto de orden ${orderItemId}`);
        if (Number(orderItem.productId) !== Number(item.productId)) {
          throw new Error('El producto facturado no coincide con el producto de la orden');
        }
        orderItemsById.set(orderItemId, orderItem);
      }
      quantitiesByOrderItemId.set(
        orderItemId,
        (quantitiesByOrderItemId.get(orderItemId) || 0) + Number(item.quantity)
      );
    }

    for (const [orderItemId, quantity] of quantitiesByOrderItemId) {
      const orderItem = orderItemsById.get(orderItemId);
      const order = await Order.findByPk(orderItem.orderId);
      if (!order || order.status === 'cancelado') {
        throw new Error(`La orden ${orderItem.orderId} no está disponible para despacho`);
      }
      if (orderItem.dispatchStatus !== 'en_local') {
        throw new Error(`El producto de la orden ${orderItem.orderId} debe cargarse y recibirse en el local antes de facturar`);
      }
      const remaining = Number(orderItem.quantityRequested) - Number(orderItem.quantityProcessed);
      if (quantity > remaining) {
        throw new Error(`La cantidad a despachar supera lo pendiente en la orden ${orderItem.orderId}`);
      }
      if (quantity > Number(orderItem.quantityLoaded)) {
        throw new Error(`La cantidad supera lo cargado en el vehículo para la orden ${orderItem.orderId}`);
      }
      dispatchOrderItemIds.add(orderItemId);
    }

    if (dispatchOrderItemIds.size > 0 && !deliveryEvidence) {
      throw new Error('Debes adjuntar una foto de la entrega para facturar productos despachados');
    }
    if (deliveryEvidence !== undefined) {
      const evidenceMatch = typeof deliveryEvidence === 'string'
        ? deliveryEvidence.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/)
        : null;
      if (!evidenceMatch || Buffer.byteLength(evidenceMatch[1], 'base64') > 2 * 1024 * 1024) {
        throw new Error('La evidencia debe ser una imagen JPEG válida de máximo 2 MB');
      }
    }

    const invoiceNumber = `INV-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
    const customer = await this.resolveCustomer(customerData, documentType);

    let total = 0;
    for (const item of items) {
      const product = await ProductService.getProductById(item.productId);
      item.price = item.price ?? product.price;
      item.total = item.quantity * item.price;
      total += item.total;
    }

    for (const [productId, quantity] of regularQuantitiesByProductId) {
      const product = await ProductService.getProductById(productId);
      if (!await ProductService.checkStock(productId, quantity)) {
        throw new Error(`Insufficient stock for product ${product.name}`);
      }
    }

    const customerSnapshot = documentType === 'consumer_final'
      ? {
        customerName: 'Consumidor Final',
        customerEmail: null,
        customerPhone: null,
        customerIdentificationType: 'none',
        customerIdentification: '9999999999999',
        customerAddress: 'N/A',
      }
      : {
        customerName: customerData.name?.trim() || customer.name,
        customerEmail: customerData.email?.trim()?.toLowerCase() || customer.email,
        customerPhone: customerData.phone?.trim() || customer.phone,
        customerIdentificationType: customerData.identificationType || customer.identificationType || 'none',
        customerIdentification: customerData.identificationNumber?.trim() || customer.identificationNumber,
        customerAddress: customerData.address?.trim() || customer.address,
      };

    const invoice = await InvoiceRepository.create({
      ...baseInvoiceData,
      invoiceNumber,
      customerId: customer.id,
      documentType,
      sriStatus: documentType === 'sri_invoice' ? 'pending' : 'not_applicable',
      total,
      deliveryEvidence: deliveryEvidence || null,
      hasDeliveryEvidence: Boolean(deliveryEvidence),
      ...customerSnapshot,
    }, items);

    // Si el método de pago es crédito, crear una cuenta por cobrar
    // (incluso si creditAmount = 0, para permitir abonos posteriores)
    if (baseInvoiceData.paymentMethod === 'credit' && customer.id) {
      const paidNow = Number(baseInvoiceData.amountReceived || 0);
      const creditAmount = Math.max(0, Number(total) - paidNow);
      console.log('[DEBUG] Creating AR: total=', total, 'paidNow=', paidNow, 'creditAmount=', creditAmount);
      // Crear AR si hay saldo o si el usuario específicamente eligió crédito
      if (creditAmount > 0) {
        await this.createAccountReceivable(invoice.id, customer.id, creditAmount);
      } else if (creditAmount === 0 && paidNow > 0) {
        // Si pagó todo pero eligió método 'credit', crear AR con saldo 0 (permitirá abonos si se reversa)
        console.log('[DEBUG] Creating AR with 0 balance (payment method = credit, fully paid)');
        await this.createAccountReceivable(invoice.id, customer.id, 0);
      }
    }

    for (const [productId, quantity] of regularQuantitiesByProductId) {
      await ProductService.updateStock(productId, -quantity);
    }

    for (const [orderItemId, quantity] of quantitiesByOrderItemId) {
      const orderItem = orderItemsById.get(orderItemId);
      const newProcessed = Number(orderItem.quantityProcessed || 0) + quantity;
      const newQuantityLoaded = Number(orderItem.quantityLoaded || 0) - quantity;
      const isComplete = newProcessed === Number(orderItem.quantityRequested);
      const dispatchStatus = isComplete ? 'entregado' : newQuantityLoaded > 0 ? 'en_local' : 'pendiente';
      const status = isComplete ? 'facturado' : 'en_transito';
      await orderItem.update({
        quantityProcessed: newProcessed,
        quantityLoaded: newQuantityLoaded,
        dispatchStatus,
        status
      });
      await OrderService.checkOrderCompletion(orderItem.orderId);
    }

    return invoice;
  }

  /**
   * Obtiene una factura por ID
   * @param {number} id - ID de la factura
   * @returns {Promise<Object>} Factura encontrada
   */
  async getInvoiceById(id) {
    const invoice = await InvoiceRepository.findById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    return invoice;
  }

  async getDeliveryEvidence(id) {
    const invoice = await Invoice.findByPk(id, {
      attributes: ['id', 'deliveryEvidence', 'hasDeliveryEvidence'],
    });
    if (!invoice) throw new Error('Invoice not found');
    if (!invoice.deliveryEvidence) throw new Error('Esta factura no tiene evidencia de entrega');
    return invoice.deliveryEvidence;
  }

  /**
   * Actualiza el estado de una factura
   * @param {number} id - ID de la factura
   * @param {string} status - Nuevo estado
   * @returns {Promise<Object>} Factura actualizada
   */
  async updateInvoiceStatus(id, status, paymentData = {}) {
    const validStatuses = ['pending', 'paid', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    const updateData = { status };

    if (status === 'paid') {
      updateData.paidAt = new Date();
      if (paymentData.paymentMethod) updateData.paymentMethod = paymentData.paymentMethod;
      if (paymentData.paymentReference !== undefined) updateData.paymentReference = paymentData.paymentReference;
      if (paymentData.amountReceived !== undefined) updateData.amountReceived = paymentData.amountReceived;
      if (paymentData.changeAmount !== undefined) updateData.changeAmount = paymentData.changeAmount;
    }

    const invoice = await InvoiceRepository.update(id, updateData);

    if (paymentData.paymentMethod === 'credit' && invoice.customerId) {
      const paidNow = Number(paymentData.amountReceived || 0);
      const creditAmount = Math.max(0, Number(invoice.total || 0) - paidNow);
      const existingAR = await AccountsReceivable.findOne({ where: { invoiceId: invoice.id } });

      if (!existingAR) {
        await this.createAccountReceivable(invoice.id, invoice.customerId, creditAmount);
      } else if (existingAR.pendingAmount <= 0 && creditAmount > 0) {
        await existingAR.update({
          totalAmount: creditAmount,
          paidAmount: 0,
          pendingAmount: creditAmount,
          status: 'pending'
        });
      }
    }

    return invoice;
  }

  async markInvoiceEmailSent(id, email) {
    const invoice = await this.getInvoiceById(id);
    return await InvoiceRepository.update(id, {
      customerEmail: email || invoice.customerEmail,
      emailSentAt: new Date(),
    });
  }

  /**
   * Lista facturas con filtros
   * @param {Object} filters - Filtros opcionales
   * @param {number} limit - Límite
   * @param {number} offset - Desplazamiento
   * @returns {Promise<Array>} Lista de facturas
   */
  async getInvoices(filters = {}, limit = 10, offset = 0) {
    return await InvoiceRepository.findAll(filters, limit, offset);
  }

  /**
   * Cancela una factura y restaura stock
   * @param {number} id - ID de la factura
   * @returns {Promise<Object>} Factura cancelada
   */
  async cancelInvoice(id) {
    const invoice = await this.getInvoiceById(id);
    if (invoice.status === 'cancelled') {
      throw new Error('Invoice already cancelled');
    }

    for (const item of invoice.items) {
      if (!invoice.hasDeliveryEvidence) {
        await ProductService.updateStock(item.productId, item.quantity);
      }
    }

    // Si la factura tiene una cuenta por cobrar, también cancelarla
    const accountsReceivable = await AccountsReceivable.findOne({ where: { invoiceId: id } });
    if (accountsReceivable) {
      await accountsReceivable.destroy();
    }

    return await this.updateInvoiceStatus(id, 'cancelled');
  }

  /**
   * Crea una cuenta por cobrar para una factura con pago a crédito
   * @param {number} invoiceId - ID de la factura
   * @param {number} customerId - ID del cliente
   * @param {number} amount - Monto de la deuda
   * @returns {Promise<Object>} Cuenta por cobrar creada
   */
  async createAccountReceivable(invoiceId, customerId, amount) {
    const pendingAmount = Number(amount) || 0;
    const status = pendingAmount === 0 ? 'paid' : 'pending';
    return await AccountsReceivable.create({
      invoiceId,
      customerId,
      totalAmount: pendingAmount,
      paidAmount: 0,
      pendingAmount,
      status,
    });
  }

  /**
   * Registra un pago parcial o total de una cuenta por cobrar
   * @param {number} accountsReceivableId - ID de la cuenta por cobrar
   * @param {number} paymentAmount - Monto pagado
   * @returns {Promise<Object>} Cuenta actualizada
   */
  async recordPayment(accountsReceivableId, paymentAmount, options = {}) {
    const account = await AccountsReceivable.findByPk(accountsReceivableId);
    if (!account) {
      throw new Error('Accounts receivable record not found');
    }

    // registrar el abono en la tabla de pagos
    const payment = await AccountsReceivablePayment.create({
      accountsReceivableId,
      amount: paymentAmount,
      paymentMethod: options.paymentMethod || null,
      paymentReference: options.paymentReference || null,
      userId: options.userId || null,
      createdAt: new Date()
    });

    const newPaidAmount = Number(account.paidAmount) + Number(paymentAmount);
    const newPendingAmount = Math.max(0, Number(account.totalAmount) - newPaidAmount);
    const newStatus = newPendingAmount === 0 ? 'paid' : newPaidAmount > 0 ? 'partial' : 'pending';

    await account.update({
      paidAmount: newPaidAmount,
      pendingAmount: newPendingAmount,
      status: newStatus,
      lastPaymentDate: new Date(),
    });

    // devolver cuenta con el pago creado
    const updated = await AccountsReceivable.findByPk(accountsReceivableId, { include: [{ association: 'payments' }, { association: 'customer' }, { association: 'invoice' }] });
    return { account: updated, payment };
  }

  /**
   * Obtiene todas las cuentas por cobrar de un cliente
   * @param {number} customerId - ID del cliente
   * @returns {Promise<Array>} Cuentas por cobrar del cliente
   */
  async getCustomerAccountsReceivable(customerId) {
    return await AccountsReceivable.findAll({
      where: { customerId },
      include: [{ association: 'invoice', include: [{ association: 'items' }] }],
      order: [['createdAt', 'DESC']],
    });
  }
}

module.exports = new InvoiceService();