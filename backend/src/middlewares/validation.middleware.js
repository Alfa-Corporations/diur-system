/**
 * Middleware de validación
 * Proporciona funciones para validar datos de entrada.
 */

/**
 * Valida datos requeridos
 * @param {Array} requiredFields - Campos requeridos
 */
const validateRequired = (requiredFields) => {
  return (req, res, next) => {
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        message: 'Missing required fields',
        fields: missingFields
      });
    }
    next();
  };
};

/**
 * Valida formato de email
 * @param {string} email - Email a validar
 * @returns {boolean} True si es válido
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida datos de producto
 */
const validateProductData = (req, res, next) => {
  const { name, price, sku } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ message: 'Valid name is required' });
  }

  if (!price || isNaN(price) || price <= 0) {
    return res.status(400).json({ message: 'Valid price is required' });
  }

  if (!sku || typeof sku !== 'string' || sku.trim().length === 0) {
    return res.status(400).json({ message: 'Valid SKU is required' });
  }

  next();
};

/**
 * Valida datos de factura
 */
const validateInvoiceData = (req, res, next) => {
  const { items, documentType = 'consumer_final', customer = {}, customerEmail } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'At least one item is required' });
  }

  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      return res.status(400).json({ message: 'Valid productId and quantity required for each item' });
    }
  }

  if (!['consumer_final', 'sales_note', 'sri_invoice'].includes(documentType)) {
    return res.status(400).json({ message: 'Invalid document type' });
  }

  if ((documentType === 'sales_note' || documentType === 'sri_invoice') && (!customer.name || typeof customer.name !== 'string' || customer.name.trim().length < 3)) {
    return res.status(400).json({ message: 'Customer name is required for notes or future SRI invoices' });
  }

  const emailToValidate = customer.email || customerEmail;
  if (emailToValidate && !isValidEmail(emailToValidate)) {
    return res.status(400).json({ message: 'Invalid customer email format' });
  }

  next();
};

module.exports = {
  validateRequired,
  validateProductData,
  validateInvoiceData,
};