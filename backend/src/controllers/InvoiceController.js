const InvoiceService = require('../services/InvoiceService');
const transporter = require('../utils/mailer');

const emitNotification = (io, target, notification) => {
  if (!io) return;

  if (target === 'all') {
    io.emit('notification', notification);
    return;
  }

  io.to(target).emit('notification', notification);
};

const getInvoiceStatusLabel = status => {
  if (status === 'paid') return 'pagada';
  if (status === 'cancelled') return 'eliminada';
  return 'creada';
};

const buildInvoiceStatusNotification = ({ invoice, username, status }) => ({
  type: status === 'paid' ? 'invoice_paid' : status === 'cancelled' ? 'invoice_deleted' : 'invoice_created',
  message: `La factura ${invoice.invoiceNumber || `#${invoice.id}`} fue ${getInvoiceStatusLabel(status)} por ${username}.`,
  data: {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    updatedBy: username,
  },
  timestamp: new Date().toISOString(),
});

const buildInvoiceEmailHtml = invoice => {
  const rows = (invoice.items || [])
    .map(item => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.product?.name || `Producto #${item.productId}`}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(item.price || 0).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(item.total || 0).toFixed(2)}</td>
      </tr>`)
    .join('');

  const documentLabel = invoice.documentType === 'consumer_final'
    ? 'Consumidor final'
    : invoice.documentType === 'sales_note'
      ? 'Nota de venta'
      : 'Comprobante tipo factura';

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#111827;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 28px;background:#0f172a;color:#ffffff;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <div>
            <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.8;">DIUR SYSTEM</div>
            <h1 style="margin:8px 0 0;font-size:26px;">Nota de venta</h1>
            <p style="margin:6px 0 0;opacity:.8;">Formato referencial tipo SRI Ecuador, sin validación electrónica.</p>
          </div>
          <div style="text-align:right;min-width:220px;">
            <div><strong>Número:</strong> ${invoice.invoiceNumber}</div>
            <div><strong>Fecha:</strong> ${new Date(invoice.createdAt).toLocaleString()}</div>
            <div><strong>Estado:</strong> ${invoice.status === 'paid' ? 'Pagada' : invoice.status === 'pending' ? 'Creada' : 'Eliminada'}</div>
            <div><strong>Documento:</strong> ${documentLabel}</div>
          </div>
        </div>

        <div style="padding:24px 28px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:20px;">
            <div>
              <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#475569;">Cliente</h3>
              <div><strong>${invoice.customerName || 'Consumidor final'}</strong></div>
              <div>${invoice.customerEmail || 'Sin correo registrado'}</div>
              <div>${invoice.customerIdentification || 'Sin identificación'}</div>
              <div>${invoice.customerAddress || 'Sin dirección registrada'}</div>
            </div>
            <div>
              <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#475569;">Pago</h3>
              <div><strong>Método:</strong> ${invoice.paymentMethod || 'No indicado'}</div>
              <div><strong>Referencia:</strong> ${invoice.paymentReference || 'No indicada'}</div>
              <div><strong>Recibido:</strong> $${Number(invoice.amountReceived || 0).toFixed(2)}</div>
              <div><strong>Vuelto:</strong> $${Number(invoice.changeAmount || 0).toFixed(2)}</div>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:10px;text-align:left;">Detalle</th>
                <th style="padding:10px;text-align:center;">Cant.</th>
                <th style="padding:10px;text-align:right;">P. Unit.</th>
                <th style="padding:10px;text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <div style="margin-top:20px;text-align:right;font-size:18px;">
            <strong>Total: $${Number(invoice.total || 0).toFixed(2)}</strong>
          </div>

          <div style="margin-top:20px;padding:14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;font-size:13px;color:#9a3412;">
            Documento interno generado por DIUR. Puede evolucionar a comprobante SRI validado en una futura integración.
          </div>
        </div>
      </div>
    </div>`;
};

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
      const io = req.app.get('io');

      emitNotification(io, 'all', buildInvoiceStatusNotification({
        invoice,
        username: req.user.username,
        status: 'pending',
      }));

      res.status(201).json({
        message: 'Factura creada correctamente',
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

      if (invoice.status === 'cancelled' && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo el administrador puede ver facturas eliminadas.' });
      }

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
      const requestedStatus = typeof status === 'string' ? status : undefined;

      if (req.user.role === 'admin' && userId) {
        filters.userId = parseInt(userId, 10);
      }

      if (requestedStatus === 'cancelled') {
        if (req.user.role !== 'admin') {
          return res.status(403).json({ message: 'Solo el administrador puede ver facturas eliminadas.' });
        }

        filters.status = 'cancelled';
      } else if (requestedStatus) {
        filters.status = requestedStatus;
      } else {
        filters.excludeStatuses = ['cancelled'];
      }

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
      const io = req.app.get('io');

      if (status === 'paid' || status === 'cancelled') {
        emitNotification(io, 'all', buildInvoiceStatusNotification({
          invoice,
          username: req.user.username,
          status,
        }));
      }

      res.json({
        message: 'Estado de la factura actualizado correctamente',
        invoice,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async sendInvoiceEmail(req, res) {
    try {
      const { id } = req.params;
      const { email } = req.body;
      const invoice = await InvoiceService.getInvoiceById(id);
      const recipient = email || invoice.customerEmail;

      if (!recipient) {
        return res.status(400).json({ message: 'The customer does not have a registered email' });
      }

      if (!process.env.G_NAME && !process.env.MAIL_USER) {
        throw new Error('The email service is not configured. Set G_NAME/G_PASSWORD or MAIL_USER/MAIL_PASSWORD in the backend environment.');
      }

      await transporter.sendMail({
        from: process.env.G_NAME || process.env.MAIL_USER,
        to: recipient,
        subject: `Nota de venta ${invoice.invoiceNumber}`,
        html: buildInvoiceEmailHtml(invoice),
      });

      if (invoice.customer && email && invoice.customer.email !== email) {
        await invoice.customer.update({ email });
      }

      const updatedInvoice = await InvoiceService.markInvoiceEmailSent(id, recipient);

      res.json({
        message: 'Invoice sent by email successfully',
        invoice: updatedInvoice,
      });
    } catch (error) {
      res.status(400).json({ message: error.message || 'The email could not be sent' });
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
      const io = req.app.get('io');

      emitNotification(io, 'all', buildInvoiceStatusNotification({
        invoice,
        username: req.user.username,
        status: 'cancelled',
      }));

      res.json({
        message: 'Factura marcada como eliminada correctamente',
        invoice,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new InvoiceController();