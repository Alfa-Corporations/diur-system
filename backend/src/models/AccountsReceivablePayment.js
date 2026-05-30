const { DataTypes } = require('sequelize');
const db = require('../utils/database');

/**
 * Registro de abonos a cuentas por cobrar
 */
const AccountsReceivablePayment = db.define('AccountsReceivablePayment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  accountsReceivableId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'accounts_receivable', key: 'id' }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: true
  },
  paymentReference: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: false,
  tableName: 'accounts_receivable_payments'
});

module.exports = AccountsReceivablePayment;
