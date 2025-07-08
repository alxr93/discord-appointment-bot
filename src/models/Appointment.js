const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Appointment = sequelize.define('Appointment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  monitored_site_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'monitored_sites',
      key: 'id'
    }
  },
  appointment_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  appointment_details: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  is_available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  found_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'appointments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Appointment;