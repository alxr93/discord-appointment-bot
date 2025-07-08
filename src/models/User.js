const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  discord_id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  notification_preferences: {
    type: DataTypes.JSON,
    defaultValue: {
      immediate: true,
      daily_summary: false,
      weekly_summary: false
    }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = User;