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
    type: DataTypes.ENUM('purchase', 'sale'),
    allowNull: false,
    defaultValue: 'sale',
  },
  status: {
    type: DataTypes.ENUM('pending', 'partial', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: true,
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