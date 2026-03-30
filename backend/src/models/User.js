const { DataTypes } = require('sequelize');
const db = require('../utils/database');

/**
 * Modelo de Usuario
 * Define la estructura de la tabla 'users' en la base de datos.
 * Incluye campos para autenticación, roles y timestamps.
 */
const User = db.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('admin', 'cashier', 'warehouse', 'delivery'),
    allowNull: false,
    defaultValue: 'cashier',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  timestamps: true,
  tableName: 'users',
});

module.exports = User;