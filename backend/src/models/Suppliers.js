const { DataTypes } = require('sequelize');
const db = require('../utils/database');

const Supplier = db.define('Supplier', {
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

  ruc: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  contactName: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }

}, {
  tableName: 'suppliers',
  timestamps: true,
});

module.exports = Supplier;