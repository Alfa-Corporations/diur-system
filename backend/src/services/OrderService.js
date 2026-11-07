const OrderRepository = require('../repositories/OrderRepository');
const ProductRepository = require('../repositories/ProductRepository');
const { Order, OrderItem, Product } = require('../models');
const db = require('../utils/database');

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

  async loadOrderItem(orderId, orderItemId, quantityLoaded) {
    return db.transaction(async transaction => {
      const [order, item] = await Promise.all([
        Order.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE }),
        OrderItem.findOne({ where: { id: orderItemId, orderId }, transaction, lock: transaction.LOCK.UPDATE }),
      ]);
      if (!order || !item) throw new Error('Orden o producto de orden no encontrado');
      if (order.type === 'compra' || order.status === 'cancelado') {
        throw new Error('Esta orden no está disponible para despacho');
      }
      if (item.dispatchStatus === 'en_local' || item.dispatchStatus === 'entregado') {
        throw new Error('El producto ya salió de la etapa de carga en bodega');
      }

      const remaining = Number(item.quantityRequested) - Number(item.quantityProcessed);
      if (quantityLoaded > remaining) {
        throw new Error(`La cantidad cargada no puede superar las ${remaining} unidades pendientes`);
      }

      const currentLoaded = Number(item.quantityLoaded || 0);
      const difference = quantityLoaded - currentLoaded;
      const product = await Product.findByPk(item.productId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!product) throw new Error('Producto no encontrado');
      if (difference > Number(product.stock)) {
        throw new Error(`Stock físico insuficiente de ${product.name}. Disponible: ${product.stock}`);
      }

      if (difference !== 0) {
        await product.update({ stock: Number(product.stock) - difference }, { transaction });
      }

      return item.update({
        quantityLoaded,
        dispatchStatus: quantityLoaded > 0 ? 'cargando' : 'pendiente',
      }, { transaction });
    });
  }

  async markOrderItemArrived(orderId, orderItemId) {
    const item = await OrderItem.findOne({ where: { id: orderItemId, orderId } });
    if (!item) throw new Error('Producto de orden no encontrado');
    if (item.dispatchStatus !== 'cargando' || Number(item.quantityLoaded) <= 0) {
      throw new Error('Registra primero la cantidad cargada en bodega');
    }
    return item.update({ dispatchStatus: 'en_local' });
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
    if (!order || order.status === 'cancelado') return;

    const items = order.items || [];
    const allCompleted = items.length > 0 && items.every(item => Number(item.quantityProcessed) >= Number(item.quantityRequested));
    const someProcessed = items.some(item => Number(item.quantityProcessed) > 0);

    let newStatus = 'pendiente';

    if (allCompleted) {
      newStatus = 'completado';
    } else if (someProcessed) {
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
    return db.transaction(async transaction => {
      const order = await Order.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!order) throw new Error('Order not found');
      if (order.status === 'cancelado') return order;

      const loadedItems = await OrderItem.findAll({
        where: { orderId: id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      for (const item of loadedItems) {
        const quantityLoaded = Number(item.quantityLoaded || 0);
        if (quantityLoaded > 0) {
          const product = await Product.findByPk(item.productId, { transaction, lock: transaction.LOCK.UPDATE });
          if (!product) throw new Error(`Product ${item.productId} not found`);
          await product.update({ stock: Number(product.stock) + quantityLoaded }, { transaction });
        }
        await item.update({
          quantityLoaded: 0,
          dispatchStatus: 'pendiente',
        }, { transaction });
      }

      return order.update({ status: 'cancelado' }, { transaction });
    });
  }
}

module.exports = new OrderService();