const { AccountsReceivable, Invoice, Customer } = require('../models');

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
        { association: 'customer' }
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
        { association: 'customer' }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  /**
   * Encuentra todas las cuentas pendientes
   * @returns {Promise<Array>} Cuentas pendientes
   */
  async findPending() {
    return await AccountsReceivable.findAll({
      where: { status: ['pending', 'partial', 'overdue'] },
      include: [
        { association: 'invoice' },
        { association: 'customer' }
      ],
      order: [['createdAt', 'DESC']]
    });
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
        { association: 'customer' }
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
      where: { status: ['pending', 'partial', 'overdue'] }
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
