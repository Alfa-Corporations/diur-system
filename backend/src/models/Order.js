const { DataTypes } = require('sequelize');
const db = require('../utils/database');

/**
 * Modelo de Pedido
 * Define la estructura de la tabla 'orders' en la base de datos.
 * Incluye campos para detalles del pedido, estado y asignación.
 */
const Order = db.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  type: {
    type: DataTypes.ENUM('compra', 'venta', 'venta al mayor'),
    allowNull: false,
    defaultValue: 'venta',
  },
  status: {
    type: DataTypes.ENUM('pendiente', 'parcial', 'completado', 'cancelado'),
    allowNull: false,
    defaultValue: 'pendiente',
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  supplierId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'suppliers',
      key: 'id'
    }
  },
  customerAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  deliveryUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
}, {
  timestamps: true,
  tableName: 'orders',
});

module.exports = Order;