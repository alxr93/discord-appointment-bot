const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class WebScraperService {
  constructor() {
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });
    }
    return this.browser;
  }

  async checkAppointments(site) {
    const browser = await this.initBrowser();
    const page = await browser.newPage();
    
    try {
      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Navigate to site
      await page.goto(site.websiteUrl, { waitUntil: 'networkidle2' });
      
      // Login based on site type
      const appointments = await this.loginAndCheckAppointments(page, site);
      
      return appointments;
    } catch (error) {
      logger.error(`Error checking appointments for site ${site.id}:`, error);
      return [];
    } finally {
      await page.close();
    }
  }

  async loginAndCheckAppointments(page, site) {
    const { username, password } = require('../utils/encryption').decryptCredentials(site.encryptedCredentials);
    
    switch (site.siteType) {
      case 'generic':
        return await this.handleGenericSite(page, username, password);
      case 'government':
        return await this.handleGovernmentSite(page, username, password);
      default:
        throw new Error(`Unsupported site type: ${site.siteType}`);
    }
  }

  async handleGenericSite(page, username, password) {
    // Generic implementation - customize based on actual sites
    try {
      // Look for common login selectors
      const usernameSelector = 'input[name="username"], input[name="email"], input[type="email"]';
      const passwordSelector = 'input[name="password"], input[type="password"]';
      const submitSelector = 'button[type="submit"], input[type="submit"]';
      
      await page.waitForSelector(usernameSelector, { timeout: 5000 });
      await page.type(usernameSelector, username);
      await page.type(passwordSelector, password);
      await page.click(submitSelector);
      
      // Wait for navigation after login
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
      
      // Look for appointment elements
      const appointments = await page.evaluate(() => {
        const appointmentElements = document.querySelectorAll('[data-appointment], .appointment, .available-slot');
        return Array.from(appointmentElements).map(el => ({
          date: el.dataset.date || el.textContent.trim(),
          available: !el.classList.contains('unavailable') && !el.classList.contains('booked')
        }));
      });
      
      return appointments.filter(apt => apt.available);
    } catch (error) {
      logger.error('Error in generic site handler:', error);
      return [];
    }
  }

  async handleGovernmentSite(page, username, password) {
    // Government site implementation
    // This would be customized for specific government appointment systems
    return [];
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = new WebScraperService();