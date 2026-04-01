const { DataTypes } = require('sequelize');
const db = require('../utils/database');

/**
 * Modelo de Usuario-Permiso
 * Define la relación muchos-a-muchos entre usuarios y permisos.
 */
const UserPermission = db.define('UserPermission', {
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
  permissionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'permissions',
      key: 'id',
    },
  },
}, {
  timestamps: true,
  tableName: 'user_permissions',
});

module.exports = UserPermission;