const { DataTypes } = require('sequelize');
const db = require('../utils/database');

const PushSubscription = db.define('PushSubscription', {
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
    onDelete: 'CASCADE',
  },
  endpoint: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true,
  },
  subscription: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
}, {
  timestamps: true,
  tableName: 'push_subscriptions',
});

module.exports = PushSubscription;
