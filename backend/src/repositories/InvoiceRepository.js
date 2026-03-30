const { Invoice, InvoiceItem, User } = require('../models');

/**
 * Repositorio para operaciones de Factura
 * Encapsula la lógica de acceso a datos para el modelo Invoice.
 * Proporciona métodos CRUD y consultas específicas.
 */
class InvoiceRepository {
  /**
   * Crea una nueva factura con items
   * @param {Object} invoiceData - Datos de la factura
   * @param {Array} items - Items de la factura
   * @returns {Promise<Invoice>} Factura creada
   */
  async create(invoiceData, items = []) {
    const invoice = await Invoice.create(invoiceData);
    if (items.length > 0) {
      const itemsWithInvoiceId = items.map(item => ({ ...item, invoiceId: invoice.id }));
      await InvoiceItem.bulkCreate(itemsWithInvoiceId);
    }
    return await this.findById(invoice.id);
  }

  /**
   * Encuentra una factura por ID con items
   * @param {number} id - ID de la factura
   * @returns {Promise<Invoice|null>} Factura encontrada o null
   */
  async findById(id) {
    return await Invoice.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'email', 'role'] },
        { model: InvoiceItem, as: 'items', include: ['product'] }
      ]
    });
  }

  /**
   * Encuentra una factura por número
   * @param {string} invoiceNumber - Número de factura
   * @returns {Promise<Invoice|null>} Factura encontrada o null
   */
  async findByNumber(invoiceNumber) {
    return await Invoice.findOne({
      where: { invoiceNumber },
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'email', 'role'] },
        { model: InvoiceItem, as: 'items', include: ['product'] }
      ]
    });
  }

  /**
   * Actualiza una factura
   * @param {number} id - ID de la factura
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Invoice>} Factura actualizada
   */
  async update(id, updateData) {
    const invoice = await Invoice.findByPk(id);
    if (!invoice) throw new Error('Invoice not found');
    return await invoice.update(updateData);
  }

  /**
   * Elimina una factura
   * @param {number} id - ID de la factura
   * @returns {Promise<boolean>} True si se eliminó
   */
  async delete(id) {
    const invoice = await Invoice.findByPk(id);
    if (!invoice) return false;
    await invoice.destroy();
    return true;
  }

  /**
   * Lista facturas con paginación y filtros
   * @param {Object} filters - Filtros opcionales
   * @param {number} limit - Límite de resultados
   * @param {number} offset - Desplazamiento
   * @returns {Promise<Array<Invoice>>} Lista de facturas
   */
  async findAll(filters = {}, limit = 10, offset = 0) {
    const where = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;
    return await Invoice.findAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'email', 'role'] },
        { model: InvoiceItem, as: 'items', include: ['product'] }
      ]
    });
  }
}

module.exports = new InvoiceRepository();