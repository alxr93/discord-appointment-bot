const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MonitoredSite = sequelize.define('MonitoredSite', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_discord_id: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'users',
      key: 'discord_id'
    }
  },
  website_url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  site_type: {
    type: DataTypes.ENUM('generic', 'government'),
    defaultValue: 'generic'
  },
  encrypted_credentials: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  check_interval: {
    type: DataTypes.INTEGER,
    defaultValue: 30
  },
  last_checked: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'monitored_sites',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = MonitoredSite;