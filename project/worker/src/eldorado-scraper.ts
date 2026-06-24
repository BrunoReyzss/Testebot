import { chromium, Browser, Page, BrowserContext } from 'playwright';

export interface EldoradoConfig {
  email: string;
  password: string;
  headless: boolean;
  statePath?: string;
}

export interface BoostingOrder {
  externalId: string;
  serviceType: string;
  region: string | null;
  category: string | null;
  description: string | null;
  budget: number | null;
  buyerUsername: string | null;
  orderUrl: string;
  gameName: string;
  offerTitle: string;
}

export interface OrderStatus {
  orderId: string;
  status: 'pending' | 'in_progress' | 'delivered' | 'disputed' | 'cancelled';
  chatMessages: number;
  lastMessageTime: string | null;
}

export class EldoradoScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: EldoradoConfig;
  private isLoggedIn: boolean = false;

  constructor(config: EldoradoConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    const launchOptions: any = {
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    };

    // Try to load existing state
    if (this.config.statePath) {
      try {
        this.context = await chromium.launchPersistentContext(
          this.config.statePath,
          {
            ...launchOptions,
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          }
        );
        this.browser = this.context.browser()!;
        this.page = await this.context.newPage();
        console.log('[Scraper] Loaded existing browser state');
      } catch (e) {
        console.log('[Scraper] No existing state, creating new browser');
        this.browser = await chromium.launch(launchOptions);
        this.context = await this.browser.newContext({
          viewport: { width: 1920, height: 1080 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        });
        this.page = await this.context.newPage();
      }
    } else {
      this.browser = await chromium.launch(launchOptions);
      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      });
      this.page = await this.context.newPage();
    }

    // Set default timeout
    this.page.setDefaultTimeout(30000);
  }

  async login(): Promise<boolean> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      console.log('[Scraper] Navigating to Eldorado.gg...');
      await this.page.goto('https://www.eldorado.gg/', { waitUntil: 'networkidle' });

      // Check if already logged in
      const userMenu = await this.page.$('[data-test="user-menu"], .user-dropdown, [class*="UserMenu"]');
      if (userMenu) {
        const isVisible = await userMenu.isVisible();
        if (isVisible) {
          console.log('[Scraper] Already logged in');
          this.isLoggedIn = true;
          return true;
        }
      }

      // Click login button
      console.log('[Scraper] Clicking login button...');
      const loginBtn = await this.page.waitForSelector(
        'text=Log in, text=Login, button:has-text("Log in"), [data-test="login-button"]',
        { timeout: 10000 }
      );
      await loginBtn.click();

      // Wait for login modal
      await this.page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

      // Fill email
      console.log('[Scraper] Filling credentials...');
      const emailInput = await this.page.$('input[type="email"], input[name="email"]');
      if (emailInput) {
        await emailInput.fill(this.config.email);
      }

      // Fill password
      const passwordInput = await this.page.$('input[type="password"], input[name="password"]');
      if (passwordInput) {
        await passwordInput.fill(this.config.password);
      }

      // Click submit
      const submitBtn = await this.page.$('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")');
      if (submitBtn) {
        await submitBtn.click();
      }

      // Wait for successful login
      await this.page.waitForURL('**/eldorado.gg/**', { timeout: 30000 });

      // Check for login success
      await this.page.waitForTimeout(3000);
      const loginError = await this.page.$('text=Invalid, text=Incorrect, text=Wrong password, .error-message');
      if (loginError && await loginError.isVisible()) {
        console.error('[Scraper] Login failed - invalid credentials');
        return false;
      }

      // Verify logged in
      const profileElement = await this.page.$('[class*="profile"], [class*="user"], [data-test="user-menu"]');
      if (profileElement) {
        console.log('[Scraper] Login successful');
        this.isLoggedIn = true;
        return true;
      }

      console.log('[Scraper] Login state unclear, page saved for debugging');
      await this.page.screenshot({ path: 'login-state.png' });
      return false;

    } catch (error) {
      console.error('[Scraper] Login error:', error);
      await this.page?.screenshot({ path: 'login-error.png' }).catch(() => {});
      return false;
    }
  }

  async getPendingOrders(): Promise<BoostingOrder[]> {
    if (!this.page || !this.isLoggedIn) throw new Error('Not logged in');

    try {
      console.log('[Scraper] Navigating to orders page...');

      // Navigate to orders/sales page
      await this.page.goto('https://www.eldorado.gg/my-orders/sales', { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(2000);

      // Wait for orders to load
      await this.page.waitForSelector('[class*="order"], [class*="Order"]', { timeout: 15000 });

      // Extract orders
      const orders: BoostingOrder[] = [];

      // Find all order elements
      const orderElements = await this.page.$$('[class*="order-card"], [class*="OrderItem"], [data-test="order-row"], tr[class*="order"]');

      for (const orderEl of orderElements) {
        try {
          const order = await this.extractOrderDetails(orderEl);
          if (order && order.status === 'pending') {
            orders.push(order.data);
          }
        } catch (e) {
          console.log('[Scraper] Error extracting order:', e);
        }
      }

      // Alternative: Parse from page content
      if (orders.length === 0) {
        const pageContent = await this.page.content();
        const parsedOrders = this.parseOrdersFromContent(pageContent);
        orders.push(...parsedOrders.filter(o => o.serviceType.toLowerCase().includes('boost')));
      }

      console.log(`[Scraper] Found ${orders.length} pending boosting orders`);
      return orders;

    } catch (error) {
      console.error('[Scraper] Error getting orders:', error);
      await this.page?.screenshot({ path: 'orders-error.png' }).catch(() => {});
      return [];
    }
  }

  private async extractOrderDetails(orderEl: any): Promise<{ status: string; data: BoostingOrder } | null> {
    try {
      const text = await orderEl.textContent();

      // Extract order ID
      const idMatch = text?.match(/([A-Z0-9]{8,}-[A-Z0-9]{4,})/i) ||
                      text?.match(/Order\s*#?\s*[:/]?\s*([A-Z0-9]+)/i);
      const externalId = idMatch?.[1] || `ORD-${Date.now()}`;

      // Extract status
      const statusMatch = text?.match(/pending|in.progress|delivered|disputed|cancelled/i);
      const status = statusMatch?.[0]?.toLowerCase().replace(' ', '_') || 'pending';

      // Extract game/service info
      const gameMatch = text?.match(/(Valorant|League of Legends|LoL|CS2|CS:GO|Overwatch|WoW|GTA|Fortnite|Apex|Rust|OSRS|Runescape)/i);
      const gameName = gameMatch?.[1] || 'Unknown';

      // Check if it's a boosting order
      const isBoosting = text?.toLowerCase().includes('boost') ||
                         text?.toLowerCase().includes('rank') ||
                         text?.toLowerCase().includes('elo');

      // Extract price/budget
      const priceMatch = text?.match(/\$([\d,.]+)/);
      const budget = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;

      // Get order URL
      const link = await orderEl.$('a[href*="order"]');
      const orderUrl = link ? await link.getAttribute('href') : '';

      // Extract buyer username
      const buyerMatch = text?.match(/by\s+([a-zA-Z0-9_]+)/i);
      const buyerUsername = buyerMatch?.[1] || null;

      // Extract description from offer title
      const offerMatch = text?.match(/offer[:\s]+(.+?)(?:\n|$)/i);
      const offerTitle = offerMatch?.[1]?.trim() || text?.slice(0, 100) || '';

      return {
        status,
        data: {
          externalId,
          serviceType: isBoosting ? 'boost' : 'other',
          region: null,
          category: null,
          description: offerTitle,
          budget,
          buyerUsername,
          orderUrl: orderUrl ? `https://www.eldorado.gg${orderUrl}` : '',
          gameName,
          offerTitle,
        }
      };
    } catch {
      return null;
    }
  }

  private parseOrdersFromContent(content: string): BoostingOrder[] {
    const orders: BoostingOrder[] = [];

    // Try to parse JSON data if embedded
    const jsonMatch = content.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        // Navigate to orders in the data structure
        const ordersData = data?.orders?.pending || data?.sales || [];
        for (const order of ordersData) {
          orders.push({
            externalId: order.id || order.orderId || `ORD-${Date.now()}`,
            serviceType: this.detectServiceType(order),
            region: order.region || order.server || null,
            category: order.category || order.type || null,
            description: order.description || order.offer?.title || null,
            budget: order.price || order.amount || null,
            buyerUsername: order.buyer?.username || null,
            orderUrl: `https://www.eldorado.gg/orders/${order.id}`,
            gameName: order.game?.name || order.gameName || 'Unknown',
            offerTitle: order.offer?.title || '',
          });
        }
      } catch (e) {
        console.log('[Scraper] Could not parse JSON state');
      }
    }

    return orders;
  }

  private detectServiceType(order: any): string {
    const title = (order.title || order.offer?.title || '').toLowerCase();
    if (title.includes('boost')) return 'boost';
    if (title.includes('coaching')) return 'coaching';
    if (title.includes('leveling') || title.includes('level')) return 'leveling';
    if (title.includes('account')) return 'account';
    return 'boost';
  }

  async respondToOrder(orderId: string, message: string): Promise<boolean> {
    if (!this.page || !this.isLoggedIn) throw new Error('Not logged in');

    try {
      console.log(`[Scraper] Responding to order ${orderId}...`);

      // Navigate to order page
      await this.page.goto(`https://www.eldorado.gg/orders/${orderId}`, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(2000);

      // Find chat input
      const chatInput = await this.page.$(
        'textarea[placeholder*="message"], input[placeholder*="message"], [class*="chat-input"], [data-test="chat-input"]'
      );

      if (chatInput) {
        await chatInput.fill(message);

        // Find and click send button
        const sendBtn = await this.page.$(
          'button:has-text("Send"), [data-test="send-message"], button[class*="send"]'
        );
        if (sendBtn) {
          await sendBtn.click();
          await this.page.waitForTimeout(1000);
          console.log(`[Scraper] Message sent to order ${orderId}`);
          return true;
        }
      }

      console.log(`[Scraper] Could not find chat input for order ${orderId}`);
      return false;

    } catch (error) {
      console.error(`[Scraper] Error responding to order ${orderId}:`, error);
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
    } else if (this.browser) {
      await this.browser.close();
    }
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isLoggedIn = false;
    console.log('[Scraper] Browser closed');
  }

  async saveState(): Promise<void> {
    if (this.context && this.config.statePath) {
      await this.context.storageState({ path: `${this.config.statePath}/state.json` });
      console.log('[Scraper] State saved');
    }
  }
}
