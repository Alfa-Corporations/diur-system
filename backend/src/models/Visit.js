const { DataTypes } = require('sequelize');
const db = require('../utils/database');

const Visit = db.define('Visit', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'customers', key: 'id' },
  },
  visitDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  arrivalAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  departureAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  durationSeconds: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },
  street: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  province: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  timestamps: true,
  tableName: 'visits',
});

module.exports = Visit;
