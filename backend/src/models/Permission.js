const { DataTypes } = require('sequelize');
const db = require('../utils/database');

/**
 * Modelo de Permiso
 * Define la estructura de la tabla 'permissions' en la base de datos.
 * Permite permisos granulares para RBAC dinámico.
 */
const Permission = db.define('Permission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'permissions',
});

module.exports = Permission;