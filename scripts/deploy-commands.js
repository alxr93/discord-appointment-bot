const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, '../src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
    console.log(`Loaded command: ${command.data.name}`);
  } else {
    console.warn(`Command at ${filePath} is missing "data" or "execute" property`);
  }
}

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );
    
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
})();