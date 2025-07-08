const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const MonitoredSite = require('../models/MonitoredSite');
const Appointment = require('../models/Appointment');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-site')
    .setDescription('Remove a website from monitoring')
    .addIntegerOption(option =>
      option.setName('site-id')
        .setDescription('The ID of the site to remove')
        .setRequired(true)
    ),
  
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

      const siteId = interaction.options.getInteger('site-id');
      const site = await MonitoredSite.findOne({
        where: {
          id: siteId,
          user_discord_id: interaction.user.id
        }
      });

      if (!site) {
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('❌ Site Not Found')
          .setDescription(`No site found with ID ${siteId}. Use \`/list-sites\` to see your monitored sites.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const appointmentCount = await Appointment.count({
        where: { monitored_site_id: siteId }
      });

      await Appointment.destroy({
        where: { monitored_site_id: siteId }
      });

      await site.destroy();

      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('🗑️ Site Removed Successfully')
        .setDescription(`The website has been removed from monitoring.`)
        .addFields(
          { name: '🌐 Website', value: site.website_url, inline: false },
          { name: '📋 Site Type', value: site.site_type, inline: true },
          { name: '📊 Appointments Deleted', value: appointmentCount.toString(), inline: true },
          { name: '🕒 Removed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'This action cannot be undone' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      
      logger.info(`User ${interaction.user.username} (${interaction.user.id}) removed site ${siteId}: ${site.website_url}`);
    } catch (error) {
      logger.error('Error in remove-site command:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Failed to Remove Site')
        .setDescription('An error occurred while removing the website. Please try again later.')
        .setTimestamp();

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};