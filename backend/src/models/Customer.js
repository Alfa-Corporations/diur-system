const { DataTypes } = require('sequelize');
const db = require('../utils/database');

/**
 * Modelo de Cliente
 * Permite asociar múltiples facturas a un mismo cliente.
 */
const Customer = db.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true,
    },
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  identificationType: {
    type: DataTypes.ENUM('none', 'cedula', 'ruc', 'passport'),
    allowNull: false,
    defaultValue: 'none',
  },
  identificationNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isFinalConsumer: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  timestamps: true,
  tableName: 'customers',
});

module.exports = Customer;
