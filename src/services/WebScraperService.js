const puppeteer = require('puppeteer');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryption');

class WebScraperService {
  constructor() {
    this.browser = null;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];
  }

  async initBrowser() {
    if (!this.browser) {
      try {
        this.browser = await puppeteer.launch({
          headless: 'new',
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
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
            '--disable-renderer-backgrounding',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ]
        });
        logger.info('Browser initialized successfully');
      } catch (error) {
        logger.error('Error initializing browser:', error);
        throw error;
      }
    }
    return this.browser;
  }

  async checkAppointments(site) {
    const browser = await this.initBrowser();
    const page = await browser.newPage();
    
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      
      const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
      await page.setUserAgent(userAgent);
      
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      });
      
      logger.info(`Navigating to ${site.website_url}`);
      await page.goto(site.website_url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      const appointments = await this.loginAndCheckAppointments(page, site);
      
      return {
        success: true,
        appointments: appointments,
        appointmentsFound: appointments.length,
        message: appointments.length > 0 ? `Found ${appointments.length} available appointments` : 'No appointments available'
      };
    } catch (error) {
      logger.error(`Error checking appointments for site ${site.id}:`, error);
      return {
        success: false,
        appointments: [],
        appointmentsFound: 0,
        message: 'Failed to check appointments',
        error: error.message
      };
    } finally {
      await page.close();
    }
  }

  async loginAndCheckAppointments(page, site) {
    try {
      const credentials = decrypt(site.encrypted_credentials);
      const { username, password } = credentials;
      
      logger.info(`Attempting login for site type: ${site.site_type}`);
      
      switch (site.site_type) {
        case 'generic':
          return await this.handleGenericSite(page, username, password);
        case 'government':
          return await this.handleGovernmentSite(page, username, password);
        default:
          throw new Error(`Unsupported site type: ${site.site_type}`);
      }
    } catch (error) {
      logger.error('Error in loginAndCheckAppointments:', error);
      throw error;
    }
  }

  async handleGenericSite(page, username, password) {
    try {
      logger.info('Handling generic site login');
      
      await page.waitForTimeout(2000);
      
      const loginSelectors = [
        'input[name="username"]',
        'input[name="email"]',
        'input[type="email"]',
        'input[id*="username"]',
        'input[id*="email"]',
        'input[placeholder*="username"]',
        'input[placeholder*="email"]'
      ];
      
      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[id*="password"]',
        'input[placeholder*="password"]'
      ];
      
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Login")',
        'button:contains("Sign In")',
        '.login-button',
        '.submit-button'
      ];
      
      let usernameField = null;
      let passwordField = null;
      
      for (const selector of loginSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          usernameField = selector;
          break;
        } catch (e) {
          continue;
        }
      }
      
      for (const selector of passwordSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          passwordField = selector;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!usernameField || !passwordField) {
        logger.warn('Could not find login fields, attempting to find appointments without login');
        return await this.findAppointments(page);
      }
      
      await page.type(usernameField, username);
      await page.waitForTimeout(1000);
      await page.type(passwordField, password);
      await page.waitForTimeout(1000);
      
      let submitButton = null;
      for (const selector of submitSelectors) {
        try {
          submitButton = await page.$(selector);
          if (submitButton) break;
        } catch (e) {
          continue;
        }
      }
      
      if (submitButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
          submitButton.click()
        ]);
        logger.info('Login attempted, checking for appointments');
      } else {
        logger.warn('Could not find submit button, checking for appointments anyway');
      }
      
      await page.waitForTimeout(3000);
      
      return await this.findAppointments(page);
    } catch (error) {
      logger.error('Error in generic site handler:', error);
      return await this.findAppointments(page);
    }
  }

  async handleGovernmentSite(page, username, password) {
    try {
      logger.info('Handling government site login');
      
      await page.waitForTimeout(3000);
      
      const commonGovSelectors = {
        username: [
          'input[name="username"]',
          'input[name="userId"]',
          'input[name="user_id"]',
          'input[id="username"]',
          'input[id="userId"]',
          'input[id="user_id"]'
        ],
        password: [
          'input[name="password"]',
          'input[type="password"]',
          'input[id="password"]'
        ],
        submit: [
          'button[type="submit"]',
          'input[type="submit"]',
          'button[name="submit"]',
          '.submit-btn',
          '.login-btn'
        ]
      };
      
      let usernameField = null;
      let passwordField = null;
      
      for (const selector of commonGovSelectors.username) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          usernameField = selector;
          break;
        } catch (e) {
          continue;
        }
      }
      
      for (const selector of commonGovSelectors.password) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          passwordField = selector;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (usernameField && passwordField) {
        await page.type(usernameField, username);
        await page.waitForTimeout(1000);
        await page.type(passwordField, password);
        await page.waitForTimeout(1000);
        
        let submitButton = null;
        for (const selector of commonGovSelectors.submit) {
          try {
            submitButton = await page.$(selector);
            if (submitButton) break;
          } catch (e) {
            continue;
          }
        }
        
        if (submitButton) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
            submitButton.click()
          ]);
        }
      }
      
      await page.waitForTimeout(3000);
      
      return await this.findAppointments(page);
    } catch (error) {
      logger.error('Error in government site handler:', error);
      return await this.findAppointments(page);
    }
  }

  async findAppointments(page) {
    try {
      logger.info('Searching for appointments on page');
      
      const appointments = await page.evaluate(() => {
        const appointmentSelectors = [
          '[data-appointment]',
          '.appointment',
          '.available-slot',
          '.slot',
          '.booking-slot',
          '.time-slot',
          '.available',
          '.appointment-slot',
          '.calendar-slot',
          '.schedule-slot'
        ];
        
        const dateSelectors = [
          '.date',
          '.day',
          '.appointment-date',
          '.slot-date',
          '.calendar-date'
        ];
        
        const timeSelectors = [
          '.time',
          '.appointment-time',
          '.slot-time',
          '.schedule-time'
        ];
        
        const appointments = [];
        
        appointmentSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const isAvailable = !el.classList.contains('unavailable') && 
                              !el.classList.contains('booked') && 
                              !el.classList.contains('disabled') &&
                              !el.classList.contains('full');
            
            if (isAvailable) {
              const dateText = el.dataset.date || 
                             el.querySelector('.date')?.textContent ||
                             el.querySelector('.day')?.textContent ||
                             el.textContent;
              
              const timeText = el.dataset.time || 
                             el.querySelector('.time')?.textContent ||
                             '';
              
              if (dateText && dateText.trim()) {
                appointments.push({
                  date: dateText.trim(),
                  time: timeText.trim(),
                  details: el.dataset.details || el.title || '',
                  available: true
                });
              }
            }
          });
        });
        
        if (appointments.length === 0) {
          const textContent = document.body.textContent.toLowerCase();
          if (textContent.includes('appointment') || textContent.includes('available') || textContent.includes('schedule')) {
            const lines = textContent.split('\n');
            lines.forEach(line => {
              if (line.includes('available') && (line.includes('appointment') || line.includes('slot'))) {
                appointments.push({
                  date: 'Available',
                  time: '',
                  details: line.trim(),
                  available: true
                });
              }
            });
          }
        }
        
        return appointments;
      });
      
      logger.info(`Found ${appointments.length} appointments on page`);
      return appointments;
    } catch (error) {
      logger.error('Error finding appointments:', error);
      return [];
    }
  }

  async closeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        logger.info('Browser closed successfully');
      } catch (error) {
        logger.error('Error closing browser:', error);
      }
    }
  }
}

module.exports = new WebScraperService();