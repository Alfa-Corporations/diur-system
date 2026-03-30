const { DataTypes } = require('sequelize');
const db = require('../utils/database');

/**
 * Modelo de Factura
 * Define la estructura de la tabla 'invoices' en la base de datos.
 * Incluye campos para detalles de la factura, totales y estado.
 */
const Invoice = db.define('Invoice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'card', 'check', 'transfer', 'other'),
    allowNull: true,
  },
  paymentReference: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  amountReceived: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  changeAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customerEmail: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'invoices',
});

module.exports = Invoice;