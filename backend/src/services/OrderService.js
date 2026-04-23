const OrderRepository = require('../repositories/OrderRepository');
const ProductRepository = require('../repositories/ProductRepository');

/**
 * Servicio de Pedidos
 * Maneja la lógica de negocio para pedidos de compra y venta.
 * Incluye validaciones, cálculos de totales y gestión de estados.
 */
class OrderService {
  /**
   * Crea un nuevo pedido
   * @param {Object} orderData - Datos del pedido
   * @param {Array} items - Items del pedido
   * @returns {Promise<Object>} Pedido creado
   */
  async createOrder(orderData, items) {
    // Validaciones
    if (!orderData.userId || !orderData.type) {
      throw new Error('User ID and type are required');
    }

    if (!items || items.length === 0) {
      throw new Error('Order must have at least one item');
    }

    // Validar items y calcular total
    let total = 0;
    for (const item of items) {
      const product = await ProductRepository.findById(item.productId);
      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }
      if (item.quantityRequested <= 0) {
        throw new Error('Quantity must be greater than 0');
      }
      item.unitPrice = product.price;
      total += item.quantityRequested * product.price;
    }

    orderData.total = total;

    return await OrderRepository.create(orderData, items);
  }

  /**
   * Obtiene un pedido por ID
   * @param {number} id - ID del pedido
   * @returns {Promise<Object>} Pedido encontrado
   */
  async getOrderById(id) {
    const order = await OrderRepository.findById(id);
    if (!order) {
      throw new Error('Order not found');
    }
    return order;
  }

  /**
   * Lista pedidos con filtros
   * @param {Object} filters - Filtros
   * @param {number} limit - Límite
   * @param {number} offset - Desplazamiento
   * @returns {Promise<Array<Object>>} Lista de pedidos
   */
  async getOrders(filters = {}) {
    return await OrderRepository.findAll(filters);
  }

  /**
   * Actualiza el estado de un item de pedido
   * @param {number} orderId - ID del pedido
   * @param {number} productId - ID del producto
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object>} Item actualizado
   */
  async updateOrderItemStatus(orderId, productId, updateData) {
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const item = order.items.find(i => i.productId === productId);
    if (!item) {
      throw new Error('Item no encontrado');
    }

    // 🔢 Cantidad actual procesada
    const currentProcessed = item.quantityProcessed || 0;

    // 🔥 SOLO lo que llega AHORA
    const incoming = updateData.quantityProcessed || 0;

    // 🔢 Nuevo acumulado
    const newProcessed = currentProcessed + incoming;

    // 🚨 Validación
    if (newProcessed > item.quantityRequested) {
      throw new Error('La cantidad excede lo solicitado');
    }

    // 🎯 Estado automático
    let newStatus = 'pendiente';

    if (newProcessed === 0) {
      newStatus = 'pendiente';
    } else if (newProcessed < item.quantityRequested) {
      newStatus = 'en_transito';
    } else if (newProcessed === item.quantityRequested) {
      newStatus = 'en_bodega';
    }

    // 📦 ACTUALIZAR STOCK SOLO LO QUE LLEGÓ
    if (order.type === 'compra' && incoming > 0) {
      const product = await ProductRepository.findById(productId);

      await ProductRepository.update(productId, {
        stock: product.stock + incoming
      });
    }

    // 💾 Guardar
    const updatedItem = await OrderRepository.updateOrderItem(orderId, productId, {
      quantityProcessed: newProcessed,
      status: newStatus
    });

    // 🔄 Estado general del pedido
    await this.checkOrderCompletion(orderId);

    return updatedItem;
  }

  /**
   * Verifica y actualiza el estado general del pedido
   * @param {number} orderId - ID del pedido
   * @returns {Promise<void>}
   */
  async checkOrderCompletion(orderId) {
    const order = await OrderRepository.findById(orderId);
    if (!order) return;

    const items = order.items;

    const allCompleted = items.every(item => item.status === 'en_bodega');

    const someCompleted = items.some(item => item.status === 'en_bodega');

    let newStatus = 'pendiente';

    if (allCompleted) {
      newStatus = 'completado';
    } else if (someCompleted) {
      newStatus = 'parcial';
    }

    if (order.status !== newStatus) {
      await OrderRepository.update(orderId, {
        status: newStatus
      });
    }
  }

  /**
   * Cancela un pedido
   * @param {number} id - ID del pedido
   * @returns {Promise<Object>} Pedido cancelado
   */
  async cancelOrder(id) {
    return await OrderRepository.update(id, { status: 'cancelado' });
  }
}

module.exports = new OrderService();