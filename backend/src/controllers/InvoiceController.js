const InvoiceService = require('../services/InvoiceService');
const mailer = require('../utils/mailer');
const fs = require('fs/promises');
const imageStorage = require('../utils/imageStorage');

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const emitNotification = (io, notification) => {
  if (!io) return;
  io.to('admin').emit('notification', notification);
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
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.product?.name || `Producto #${item.productId}`)}</td>
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
            <div><strong>Número:</strong> ${escapeHtml(invoice.invoiceNumber)}</div>
            <div><strong>Fecha:</strong> ${escapeHtml(new Date(invoice.createdAt).toLocaleString())}</div>
            <div><strong>Estado:</strong> ${invoice.status === 'paid' ? 'Pagada' : invoice.status === 'pending' ? 'Creada' : 'Eliminada'}</div>
            <div><strong>Documento:</strong> ${documentLabel}</div>
          </div>
        </div>

        <div style="padding:24px 28px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:20px;">
            <div>
              <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#475569;">Cliente</h3>
              <div><strong>${escapeHtml(invoice.customerName || 'Consumidor final')}</strong></div>
              <div>${escapeHtml(invoice.customerEmail || 'Sin correo registrado')}</div>
              <div>${escapeHtml(invoice.customerIdentification || 'Sin identificación')}</div>
              <div>${escapeHtml(invoice.customerAddress || 'Sin dirección registrada')}</div>
            </div>
            <div>
              <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;color:#475569;">Pago</h3>
              <div><strong>Método:</strong> ${escapeHtml(invoice.paymentMethod || 'No indicado')}</div>
              <div><strong>Referencia:</strong> ${escapeHtml(invoice.paymentReference || 'No indicada')}</div>
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
  async uploadDeliveryEvidence(req, res) {
    let storedImage;
    let saved = false;
    try {
      const { id } = req.params;
      storedImage = await imageStorage.storeImage('invoices', id, req.file.buffer);
      const { invoice, previousFilename } = await InvoiceService.saveDeliveryEvidence(id, storedImage.filename);
      saved = true;

      if (previousFilename && !previousFilename.startsWith('data:image/')) {
        await imageStorage.removeStoredImage('invoices', previousFilename).catch(error => {
          console.error('Could not remove previous invoice delivery image:', error);
        });
      }
      res.json({ message: 'Foto de entrega guardada.', invoice });
    } catch (error) {
      if (storedImage && !saved) {
        await imageStorage.removeStoredImage('invoices', storedImage.filename).catch(cleanupError => {
          console.error('Could not clean up failed invoice delivery image:', cleanupError);
        });
      }
      res.status(error.message === 'Factura no encontrada.' ? 404 : 400).json({ message: error.message });
    }
  }

  async getDeliveryEvidence(req, res) {
    try {
      const invoice = await InvoiceService.getDeliveryEvidenceReference(req.params.id);
      if (!invoice || !invoice.hasDeliveryEvidence || !invoice.deliveryEvidence) {
        return res.status(404).json({ message: 'La factura no tiene una foto de entrega.' });
      }

      const legacyEvidence = invoice.deliveryEvidence.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
      if (legacyEvidence) {
        res.set('Cache-Control', 'private, no-store');
        return res.type(`image/${legacyEvidence[1]}`).send(Buffer.from(legacyEvidence[2], 'base64'));
      }

      const filePath = imageStorage.getStoredImagePath('invoices', invoice.deliveryEvidence);
      if (!filePath) {
        return res.status(404).json({ message: 'No se encontró el archivo de la foto.' });
      }
      await fs.access(filePath);
      res.set('Cache-Control', 'private, no-store');
      return res.type('image/webp').sendFile(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ message: 'No se encontró el archivo de la foto.' });
      }
      console.error('Could not read invoice delivery evidence:', error);
      return res.status(500).json({ message: 'No se pudo cargar la foto de entrega.' });
    }
  }

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
      const invoice = await InvoiceService.createInvoice(invoiceData, req.body.items, req.user.role);
      const io = req.app.get('io');

      emitNotification(io, buildInvoiceStatusNotification({
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
      const { status, userId, customerId, limit = 10, offset = 0 } = req.query;
      const filters = {};
      const requestedStatus = typeof status === 'string' ? status : undefined;

      if (customerId !== undefined) {
        const parsedCustomerId = Number(customerId);
        if (!Number.isInteger(parsedCustomerId) || parsedCustomerId <= 0) {
          return res.status(400).json({ message: 'customerId must be a positive integer' });
        }
        filters.customerId = parsedCustomerId;
      }

      // Si no es admin, filtrar solo por sus propias facturas
      if (req.user.role !== 'admin') {
        filters.userId = req.user.id;
      } else if (userId) {
        // Si es admin y se solicita específicamente un userId, usarlo
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

      const [invoices, totalCount] = await Promise.all([
        InvoiceService.getInvoices(filters, parseInt(limit, 10), parseInt(offset, 10)),
        InvoiceService.countInvoices(filters),
      ]);
      res.json({ invoices, totalCount });
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
        emitNotification(io, buildInvoiceStatusNotification({
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
      const recipient = String(email || invoice.customerEmail || '').trim();

      if (!recipient) {
        return res.status(400).json({ message: 'El cliente no tiene un correo registrado. Ingresa un correo para enviar la factura.' });
      }

      if (recipient.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        return res.status(400).json({ message: 'La dirección de correo del cliente no es válida.' });
      }

      const documentLabel = invoice.documentType === 'sales_note' ? 'Nota de venta' : 'Factura';
      await mailer.sendMail({
        to: recipient,
        subject: `${documentLabel} ${invoice.invoiceNumber} - DIUR SYSTEM`,
        text: `${documentLabel} ${invoice.invoiceNumber}\nCliente: ${invoice.customerName || 'Consumidor final'}\nTotal: $${Number(invoice.total || 0).toFixed(2)}\nAdjuntamos el detalle de su comprobante en este correo.`,
        html: buildInvoiceEmailHtml(invoice),
      });

      if (invoice.customer && email && invoice.customer.email !== recipient) {
        await invoice.customer.update({ email: recipient });
      }

      const updatedInvoice = await InvoiceService.markInvoiceEmailSent(id, recipient);

      res.json({
        message: `Factura enviada correctamente a ${recipient}.`,
        invoice: updatedInvoice,
      });
    } catch (error) {
      const status = error.code === 'EMAIL_CONFIG_MISSING' ? 503
        : error.code === 'EMAIL_DELIVERY_FAILED' ? 502
          : 400;
      res.status(status).json({ message: error.message || 'No se pudo enviar el correo.' });
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

      emitNotification(io, buildInvoiceStatusNotification({
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

  /**
   * Crea una cuenta por cobrar retroactivamente para una factura existente
   * POST /invoices/:id/create-ar
   */
  async createAccountsReceivable(req, res) {
    try {
      const { id } = req.params;
      const invoice = await InvoiceService.getInvoiceById(id);

      if (!invoice.customerId) {
        return res.status(400).json({ message: 'La factura no tiene cliente asignado' });
      }

      const ar = await InvoiceService.createAccountReceivable(
        invoice.id,
        invoice.customerId,
        invoice.total
      );

      res.json({
        message: 'Cuenta por cobrar creada exitosamente',
        accountsReceivable: ar,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new InvoiceController();