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
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'customers',
      key: 'id',
    },
  },
  documentType: {
    type: DataTypes.ENUM('consumer_final', 'sales_note', 'sri_invoice'),
    allowNull: false,
    defaultValue: 'consumer_final',
  },
  sriStatus: {
    type: DataTypes.ENUM('not_applicable', 'pending', 'authorized', 'rejected'),
    allowNull: false,
    defaultValue: 'not_applicable',
  },
  sriAuthorizationNumber: {
    type: DataTypes.STRING,
    allowNull: true,
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
    type: DataTypes.ENUM('cash', 'card', 'check', 'transfer', 'credit', 'other'),
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
  customerPhone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customerIdentificationType: {
    type: DataTypes.ENUM('none', 'cedula', 'ruc', 'passport'),
    allowNull: false,
    defaultValue: 'none',
  },
  customerIdentification: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  customerAddress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  emailSentAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'invoices',
});

module.exports = Invoice;