const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register with the appointment monitoring bot'),
  
  async execute(interaction) {
    try {
      const [user, created] = await User.findOrCreate({
        where: { discord_id: interaction.user.id },
        defaults: {
          discord_id: interaction.user.id,
          username: interaction.user.username,
          notification_preferences: {
            immediate: true,
            daily_summary: false,
            weekly_summary: false
          },
          is_active: true
        }
      });

      const embed = new EmbedBuilder()
        .setColor(created ? '#00FF00' : '#FFA500')
        .setTitle(created ? ' Registration Successful!' : '  Already Registered')
        .setDescription(
          created 
            ? `Welcome ${interaction.user.username}! You've been successfully registered with the appointment monitoring bot.`
            : `You're already registered, ${interaction.user.username}! Use /add-site to start monitoring appointment websites.`
        )
        .addFields(
          { name: '=ç Immediate Notifications', value: user.notification_preferences.immediate ? 'Enabled' : 'Disabled', inline: true },
          { name: '=Å Daily Summary', value: user.notification_preferences.daily_summary ? 'Enabled' : 'Disabled', inline: true },
          { name: '=Ê Weekly Summary', value: user.notification_preferences.weekly_summary ? 'Enabled' : 'Disabled', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Appointment Monitor Bot' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
      
      logger.info(`User ${interaction.user.username} (${interaction.user.id}) ${created ? 'registered' : 'attempted to register again'}`);
    } catch (error) {
      logger.error('Error in register command:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('L Registration Failed')
        .setDescription('An error occurred while registering. Please try again later.')
        .setTimestamp();

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};