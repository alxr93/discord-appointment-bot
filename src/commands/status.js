const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const MonitoredSite = require('../models/MonitoredSite');
const Appointment = require('../models/Appointment');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show your monitoring status and statistics'),
  
  async execute(interaction) {
    try {
      const user = await User.findOne({ where: { discord_id: interaction.user.id } });
      
      if (!user) {
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Not Registered')
          .setDescription('You need to register first! Use `/register` to get started.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const totalSites = await MonitoredSite.count({
        where: { user_discord_id: interaction.user.id }
      });

      const activeSites = await MonitoredSite.count({
        where: { 
          user_discord_id: interaction.user.id,
          is_active: true
        }
      });

      const totalAppointments = await Appointment.count({
        include: [{
          model: MonitoredSite,
          where: { user_discord_id: interaction.user.id }
        }]
      });

      const availableAppointments = await Appointment.count({
        where: { is_available: true },
        include: [{
          model: MonitoredSite,
          where: { user_discord_id: interaction.user.id }
        }]
      });

      const recentAppointments = await Appointment.findAll({
        where: { is_available: true },
        include: [{
          model: MonitoredSite,
          where: { user_discord_id: interaction.user.id }
        }],
        order: [['found_at', 'DESC']],
        limit: 5
      });

      const lastChecked = await MonitoredSite.findOne({
        where: { 
          user_discord_id: interaction.user.id,
          last_checked: { [require('sequelize').Op.ne]: null }
        },
        order: [['last_checked', 'DESC']]
      });

      const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('📊 Your Monitoring Status')
        .setDescription(`Here's your current monitoring overview, ${interaction.user.username}:`)
        .addFields(
          { name: '🌐 Total Sites', value: totalSites.toString(), inline: true },
          { name: '✅ Active Sites', value: activeSites.toString(), inline: true },
          { name: '📅 Total Appointments Found', value: totalAppointments.toString(), inline: true },
          { name: '🎯 Available Appointments', value: availableAppointments.toString(), inline: true },
          { name: '🔄 Account Status', value: user.is_active ? 'Active' : 'Inactive', inline: true },
          { name: '📧 Notifications', value: user.notification_preferences.immediate ? 'Enabled' : 'Disabled', inline: true }
        )
        .setTimestamp();

      if (lastChecked) {
        embed.addFields({
          name: '🕒 Last Check',
          value: `<t:${Math.floor(new Date(lastChecked.last_checked).getTime() / 1000)}:R>`,
          inline: false
        });
      }

      if (recentAppointments.length > 0) {
        const recentList = recentAppointments.map((apt, index) => {
          const date = new Date(apt.appointment_date);
          const foundAt = new Date(apt.found_at);
          return `${index + 1}. **${date.toLocaleDateString()}** - Found <t:${Math.floor(foundAt.getTime() / 1000)}:R>`;
        }).join('\n');

        embed.addFields({
          name: '🎉 Recent Appointments Found',
          value: recentList,
          inline: false
        });
      }

      if (totalSites === 0) {
        embed.addFields({
          name: '🚀 Getting Started',
          value: 'Use `/add-site` to start monitoring your first website!',
          inline: false
        });
      }

      embed.setFooter({ text: 'Bot checks every 5 minutes for new appointments' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      
      logger.info(`User ${interaction.user.username} (${interaction.user.id}) checked status: ${totalSites} sites, ${availableAppointments} available appointments`);
    } catch (error) {
      logger.error('Error in status command:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Failed to Get Status')
        .setDescription('An error occurred while fetching your status. Please try again later.')
        .setTimestamp();

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};