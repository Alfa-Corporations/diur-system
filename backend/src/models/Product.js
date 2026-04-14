const { DataTypes } = require('sequelize');
const db = require('../utils/database');

/**
 * Modelo de Producto (estructura completa tipo ERP)
 */
const Product = db.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },

  interno: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  partnumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  brand: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  categoria: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0,
  },

  pricecaja: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },

  priceb: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },

  costiva: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },

  util: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },

  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },

  piezas: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  importacion: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },

  grupo: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  supplierId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'suppliers',
      key: 'id'
    }
  },

  costlast: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },

  costavg: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },

  iva: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: true,
  },

  isservice: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },

  esnota: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },

  gasto: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },

  baja: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: false,
  },

  idbrand: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  ubicacion: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  foto: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  codigo2: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  codigo3: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  codigo4: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  modelo: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  porcentaje: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },

}, {
  tableName: 'products',
  timestamps: true,
});

module.exports = Product;