const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const MonitoredSite = require('../models/MonitoredSite');
const AppointmentService = require('../services/AppointmentService');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check-now')
    .setDescription('Force an immediate check for a specific site')
    .addIntegerOption(option =>
      option.setName('site-id')
        .setDescription('The ID of the site to check')
        .setRequired(true)
    ),
  
  async execute(interaction) {
    try {
      const user = await User.findOne({ where: { discord_id: interaction.user.id } });
      
      if (!user) {
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('L Not Registered')
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
          .setTitle('L Site Not Found')
          .setDescription(`No site found with ID ${siteId}. Use \`/list-sites\` to see your monitored sites.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (!site.is_active) {
        const embed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('  Site Inactive')
          .setDescription('This site is currently inactive. Please contact support if you need to reactivate it.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const checkingEmbed = new EmbedBuilder()
        .setColor('#FFFF00')
        .setTitle('= Checking Site...')
        .setDescription(`Checking appointments for site ${siteId}. This may take a few moments...`)
        .addFields({ name: '< Website', value: site.website_url, inline: false })
        .setTimestamp();

      await interaction.editReply({ embeds: [checkingEmbed] });

      const result = await AppointmentService.checkSite(site);

      let resultEmbed;
      if (result.success) {
        resultEmbed = new EmbedBuilder()
          .setColor(result.appointmentsFound > 0 ? '#00FF00' : '#0099FF')
          .setTitle(result.appointmentsFound > 0 ? '<‰ Appointments Found!' : ' Check Complete - No Appointments')
          .setDescription(
            result.appointmentsFound > 0 
              ? `Found ${result.appointmentsFound} available appointment${result.appointmentsFound === 1 ? '' : 's'}!`
              : 'No appointments are currently available.'
          )
          .addFields(
            { name: '< Website', value: site.website_url, inline: false },
            { name: '=Ê Result', value: result.message, inline: false },
            { name: '=R Checked At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
          )
          .setTimestamp();

        if (result.appointmentsFound > 0 && result.appointments) {
          result.appointments.forEach((appointment, index) => {
            if (index < 3) {
              resultEmbed.addFields({
                name: `=Å Appointment ${index + 1}`,
                value: `**Date:** ${appointment.date}\n**Details:** ${appointment.details || 'No additional details'}`,
                inline: true
              });
            }
          });
        }
      } else {
        resultEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('L Check Failed')
          .setDescription('Unable to check the website for appointments.')
          .addFields(
            { name: '< Website', value: site.website_url, inline: false },
            { name: 'L Error', value: result.error || 'Unknown error occurred', inline: false },
            { name: '=R Attempted At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
          )
          .setTimestamp();
      }

      await interaction.editReply({ embeds: [resultEmbed] });
      
      logger.info(`User ${interaction.user.username} (${interaction.user.id}) manually checked site ${siteId}: ${result.success ? 'success' : 'failed'}`);
    } catch (error) {
      logger.error('Error in check-now command:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('L Check Failed')
        .setDescription('An error occurred while checking the website. Please try again later.')
        .setTimestamp();

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }
};