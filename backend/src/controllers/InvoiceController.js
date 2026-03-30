const InvoiceService = require('../services/InvoiceService');

/**
 * Controlador de Facturas
 * Maneja las rutas relacionadas con gestión de facturas.
 */
class InvoiceController {
  /**
   * Crea una nueva factura
   * POST /invoices
   */
  async createInvoice(req, res) {
    try {
      const invoiceData = {
        userId: req.user.id,
        ...req.body,
      };
      const invoice = await InvoiceService.createInvoice(invoiceData, req.body.items);
      res.status(201).json({
        message: 'Invoice created successfully',
        invoice,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * Obtiene una factura por ID
   * GET /invoices/:id
   */
  async getInvoice(req, res) {
    try {
      const { id } = req.params;
      const invoice = await InvoiceService.getInvoiceById(id);
      res.json({ invoice });
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  /**
   * Lista facturas del usuario
   * GET /invoices
   */
  async getInvoices(req, res) {
    try {
      const { status, userId, limit = 10, offset = 0 } = req.query;
      const filters = {};

      if (req.user.role !== 'admin') {
        filters.userId = req.user.id;
      } else if (userId) {
        filters.userId = parseInt(userId, 10);
      }

      if (status) filters.status = status;

      const invoices = await InvoiceService.getInvoices(filters, parseInt(limit, 10), parseInt(offset, 10));
      res.json({ invoices });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Actualiza el estado de una factura
   * PATCH /invoices/:id/status
   */
  async updateInvoiceStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, paymentMethod, paymentReference, amountReceived, changeAmount } = req.body;
      const invoice = await InvoiceService.updateInvoiceStatus(id, status, {
        paymentMethod,
        paymentReference,
        amountReceived,
        changeAmount,
      });
      res.json({
        message: 'Invoice status updated successfully',
        invoice,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * Cancela una factura
   * POST /invoices/:id/cancel
   */
  async cancelInvoice(req, res) {
    try {
      const { id } = req.params;
      const invoice = await InvoiceService.cancelInvoice(id);
      res.json({
        message: 'Invoice cancelled successfully',
        invoice,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new InvoiceController();