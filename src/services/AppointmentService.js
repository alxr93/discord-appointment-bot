const MonitoredSite = require('../models/MonitoredSite');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const WebScraperService = require('./WebScraperService');
const NotificationService = require('./NotificationService');
const logger = require('../utils/logger');

class AppointmentService {
  constructor() {
    this.activeChecks = new Map();
  }

  async checkAllSites() {
    try {
      logger.info('Starting scheduled appointment check for all active sites');
      
      const sites = await MonitoredSite.findAll({
        where: {
          is_active: true,
          last_checked: {
            [require('sequelize').Op.or]: [
              { [require('sequelize').Op.is]: null },
              { [require('sequelize').Op.lt]: new Date(Date.now() - 5 * 60 * 1000) }
            ]
          }
        },
        include: [User]
      });

      logger.info(`Found ${sites.length} sites to check`);

      const checkPromises = sites.map(site => this.checkSite(site));
      const results = await Promise.allSettled(checkPromises);

      let successCount = 0;
      let errorCount = 0;
      let appointmentsFound = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
          if (result.value.appointmentsFound > 0) {
            appointmentsFound += result.value.appointmentsFound;
          }
        } else {
          errorCount++;
          logger.error(`Error checking site ${sites[index].id}:`, result.reason);
        }
      });

      logger.info(`Completed scheduled check: ${successCount} successful, ${errorCount} errors, ${appointmentsFound} appointments found`);
      
      return {
        totalSites: sites.length,
        successCount,
        errorCount,
        appointmentsFound
      };
    } catch (error) {
      logger.error('Error in checkAllSites:', error);
      throw error;
    }
  }

  async checkSite(site) {
    try {
      if (this.activeChecks.has(site.id)) {
        logger.warn(`Site ${site.id} is already being checked, skipping`);
        return { success: false, message: 'Check already in progress' };
      }

      this.activeChecks.set(site.id, Date.now());
      logger.info(`Checking site ${site.id}: ${site.website_url}`);

      const result = await WebScraperService.checkAppointments(site);
      
      await site.update({ last_checked: new Date() });

      if (result.success && result.appointments.length > 0) {
        logger.info(`Found ${result.appointments.length} appointments for site ${site.id}`);
        
        const newAppointments = [];
        for (const appointment of result.appointments) {
          const [apt, created] = await Appointment.findOrCreate({
            where: {
              monitored_site_id: site.id,
              appointment_date: this.parseAppointmentDate(appointment.date)
            },
            defaults: {
              monitored_site_id: site.id,
              appointment_date: this.parseAppointmentDate(appointment.date),
              appointment_details: {
                time: appointment.time,
                details: appointment.details,
                originalText: appointment.date
              },
              is_available: true,
              notified: false
            }
          });

          if (created) {
            newAppointments.push(apt);
          }
        }

        if (newAppointments.length > 0) {
          logger.info(`Created ${newAppointments.length} new appointment records for site ${site.id}`);
          
          const user = await User.findOne({ where: { discord_id: site.user_discord_id } });
          if (user && user.notification_preferences.immediate) {
            await NotificationService.sendAppointmentNotification(user, site, newAppointments);
          }
        }

        return {
          success: true,
          appointments: result.appointments,
          appointmentsFound: result.appointments.length,
          newAppointments: newAppointments.length,
          message: `Found ${result.appointments.length} appointments (${newAppointments.length} new)`
        };
      } else {
        logger.info(`No appointments found for site ${site.id}`);
        return {
          success: result.success,
          appointments: [],
          appointmentsFound: 0,
          newAppointments: 0,
          message: result.message || 'No appointments found',
          error: result.error
        };
      }
    } catch (error) {
      logger.error(`Error checking site ${site.id}:`, error);
      return {
        success: false,
        appointments: [],
        appointmentsFound: 0,
        newAppointments: 0,
        message: 'Error occurred during check',
        error: error.message
      };
    } finally {
      this.activeChecks.delete(site.id);
    }
  }

  parseAppointmentDate(dateString) {
    try {
      if (!dateString || dateString.toLowerCase() === 'available') {
        return new Date();
      }

      const cleanedDate = dateString.replace(/[^\d\/\-\s:]/g, '');
      
      const datePatterns = [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
        /(\d{1,2})-(\d{1,2})-(\d{4})/,
        /(\d{4})-(\d{1,2})-(\d{1,2})/,
        /(\d{1,2})\/(\d{1,2})/
      ];

      for (const pattern of datePatterns) {
        const match = cleanedDate.match(pattern);
        if (match) {
          let year, month, day;
          
          if (pattern.source.includes('(\\d{4})')) {
            if (pattern.source.indexOf('(\\d{4})') < pattern.source.indexOf('(\\d{1,2})')) {
              [, year, month, day] = match;
            } else {
              [, month, day, year] = match;
            }
          } else {
            [, month, day] = match;
            year = new Date().getFullYear();
          }

          const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
          }
        }
      }

      const parsedDate = new Date(dateString);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }

      logger.warn(`Could not parse date: ${dateString}, using current date`);
      return new Date();
    } catch (error) {
      logger.error(`Error parsing date ${dateString}:`, error);
      return new Date();
    }
  }

  async getAppointmentStats(userId) {
    try {
      const sites = await MonitoredSite.findAll({
        where: { user_discord_id: userId },
        include: [Appointment]
      });

      const stats = {
        totalSites: sites.length,
        activeSites: sites.filter(s => s.is_active).length,
        totalAppointments: 0,
        availableAppointments: 0,
        recentAppointments: []
      };

      for (const site of sites) {
        stats.totalAppointments += site.Appointments.length;
        stats.availableAppointments += site.Appointments.filter(a => a.is_available).length;
      }

      const recentAppointments = await Appointment.findAll({
        where: { is_available: true },
        include: [{
          model: MonitoredSite,
          where: { user_discord_id: userId }
        }],
        order: [['found_at', 'DESC']],
        limit: 5
      });

      stats.recentAppointments = recentAppointments;

      return stats;
    } catch (error) {
      logger.error('Error getting appointment stats:', error);
      throw error;
    }
  }

  async markAppointmentUnavailable(appointmentId) {
    try {
      const appointment = await Appointment.findByPk(appointmentId);
      if (appointment) {
        await appointment.update({ is_available: false });
        logger.info(`Marked appointment ${appointmentId} as unavailable`);
      }
    } catch (error) {
      logger.error(`Error marking appointment ${appointmentId} as unavailable:`, error);
    }
  }

  async cleanupOldAppointments() {
    try {
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const deletedCount = await Appointment.destroy({
        where: {
          appointment_date: {
            [require('sequelize').Op.lt]: cutoffDate
          }
        }
      });

      logger.info(`Cleaned up ${deletedCount} old appointments`);
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up old appointments:', error);
      throw error;
    }
  }
}

module.exports = new AppointmentService();