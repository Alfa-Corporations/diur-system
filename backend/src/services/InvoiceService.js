const InvoiceRepository = require('../repositories/InvoiceRepository');
const ProductService = require('./ProductService');
const { v4: uuidv4 } = require('uuid');

/**
 * Servicio de Facturas
 * Maneja la lógica de negocio para gestión de facturas.
 * Incluye creación, cálculo de totales y validaciones de stock.
 */
class InvoiceService {
  /**
   * Crea una nueva factura
   * @param {Object} invoiceData - Datos de la factura
   * @param {Array} items - Items de la factura
   * @returns {Promise<Object>} Factura creada
   */
  async createInvoice(invoiceData, items) {
    // Generar número de factura único
    const invoiceNumber = `INV-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Calcular total y validar stock
    let total = 0;
    for (const item of items) {
      const product = await ProductService.getProductById(item.productId);
      if (!await ProductService.checkStock(item.productId, item.quantity)) {
        throw new Error(`Insufficient stock for product ${product.name}`);
      }
      item.price = product.price;
      item.total = item.quantity * product.price;
      total += item.total;
    }

    // Crear factura
    const invoice = await InvoiceRepository.create({
      ...invoiceData,
      invoiceNumber,
      total,
    }, items);

    // Actualizar stock
    for (const item of items) {
      await ProductService.updateStock(item.productId, -item.quantity);
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

    // Restaurar stock
    for (const item of invoice.items) {
      await ProductService.updateStock(item.productId, item.quantity);
    }

    return await this.updateInvoiceStatus(id, 'cancelled');
  }
}

module.exports = new InvoiceService();