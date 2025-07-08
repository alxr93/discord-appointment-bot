const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

const sequelize = require('./config/database');
const User = require('./models/User');
const MonitoredSite = require('./models/MonitoredSite');
const Appointment = require('./models/Appointment');
const logger = require('./utils/logger');
const AppointmentService = require('./services/AppointmentService');
const NotificationService = require('./services/NotificationService');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.commands = new Collection();

async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      logger.info(`Loaded command: ${command.data.name}`);
    } else {
      logger.warn(`Command at ${filePath} is missing "data" or "execute" property`);
    }
  }
}

async function deployCommands() {
  const commands = [];
  client.commands.forEach(command => {
    commands.push(command.data.toJSON());
  });

  const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

  try {
    logger.info('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    logger.info('Successfully reloaded application (/) commands.');
  } catch (error) {
    logger.error('Error deploying commands:', error);
  }
}

async function setupDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');
    
    User.hasMany(MonitoredSite, { foreignKey: 'user_discord_id' });
    MonitoredSite.belongsTo(User, { foreignKey: 'user_discord_id' });
    MonitoredSite.hasMany(Appointment, { foreignKey: 'monitored_site_id' });
    Appointment.belongsTo(MonitoredSite, { foreignKey: 'monitored_site_id' });
    
    await sequelize.sync({ alter: true });
    logger.info('Database synchronized successfully.');
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    process.exit(1);
  }
}

client.once('ready', async () => {
  logger.info(`Logged in as ${client.user.tag}!`);
  
  NotificationService.setClient(client);
  
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Running scheduled appointment checks...');
    try {
      await AppointmentService.checkAllSites();
    } catch (error) {
      logger.error('Error in scheduled appointment check:', error);
    }
  });
  
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running daily cleanup...');
    try {
      await AppointmentService.cleanupOldAppointments();
    } catch (error) {
      logger.error('Error in daily cleanup:', error);
    }
  });
  
  logger.info('Bot is ready and scheduled tasks are running!');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    logger.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error('Error executing command:', error);
    
    const errorMessage = {
      content: 'There was an error while executing this command!',
      ephemeral: true
    };
    
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

async function startBot() {
  try {
    await setupDatabase();
    await loadCommands();
    await deployCommands();
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    logger.error('Error starting bot:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

startBot();