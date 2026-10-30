const OrderService = require('../services/OrderService');

/**
 * Controlador de Pedidos
 * Maneja las rutas relacionadas con gestión de pedidos.
 */
class OrderController {
  /**
   * Crea un nuevo pedido
   * POST /orders
   */
  async createOrder(req, res) {
    try {
      const { type, items, customerId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      if (!type || !items || items.length === 0) {
        return res.status(400).json({ message: 'Type and items are required' });
      }

      const orderData = {
        userId,
        type,
        customerId,
      };

      const order = await OrderService.createOrder(orderData, items);
      res.status(201).json({
        message: 'Order created successfully',
        order,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * Obtiene un pedido por ID
   * GET /orders/:id
   */
  async getOrder(req, res) {
    try {
      const { id } = req.params;
      const order = await OrderService.getOrderById(id);
      res.json({ order });
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  /**
   * Lista pedidos con filtros
   * GET /orders
   */
  async getOrders(req, res) {
    try {
      const { type, status, userId, customerId } = req.query;
      const filters = {};
      if (type) filters.type = type;
      if (status) filters.status = status;
      if (userId) filters.userId = parseInt(userId);
      if (customerId !== undefined) {
        const parsedCustomerId = Number(customerId);
        if (!Number.isInteger(parsedCustomerId) || parsedCustomerId <= 0) {
          return res.status(400).json({ message: 'customerId must be a positive integer' });
        }
        filters.customerId = parsedCustomerId;
      }

      const orders = await OrderService.getOrders(filters);
      res.json({ orders });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * Actualiza el estado de un item de pedido
   * PATCH /orders/:orderId/items/:productId/status
   */
  async updateOrderItemStatus(req, res) {
    try {
      const { orderId, productId } = req.params;
      const { quantityProcessed } = req.body;
      const parsedOrderId = Number(orderId);
      const parsedProductId = Number(productId);

      if (!Number.isSafeInteger(parsedOrderId) || parsedOrderId <= 0 || !Number.isSafeInteger(parsedProductId) || parsedProductId <= 0) {
        return res.status(400).json({ message: 'orderId y productId deben ser enteros positivos' });
      }

      if (quantityProcessed === undefined) {
        return res.status(400).json({
          message: 'quantityProcessed es requerido'
        });
      }

      if (!Number.isSafeInteger(quantityProcessed) || quantityProcessed <= 0) {
        return res.status(400).json({
          message: 'quantityProcessed debe ser un entero mayor a 0'
        });
      }

      const updatedItem = await OrderService.updateOrderItemStatus(
        parsedOrderId,
        parsedProductId,
        { quantityProcessed }
      );

      res.json({
        message: 'Item actualizado correctamente',
        item: updatedItem
      });

    } catch (error) {
      console.error(error); // 🔥 DEBUG
      res.status(400).json({
        message: error.message || 'Error al actualizar item'
      });
    }
  }

  /**
   * Cancela un pedido
   * PUT /orders/:id/cancel
   */
  async cancelOrder(req, res) {
    try {
      const { id } = req.params;
      const order = await OrderService.cancelOrder(Number(id));
      res.json({
        message: 'Order cancelled successfully',
        order,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new OrderController();