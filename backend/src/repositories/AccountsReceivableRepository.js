const { AccountsReceivable, Invoice, Customer } = require('../models');
const { Op } = require('sequelize');

/**
 * Repositorio de Cuentas por Cobrar
 * Gestiona operaciones de base de datos para cuentas por cobrar
 */
class AccountsReceivableRepository {
  /**
   * Crea una nueva cuenta por cobrar
   * @param {Object} data - Datos de la cuenta
   * @returns {Promise<Object>} Cuenta creada
   */
  async create(data) {
    return await AccountsReceivable.create(data);
  }

  /**
   * Encuentra una cuenta por ID
   * @param {number} id - ID de la cuenta
   * @returns {Promise<Object>} Cuenta encontrada
   */
  async findById(id) {
    return await AccountsReceivable.findByPk(id, {
      include: [
        { association: 'invoice', include: [{ association: 'items' }] },
        { association: 'customer' },
        { association: 'payments' }
      ]
    });
  }

  /**
   * Encuentra todas las cuentas de un cliente
   * @param {number} customerId - ID del cliente
   * @returns {Promise<Array>} Cuentas del cliente
   */
  async findByCustomerId(customerId) {
    return await AccountsReceivable.findAll({
      where: { customerId },
      include: [
        { association: 'invoice', include: [{ association: 'items' }] },
        { association: 'customer' },
        { association: 'payments' }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  /**
   * Encuentra todas las cuentas pendientes (con saldo > 0)
   * @returns {Promise<Array>} Cuentas con saldo pendiente
   */
  async findPending() {
    try {
      const pendingAccounts = await AccountsReceivable.findAll({
        where: {
          status: { [Op.in]: ['pending', 'partial', 'overdue'] }
        },
        include: [
          { association: 'invoice' },
          { association: 'customer' },
          { association: 'payments' }
        ],
        order: [['createdAt', 'DESC']]
      });

      if (pendingAccounts.length > 0) {
        return pendingAccounts;
      }

      const creditInvoices = await Invoice.findAll({
        where: { paymentMethod: 'credit' },
        include: [
          { association: 'customer' },
          { association: 'accountsReceivable', required: false }
        ],
        order: [['createdAt', 'DESC']]
      });

      const invoicesToConvert = creditInvoices.filter(invoice => {
        const paid = Number(invoice.amountReceived || 0);
        const total = Number(invoice.total || 0);
        const pending = Math.max(0, total - paid);
        return pending > 0 && !invoice.accountsReceivable;
      });

      for (const invoice of invoicesToConvert) {
        const paid = Number(invoice.amountReceived || 0);
        const total = Number(invoice.total || 0);
        const pendingAmount = Math.max(0, total - paid);

        await AccountsReceivable.create({
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          totalAmount: pendingAmount,
          paidAmount: 0,
          pendingAmount,
          status: 'pending'
        });
      }

      return await AccountsReceivable.findAll({
        where: { pendingAmount: { [Op.gt]: 0 } },
        include: [
          { association: 'invoice' },
          { association: 'customer' },
          { association: 'payments' }
        ],
        order: [['createdAt', 'DESC']]
      });
    } catch (error) {
      console.error('[ERROR] findPending failed:', error.message);
      throw error;
    }
  }

  /**
   * Actualiza una cuenta
   * @param {number} id - ID de la cuenta
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Cuenta actualizada
   */
  async update(id, data) {
    const account = await AccountsReceivable.findByPk(id);
    if (!account) {
      throw new Error('Accounts receivable record not found');
    }
    return await account.update(data);
  }

  /**
   * Elimina una cuenta
   * @param {number} id - ID de la cuenta
   * @returns {Promise<void>}
   */
  async delete(id) {
    const account = await AccountsReceivable.findByPk(id);
    if (!account) {
      throw new Error('Accounts receivable record not found');
    }
    return await account.destroy();
  }

  /**
   * Obtiene cuentas por cobrar con filtros
   * @param {Object} filters - Filtros opcionales
   * @param {number} limit - Límite
   * @param {number} offset - Desplazamiento
   * @returns {Promise<Array>} Cuentas filtradas
   */
  async findAll(filters = {}, limit = 10, offset = 0) {
    const where = {};

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.statusIn) {
      where.status = { [require('sequelize').Op.in]: filters.statusIn };
    }

    return await AccountsReceivable.findAll({
      where,
      include: [
        { association: 'invoice', include: [{ association: 'items' }] },
        { association: 'customer' },
        { association: 'payments' }
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });
  }

  /**
   * Calcula estadísticas de cuentas por cobrar
   * @returns {Promise<Object>} Estadísticas
   */
  async getStatistics() {
    const totalAmount = await AccountsReceivable.sum('totalAmount');
    const paidAmount = await AccountsReceivable.sum('paidAmount');
    const pendingAmount = await AccountsReceivable.sum('pendingAmount');
    const pendingCount = await AccountsReceivable.count({
      where: { status: { [Op.in]: ['pending', 'partial', 'overdue'] } }
    });

    return {
      totalAmount: totalAmount || 0,
      paidAmount: paidAmount || 0,
      pendingAmount: pendingAmount || 0,
      pendingCount
    };
  }
}

module.exports = new AccountsReceivableRepository();
