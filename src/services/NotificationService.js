const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.client = null;
  }

  setClient(client) {
    this.client = client;
    logger.info('Discord client set for NotificationService');
  }

  async sendAppointmentNotification(user, site, appointments) {
    try {
      if (!this.client) {
        logger.error('Discord client not set for NotificationService');
        return false;
      }

      const discordUser = await this.client.users.fetch(user.discord_id);
      if (!discordUser) {
        logger.error(`Could not find Discord user ${user.discord_id}`);
        return false;
      }

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('<‰ New Appointments Available!')
        .setDescription(`Found ${appointments.length} new appointment${appointments.length === 1 ? '' : 's'} for your monitored website!`)
        .addFields(
          { name: '< Website', value: site.website_url, inline: false },
          { name: '=Ë Site Type', value: site.site_type.toUpperCase(), inline: true },
          { name: '<” Site ID', value: site.id.toString(), inline: true },
          { name: '=R Found At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Appointment Monitor Bot' });

      appointments.forEach((appointment, index) => {
        if (index < 5) {
          const appointmentDate = new Date(appointment.appointment_date);
          const details = appointment.appointment_details;
          
          embed.addFields({
            name: `=Å Appointment ${index + 1}`,
            value: `**Date:** ${appointmentDate.toLocaleDateString()}\n**Time:** ${details.time || 'Not specified'}\n**Details:** ${details.details || 'No additional details'}`,
            inline: true
          });
        }
      });

      if (appointments.length > 5) {
        embed.addFields({
          name: '• More Appointments',
          value: `... and ${appointments.length - 5} more appointments available!`,
          inline: false
        });
      }

      embed.addFields({
        name: '= Actions',
        value: `" Use \`/check-now ${site.id}\` to check again\n" Use \`/list-sites\` to see all your sites\n" Use \`/status\` to view your monitoring status`,
        inline: false
      });

      await discordUser.send({ embeds: [embed] });
      
      await appointments.forEach(async (appointment) => {
        await appointment.update({ notified: true });
      });

      logger.info(`Sent appointment notification to user ${user.discord_id} for site ${site.id}`);
      return true;
    } catch (error) {
      logger.error('Error sending appointment notification:', error);
      return false;
    }
  }

  async sendErrorNotification(userId, site, error) {
    try {
      if (!this.client) {
        logger.error('Discord client not set for NotificationService');
        return false;
      }

      const discordUser = await this.client.users.fetch(userId);
      if (!discordUser) {
        logger.error(`Could not find Discord user ${userId}`);
        return false;
      }

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('L Site Check Failed')
        .setDescription('There was an error checking one of your monitored websites.')
        .addFields(
          { name: '< Website', value: site.website_url, inline: false },
          { name: '<” Site ID', value: site.id.toString(), inline: true },
          { name: '=Ë Site Type', value: site.site_type.toUpperCase(), inline: true },
          { name: 'L Error', value: error.message || 'Unknown error', inline: false },
          { name: '=R Failed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Appointment Monitor Bot' });

      embed.addFields({
        name: '=' Suggested Actions',
        value: `" Use \`/check-now ${site.id}\` to test manually\n" Verify your website credentials\n" Check if the website structure has changed\n" Use \`/remove-site ${site.id}\` if no longer needed`,
        inline: false
      });

      await discordUser.send({ embeds: [embed] });
      
      logger.info(`Sent error notification to user ${userId} for site ${site.id}`);
      return true;
    } catch (error) {
      logger.error('Error sending error notification:', error);
      return false;
    }
  }

  async sendDailySummary(userId) {
    try {
      if (!this.client) {
        logger.error('Discord client not set for NotificationService');
        return false;
      }

      const discordUser = await this.client.users.fetch(userId);
      if (!discordUser) {
        logger.error(`Could not find Discord user ${userId}`);
        return false;
      }

      const AppointmentService = require('./AppointmentService');
      const stats = await AppointmentService.getAppointmentStats(userId);

      const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('=Ê Daily Monitoring Summary')
        .setDescription('Here\'s your daily appointment monitoring summary:')
        .addFields(
          { name: '< Total Sites', value: stats.totalSites.toString(), inline: true },
          { name: ' Active Sites', value: stats.activeSites.toString(), inline: true },
          { name: '=Å Total Appointments', value: stats.totalAppointments.toString(), inline: true },
          { name: '<¯ Available Appointments', value: stats.availableAppointments.toString(), inline: true },
          { name: '=Ó Summary Date', value: new Date().toLocaleDateString(), inline: true },
          { name: '=È Status', value: stats.activeSites > 0 ? 'Monitoring Active' : 'No Active Sites', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Daily Summary " Appointment Monitor Bot' });

      if (stats.recentAppointments.length > 0) {
        const recentList = stats.recentAppointments.map((apt, index) => {
          const date = new Date(apt.appointment_date);
          return `${index + 1}. **${date.toLocaleDateString()}** - Found recently`;
        }).join('\n');

        embed.addFields({
          name: '<‰ Recent Appointments',
          value: recentList,
          inline: false
        });
      }

      await discordUser.send({ embeds: [embed] });
      
      logger.info(`Sent daily summary to user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error sending daily summary:', error);
      return false;
    }
  }

  async sendWeeklySummary(userId) {
    try {
      if (!this.client) {
        logger.error('Discord client not set for NotificationService');
        return false;
      }

      const discordUser = await this.client.users.fetch(userId);
      if (!discordUser) {
        logger.error(`Could not find Discord user ${userId}`);
        return false;
      }

      const AppointmentService = require('./AppointmentService');
      const stats = await AppointmentService.getAppointmentStats(userId);

      const embed = new EmbedBuilder()
        .setColor('#9932CC')
        .setTitle('=È Weekly Monitoring Summary')
        .setDescription('Here\'s your weekly appointment monitoring summary:')
        .addFields(
          { name: '< Total Sites Monitored', value: stats.totalSites.toString(), inline: true },
          { name: ' Currently Active', value: stats.activeSites.toString(), inline: true },
          { name: '=Å Total Appointments Found', value: stats.totalAppointments.toString(), inline: true },
          { name: '<¯ Still Available', value: stats.availableAppointments.toString(), inline: true },
          { name: '=Ê Week Ending', value: new Date().toLocaleDateString(), inline: true },
          { name: 'P Performance', value: stats.totalAppointments > 0 ? 'Great!' : 'Keep Monitoring', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Weekly Summary " Appointment Monitor Bot' });

      if (stats.recentAppointments.length > 0) {
        embed.addFields({
          name: '<Æ This Week\'s Highlights',
          value: `Found ${stats.recentAppointments.length} appointments this week!`,
          inline: false
        });
      }

      embed.addFields({
        name: '=¡ Tips for Next Week',
        value: `" Use \`/status\` to check your monitoring status\n" Consider adding more sites with \`/add-site\`\n" Review your notification preferences`,
        inline: false
      });

      await discordUser.send({ embeds: [embed] });
      
      logger.info(`Sent weekly summary to user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error sending weekly summary:', error);
      return false;
    }
  }

  async sendSystemStatus(channelId, stats) {
    try {
      if (!this.client) {
        logger.error('Discord client not set for NotificationService');
        return false;
      }

      const channel = await this.client.channels.fetch(channelId);
      if (!channel) {
        logger.error(`Could not find channel ${channelId}`);
        return false;
      }

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('> System Status Update')
        .setDescription('Appointment monitoring system status report:')
        .addFields(
          { name: '=Ê Total Sites Checked', value: stats.totalSites.toString(), inline: true },
          { name: ' Successful Checks', value: stats.successCount.toString(), inline: true },
          { name: 'L Failed Checks', value: stats.errorCount.toString(), inline: true },
          { name: '<¯ Appointments Found', value: stats.appointmentsFound.toString(), inline: true },
          { name: '=R Check Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'System Status " Appointment Monitor Bot' });

      await channel.send({ embeds: [embed] });
      
      logger.info(`Sent system status to channel ${channelId}`);
      return true;
    } catch (error) {
      logger.error('Error sending system status:', error);
      return false;
    }
  }
}

module.exports = new NotificationService();