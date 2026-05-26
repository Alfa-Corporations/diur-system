const InvoiceRepository = require('../repositories/InvoiceRepository');
const ProductService = require('./ProductService');
const OrderService = require('./OrderService');
const { Customer, OrderItem, AccountsReceivable } = require('../models');
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

    const invoiceNumber = `INV-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
    const customer = await this.resolveCustomer(customerData, documentType);

    let total = 0;
    for (const item of items) {
      const product = await ProductService.getProductById(item.productId);
      if (!await ProductService.checkStock(item.productId, item.quantity)) {
        throw new Error(`Insufficient stock for product ${product.name}`);
      }
      item.price = item.price ?? product.price;
      item.total = item.quantity * item.price;
      total += item.total;
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
      ...customerSnapshot,
    }, items);

    // Si el método de pago es crédito, crear una cuenta por cobrar
    if (baseInvoiceData.paymentMethod === 'credit' && customer.id) {
      await this.createAccountReceivable(invoice.id, customer.id, total);
    }

    for (const item of items) {
      await ProductService.updateStock(item.productId, -item.quantity);

      if (item.orderItemId) {
        const orderItem = await OrderItem.findByPk(item.orderItemId);
        if (orderItem) {
          const newProcessed = (orderItem.quantityProcessed || 0) + item.quantity;
          const newStatus = newProcessed === orderItem.quantityRequested ? 'facturado' : 'en_transito';
          await orderItem.update({
            quantityProcessed: newProcessed,
            status: newStatus
          });
          await OrderService.checkOrderCompletion(orderItem.orderId);
        }
      }
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

    return await InvoiceRepository.update(id, updateData);
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
      await ProductService.updateStock(item.productId, item.quantity);
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
    return await AccountsReceivable.create({
      invoiceId,
      customerId,
      totalAmount: amount,
      paidAmount: 0,
      pendingAmount: amount,
      status: 'pending',
    });
  }

  /**
   * Registra un pago parcial o total de una cuenta por cobrar
   * @param {number} accountsReceivableId - ID de la cuenta por cobrar
   * @param {number} paymentAmount - Monto pagado
   * @returns {Promise<Object>} Cuenta actualizada
   */
  async recordPayment(accountsReceivableId, paymentAmount) {
    const account = await AccountsReceivable.findByPk(accountsReceivableId);
    if (!account) {
      throw new Error('Accounts receivable record not found');
    }

    const newPaidAmount = Number(account.paidAmount) + Number(paymentAmount);
    const newPendingAmount = Math.max(0, Number(account.totalAmount) - newPaidAmount);
    const newStatus = newPendingAmount === 0 ? 'paid' : newPaidAmount > 0 ? 'partial' : 'pending';

    await account.update({
      paidAmount: newPaidAmount,
      pendingAmount: newPendingAmount,
      status: newStatus,
      lastPaymentDate: new Date(),
    });

    return account;
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