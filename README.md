# Discord Appointment Bot

A Discord bot that monitors appointment availability across multiple websites for different users. The bot automatically checks for appointments, sends notifications when found, and securely stores credentials using AES-256 encryption.

## Features

- **Multi-User Support**: Each user manages their own monitored sites
- **Secure Credential Storage**: AES-256 encryption for login credentials
- **Automated Monitoring**: Checks every 5 minutes for new appointments
- **Rich Notifications**: Discord embeds with appointment details
- **Multiple Site Types**: Support for generic and government websites
- **Cloud Deployment**: Optimized for Railway.app hosting

## Commands

- `/register` - Register with the bot
- `/add-site` - Add a website to monitor
- `/list-sites` - Show all your monitored sites
- `/check-now` - Force immediate check for a specific site
- `/remove-site` - Remove a site from monitoring
- `/status` - Show your monitoring status and statistics

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Discord bot token and client ID
- Railway.app account (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd discord-appointment-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. **Set up the database**
   - Create a PostgreSQL database
   - Update DATABASE_URL in .env

5. **Deploy Discord commands**
   ```bash
   node scripts/deploy-commands.js
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

## Environment Variables

Create a `.env` file with the following variables:

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DATABASE_URL=postgresql://username:password@host:port/database
ENCRYPTION_KEY=your_32_character_encryption_key_here
NODE_ENV=production
```

### Required Setup

1. **Discord Bot Setup**
   - Go to https://discord.com/developers/applications
   - Create a new application
   - Go to "Bot" section and create a bot
   - Copy the token to `DISCORD_TOKEN`
   - Copy the application ID to `DISCORD_CLIENT_ID`
   - Enable necessary intents (Guilds, Guild Messages)

2. **Database Setup**
   - Create a PostgreSQL database
   - Update `DATABASE_URL` with your connection string

3. **Encryption Key**
   - Generate a 32-character hex key for `ENCRYPTION_KEY`
   - You can use: `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`

## Railway Deployment

### Step 1: Prepare Repository

1. Push your code to GitHub
2. Ensure all environment variables are set in `.env.example`

### Step 2: Deploy to Railway

1. Go to [Railway.app](https://railway.app)
2. Create a new project
3. Connect your GitHub repository
4. Add a PostgreSQL database service
5. Set environment variables in Railway dashboard:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DATABASE_URL` (automatically set by Railway PostgreSQL)
   - `ENCRYPTION_KEY`
   - `NODE_ENV=production`

### Step 3: Configure Railway

Railway will automatically detect the `railway.toml` configuration and deploy using Nixpacks.

## Security Features

- **AES-256 Encryption**: All user credentials are encrypted before storage
- **Secure Environment**: No credentials logged or exposed
- **User Isolation**: Each user's data is completely separate
- **Input Validation**: All user inputs are validated and sanitized

## Architecture

```
src/
├── bot.js              # Main application entry point
├── config/
│   └── database.js     # Database configuration
├── models/
│   ├── User.js         # User model
│   ├── MonitoredSite.js # Monitored site model
│   └── Appointment.js   # Appointment model
├── commands/
│   ├── register.js     # User registration
│   ├── add-site.js     # Add monitoring site
│   ├── list-sites.js   # List user sites
│   ├── check-now.js    # Manual site check
│   ├── remove-site.js  # Remove site
│   └── status.js       # User status
├── services/
│   ├── WebScraperService.js    # Web scraping logic
│   ├── NotificationService.js  # Discord notifications
│   └── AppointmentService.js   # Appointment management
└── utils/
    ├── encryption.js   # AES encryption utilities
    └── logger.js       # Winston logging
```

## Database Schema

### Users Table
- `discord_id` (Primary Key)
- `username`
- `notification_preferences` (JSON)
- `is_active`
- `created_at`, `updated_at`

### MonitoredSites Table
- `id` (Auto-increment Primary Key)
- `user_discord_id` (Foreign Key)
- `website_url`
- `site_type` (generic/government)
- `encrypted_credentials` (AES-256 encrypted)
- `check_interval` (minutes)
- `last_checked`
- `is_active`
- `created_at`, `updated_at`

### Appointments Table
- `id` (Auto-increment Primary Key)
- `monitored_site_id` (Foreign Key)
- `appointment_date`
- `appointment_details` (JSON)
- `is_available`
- `notified`
- `found_at`
- `created_at`, `updated_at`

## How It Works

1. **Registration**: Users register with `/register` command
2. **Add Sites**: Users add websites to monitor with `/add-site`
3. **Encryption**: Login credentials are encrypted and stored securely
4. **Monitoring**: Bot checks sites every 5 minutes using Puppeteer
5. **Detection**: Web scraper looks for appointment availability
6. **Notification**: Users receive Discord DMs when appointments are found
7. **Management**: Users can manage their monitored sites with various commands

## Web Scraping Strategy

The bot uses Puppeteer to:
- Navigate to websites with realistic browser behavior
- Handle different site types (generic vs government)
- Login automatically using stored credentials
- Parse appointment availability using multiple selectors
- Handle errors gracefully and retry when needed

## Monitoring & Logging

- **Winston Logging**: Structured logging with multiple transports
- **Error Handling**: Comprehensive error handling and recovery
- **Performance Monitoring**: Track success rates and response times
- **Health Checks**: Railway health checks for uptime monitoring

## Cost Optimization

- **Efficient Scheduling**: Only checks sites when needed
- **Browser Reuse**: Reuses browser instances when possible
- **Database Optimization**: Indexes and efficient queries
- **Memory Management**: Proper cleanup of resources

## Troubleshooting

### Common Issues

1. **Puppeteer fails to launch**
   - Check Chrome/Chromium installation
   - Verify environment variables
   - Check Railway logs for specific errors

2. **Database connection fails**
   - Verify DATABASE_URL format
   - Check PostgreSQL service status
   - Ensure database exists

3. **Discord commands not working**
   - Verify bot token and client ID
   - Check bot permissions in Discord
   - Ensure commands are deployed

### Debugging

1. **Check logs**
   ```bash
   # Local development
   tail -f logs/combined.log
   
   # Railway deployment
   railway logs
   ```

2. **Test individual components**
   - Use `/check-now` to test web scraping
   - Use `/register` to test database connection
   - Check Discord bot permissions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Railway logs for deployment issues
3. Check Discord bot permissions
4. Verify environment variables are set correctly

## Security Notes

- Never commit `.env` files
- Use strong encryption keys
- Regularly rotate credentials
- Monitor for suspicious activity
- Keep dependencies updated