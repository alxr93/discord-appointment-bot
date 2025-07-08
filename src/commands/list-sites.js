const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const MonitoredSite = require('../models/MonitoredSite');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-sites')
    .setDescription('Show all your monitored websites'),
  
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

      const sites = await MonitoredSite.findAll({
        where: { user_discord_id: interaction.user.id },
        order: [['created_at', 'DESC']]
      });

      if (sites.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('=Ë No Monitored Sites')
          .setDescription('You haven\'t added any websites to monitor yet. Use `/add-site` to get started!')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle('=Ë Your Monitored Sites')
        .setDescription(`You have ${sites.length} site${sites.length === 1 ? '' : 's'} being monitored:`)
        .setTimestamp();

      sites.forEach((site, index) => {
        try {
          const credentials = decrypt(site.encrypted_credentials);
          const statusIcon = site.is_active ? '' : 'L';
          const lastChecked = site.last_checked 
            ? `<t:${Math.floor(new Date(site.last_checked).getTime() / 1000)}:R>`
            : 'Never';

          embed.addFields({
            name: `${statusIcon} Site ${site.id} - ${site.site_type.toUpperCase()}`,
            value: `**URL:** ${site.website_url}\n**Username:** ${credentials.username}\n**Interval:** ${site.check_interval}min\n**Last Check:** ${lastChecked}`,
            inline: false
          });
        } catch (error) {
          logger.error(`Error decrypting credentials for site ${site.id}:`, error);
          embed.addFields({
            name: `L Site ${site.id} - ERROR`,
            value: `**URL:** ${site.website_url}\n**Status:** Credentials error - please re-add this site`,
            inline: false
          });
        }
      });

      embed.setFooter({ text: 'Use /check-now [site-id] to test a specific site' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      
      logger.info(`User ${interaction.user.username} (${interaction.user.id}) listed ${sites.length} sites`);
    } catch (error) {
      logger.error('Error in list-sites command:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('L Failed to List Sites')
        .setDescription('An error occurred while fetching your monitored sites. Please try again later.')
        .setTimestamp();

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};