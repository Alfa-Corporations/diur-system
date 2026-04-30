const { Order, OrderItem, Customer } = require('../models');

/**
 * Repositorio para operaciones de Pedido
 * Encapsula la lógica de acceso a datos para el modelo Order.
 * Proporciona métodos CRUD y consultas específicas para pedidos de compra y venta.
 */
class OrderRepository {
  /**
   * Crea un nuevo pedido
   * @param {Object} orderData - Datos del pedido
   * @param {Array} items - Items del pedido
   * @returns {Promise<Order>} Pedido creado con items
   */
  async create(orderData, items = []) {
    const order = await Order.create(orderData);
    if (items.length > 0) {
      const itemsWithOrderId = items.map(item => ({ ...item, orderId: order.id }));
      await OrderItem.bulkCreate(itemsWithOrderId);
    }
    return await this.findById(order.id);
  }

  /**
   * Encuentra un pedido por ID con items
   * @param {number} id - ID del pedido
   * @returns {Promise<Order|null>} Pedido encontrado con items o null
   */
  async findById(id) {
    return await Order.findByPk(id, {
      include: [
        { model: OrderItem, as: 'items', include: ['product'] }
      ]
    });
  }

  /**
   * Lista pedidos con filtros
   * @param {Object} filters - Filtros de búsqueda
   * @param {number} limit - Límite de resultados
   * @param {number} offset - Desplazamiento
   * @returns {Promise<Array<Order>>} Lista de pedidos
   */
  async findAll(filters = {}, limit = 10, offset = 0) {
    const where = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.userId) where.userId = filters.userId;

    return await Order.findAll({
      where,
      include: [
        { model: OrderItem, as: 'items', include: ['product'] },
        { model: Customer, as: 'customer', attributes: {
            exclude: [ 'createdAt', 'updatedAt']
        } }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  /**
   * Actualiza un pedido
   * @param {number} id - ID del pedido
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Order>} Pedido actualizado
   */
  async update(id, updateData) {
    const order = await Order.findByPk(id);
    if (!order) throw new Error('Order not found');
    return await order.update(updateData);
  }

  /**
   * Actualiza el estado de un item de pedido
   * @param {number} orderId - ID del pedido
   * @param {number} productId - ID del producto
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<OrderItem>} Item actualizado
   */
  async updateOrderItem(orderId, productId, updateData) {
    console.log(orderId, productId, updateData);
    const item = await OrderItem.findOne({
      where: { orderId, productId }
    });
    console.log(item);
    if (!item) throw new Error('Order item not found');
    return await item.update(updateData);
  }

  /**
   * Elimina un pedido
   * @param {number} id - ID del pedido
   * @returns {Promise<boolean>} True si eliminado
   */
  async delete(id) {
    const order = await Order.findByPk(id);
    if (!order) throw new Error('Order not found');
    await order.destroy();
    return true;
  }
}

module.exports = new OrderRepository();