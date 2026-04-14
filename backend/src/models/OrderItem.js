const { DataTypes } = require('sequelize');
const db = require('../utils/database');

/**
 * Modelo de Item de Pedido
 * Define la estructura de la tabla 'order_items' en la base de datos.
 * Cada item tiene cantidad solicitada, procesada y estado individual.
 */
const OrderItem = db.define('OrderItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'orders',
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
  quantityRequested: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  quantityProcessed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('pendiente', 'en_transito', 'en_bodega', 'repartidor', 'facturado'),
    allowNull: false,
    defaultValue: 'pendiente',
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
}, {
  timestamps: true,
  tableName: 'order_items',
});

module.exports = OrderItem;