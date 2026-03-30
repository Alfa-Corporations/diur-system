const { DataTypes } = require('sequelize');
const db = require('../utils/database');

/**
 * Modelo de Item de Factura
 * Define la estructura de la tabla 'invoice_items' en la base de datos.
 * Relaciona productos con facturas, incluyendo cantidad y precio.
 */
const InvoiceItem = db.define('InvoiceItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  invoiceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'invoices',
      key: 'id',
    },
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id',
    },
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
}, {
  timestamps: true,
  tableName: 'invoice_items',
});

module.exports = InvoiceItem;