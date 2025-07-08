const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const MonitoredSite = require('../models/MonitoredSite');
const { encrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-site')
    .setDescription('Add a website to monitor for appointments')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('The website URL to monitor')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Your username for the website')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('password')
        .setDescription('Your password for the website')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of website')
        .setRequired(true)
        .addChoices(
          { name: 'Generic', value: 'generic' },
          { name: 'Government', value: 'government' }
        )
    )
    .addIntegerOption(option =>
      option.setName('interval')
        .setDescription('Check interval in minutes (5-60)')
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(60)
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

      const url = interaction.options.getString('url');
      const username = interaction.options.getString('username');
      const password = interaction.options.getString('password');
      const type = interaction.options.getString('type');
      const interval = interaction.options.getInteger('interval') || 30;

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('L Invalid URL')
          .setDescription('Please provide a valid URL starting with http:// or https://')
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const existingSite = await MonitoredSite.findOne({
        where: {
          user_discord_id: interaction.user.id,
          website_url: url
        }
      });

      if (existingSite) {
        const embed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('  Site Already Monitored')
          .setDescription(`You're already monitoring this website! Use \`/list-sites\` to see all your monitored sites.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const credentials = { username, password };
      const encryptedCredentials = encrypt(credentials);

      const site = await MonitoredSite.create({
        user_discord_id: interaction.user.id,
        website_url: url,
        site_type: type,
        encrypted_credentials: encryptedCredentials,
        check_interval: interval,
        is_active: true
      });

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(' Site Added Successfully!')
        .setDescription(`Your website has been added to the monitoring list.`)
        .addFields(
          { name: '< Website', value: url, inline: false },
          { name: '=d Username', value: username, inline: true },
          { name: '= Password', value: '""""""""', inline: true },
          { name: '=Ë Type', value: type, inline: true },
          { name: 'ð Check Interval', value: `${interval} minutes`, inline: true },
          { name: '<” Site ID', value: site.id.toString(), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Use /check-now to test the site immediately' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      
      logger.info(`User ${interaction.user.username} (${interaction.user.id}) added site: ${url}`);
    } catch (error) {
      logger.error('Error in add-site command:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('L Failed to Add Site')
        .setDescription('An error occurred while adding the website. Please try again later.')
        .setTimestamp();

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};