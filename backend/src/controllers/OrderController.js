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
      const { type, items, customerName, customerAddress } = req.body;
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
        customerName,
        customerAddress,
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
      const { type, status, userId, limit = 10, offset = 0 } = req.query;
      const filters = {};
      if (type) filters.type = type;
      if (status) filters.status = status;
      if (userId) filters.userId = parseInt(userId);

      const orders = await OrderService.getOrders(filters, parseInt(limit), parseInt(offset));
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
      const { status, quantityProcessed } = req.body;

      const updateData = {};
      if (status) updateData.status = status;
      if (quantityProcessed !== undefined) updateData.quantityProcessed = quantityProcessed;

      const updatedItem = await OrderService.updateOrderItemStatus(
        parseInt(orderId),
        parseInt(productId),
        updateData
      );

      res.json({
        message: 'Order item updated successfully',
        item: updatedItem,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * Cancela un pedido
   * PUT /orders/:id/cancel
   */
  async cancelOrder(req, res) {
    try {
      const { id } = req.params;
      const order = await OrderService.cancelOrder(id);
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