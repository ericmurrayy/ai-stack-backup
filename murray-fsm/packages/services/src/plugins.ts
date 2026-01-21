// Murray's FSM - Plugin Architecture
// ===================================
// Extensible plugin system for easy integrations

// ============================================================================
// Plugin Types
// ============================================================================

export type PluginCategory =
  | 'payment'      // Payment processors (Stripe, Square, PayPal)
  | 'communication'// SMS/Email providers (Twilio, SendGrid)
  | 'calendar'     // Calendar integrations (Google, Outlook)
  | 'accounting'   // Accounting software (QuickBooks, Xero)
  | 'crm'          // CRM systems (Salesforce, HubSpot)
  | 'marketing'    // Marketing tools (Mailchimp, ActiveCampaign)
  | 'storage'      // Cloud storage (S3, GCS, Dropbox)
  | 'maps'         // Mapping/routing (Google Maps, Mapbox)
  | 'ai'           // AI providers (OpenAI, Anthropic)
  | 'custom';      // Custom integrations

export interface PluginConfig {
  [key: string]: string | number | boolean | null;
}

export interface PluginField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'boolean' | 'select' | 'textarea';
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: { value: string; label: string }[];
  default?: string | number | boolean;
}

export interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  category: PluginCategory;
  version: string;
  author: string;
  website?: string;
  documentationUrl?: string;
  icon?: string;
  fields: PluginField[];
  requiredScopes?: string[];
  webhookEvents?: string[];
  // Lifecycle hooks
  onInstall?: (config: PluginConfig) => Promise<void>;
  onUninstall?: (config: PluginConfig) => Promise<void>;
  onConfigUpdate?: (oldConfig: PluginConfig, newConfig: PluginConfig) => Promise<void>;
  // Validation
  validateConfig?: (config: PluginConfig) => Promise<{ valid: boolean; errors?: string[] }>;
  testConnection?: (config: PluginConfig) => Promise<{ success: boolean; message?: string }>;
}

export interface InstalledPlugin {
  pluginId: string;
  enabled: boolean;
  config: PluginConfig;
  installedAt: string;
  updatedAt: string;
}

// ============================================================================
// Built-in Plugin Definitions
// ============================================================================

export const BUILTIN_PLUGINS: PluginDefinition[] = [
  // Payment Plugins
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Accept credit card payments with Stripe',
    category: 'payment',
    version: '1.0.0',
    author: 'Murray\'s FSM',
    website: 'https://stripe.com',
    documentationUrl: 'https://stripe.com/docs',
    icon: 'stripe',
    fields: [
      {
        name: 'publishableKey',
        label: 'Publishable Key',
        type: 'text',
        required: true,
        placeholder: 'pk_live_...',
        description: 'Your Stripe publishable key (starts with pk_)',
      },
      {
        name: 'secretKey',
        label: 'Secret Key',
        type: 'password',
        required: true,
        placeholder: 'sk_live_...',
        description: 'Your Stripe secret key (starts with sk_)',
      },
      {
        name: 'webhookSecret',
        label: 'Webhook Secret',
        type: 'password',
        required: false,
        placeholder: 'whsec_...',
        description: 'Webhook signing secret for payment events',
      },
    ],
    webhookEvents: ['payment.succeeded', 'payment.failed', 'refund.created'],
  },
  {
    id: 'square',
    name: 'Square',
    description: 'Accept payments with Square',
    category: 'payment',
    version: '1.0.0',
    author: 'Murray\'s FSM',
    website: 'https://squareup.com',
    icon: 'square',
    fields: [
      {
        name: 'accessToken',
        label: 'Access Token',
        type: 'password',
        required: true,
        description: 'Your Square access token',
      },
      {
        name: 'locationId',
        label: 'Location ID',
        type: 'text',
        required: true,
        description: 'Your Square location ID',
      },
      {
        name: 'environment',
        label: 'Environment',
        type: 'select',
        required: true,
        options: [
          { value: 'sandbox', label: 'Sandbox (Testing)' },
          { value: 'production', label: 'Production' },
        ],
        default: 'sandbox',
      },
    ],
  },

  // Communication Plugins
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'Send SMS and make calls with Twilio',
    category: 'communication',
    version: '1.0.0',
    author: 'Murray\'s FSM',
    website: 'https://twilio.com',
    icon: 'twilio',
    fields: [
      {
        name: 'accountSid',
        label: 'Account SID',
        type: 'text',
        required: true,
        placeholder: 'AC...',
      },
      {
        name: 'authToken',
        label: 'Auth Token',
        type: 'password',
        required: true,
      },
      {
        name: 'phoneNumber',
        label: 'Phone Number',
        type: 'text',
        required: true,
        placeholder: '+1234567890',
        description: 'Your Twilio phone number in E.164 format',
      },
    ],
    webhookEvents: ['sms.received', 'sms.delivered', 'call.completed'],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Send transactional and marketing emails',
    category: 'communication',
    version: '1.0.0',
    author: 'Murray\'s FSM',
    website: 'https://sendgrid.com',
    icon: 'sendgrid',
    fields: [
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'SG...',
      },
      {
        name: 'fromEmail',
        label: 'From Email',
        type: 'text',
        required: true,
        placeholder: 'noreply@yourbusiness.com',
      },
      {
        name: 'fromName',
        label: 'From Name',
        type: 'text',
        required: true,
        placeholder: 'Your Business Name',
      },
    ],
    webhookEvents: ['email.delivered', 'email.opened', 'email.clicked', 'email.bounced'],
  },

  // Calendar Plugins
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync jobs to Google Calendar',
    category: 'calendar',
    version: '1.0.0',
    author: 'Murray\'s FSM',
    website: 'https://calendar.google.com',
    icon: 'google',
    fields: [
      {
        name: 'clientId',
        label: 'OAuth Client ID',
        type: 'text',
        required: true,
        description: 'From Google Cloud Console',
      },
      {
        name: 'clientSecret',
        label: 'OAuth Client Secret',
        type: 'password',
        required: true,
      },
      {
        name: 'calendarId',
        label: 'Calendar ID',
        type: 'text',
        required: false,
        placeholder: 'primary',
        default: 'primary',
        description: 'Calendar to sync jobs to (default: primary)',
      },
    ],
    requiredScopes: ['https://www.googleapis.com/auth/calendar'],
  },

  // Accounting Plugins
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Sync invoices and payments to QuickBooks',
    category: 'accounting',
    version: '1.0.0',
    author: 'Murray\'s FSM',
    website: 'https://quickbooks.intuit.com',
    icon: 'quickbooks',
    fields: [
      {
        name: 'clientId',
        label: 'OAuth Client ID',
        type: 'text',
        required: true,
      },
      {
        name: 'clientSecret',
        label: 'OAuth Client Secret',
        type: 'password',
        required: true,
      },
      {
        name: 'realmId',
        label: 'Company ID (Realm ID)',
        type: 'text',
        required: true,
        description: 'Your QuickBooks company ID',
      },
      {
        name: 'syncInvoices',
        label: 'Sync Invoices',
        type: 'boolean',
        required: false,
        default: true,
      },
      {
        name: 'syncPayments',
        label: 'Sync Payments',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
    requiredScopes: ['com.intuit.quickbooks.accounting'],
  },

  // Maps/Routing Plugins
  {
    id: 'google-maps',
    name: 'Google Maps',
    description: 'Route optimization and address autocomplete',
    category: 'maps',
    version: '1.0.0',
    author: 'Murray\'s FSM',
    website: 'https://cloud.google.com/maps-platform',
    icon: 'google-maps',
    fields: [
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        description: 'Google Maps API key with Places, Directions, and Geocoding enabled',
      },
      {
        name: 'enableRouteOptimization',
        label: 'Enable Route Optimization',
        type: 'boolean',
        required: false,
        default: true,
      },
      {
        name: 'enableAutocomplete',
        label: 'Enable Address Autocomplete',
        type: 'boolean',
        required: false,
        default: true,
      },
    ],
  },

  // AI Plugins
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'AI-powered features with GPT models',
    category: 'ai',
    version: '1.0.0',
    author: 'Murray\'s FSM',
    website: 'https://openai.com',
    icon: 'openai',
    fields: [
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-...',
      },
      {
        name: 'model',
        label: 'Default Model',
        type: 'select',
        required: true,
        options: [
          { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Faster)' },
          { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        ],
        default: 'gpt-4o-mini',
      },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'AI-powered features with Claude models',
    category: 'ai',
    version: '1.0.0',
    author: 'Murray\'s FSM',
    website: 'https://anthropic.com',
    icon: 'anthropic',
    fields: [
      {
        name: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-ant-...',
      },
      {
        name: 'model',
        label: 'Default Model',
        type: 'select',
        required: true,
        options: [
          { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Recommended)' },
          { value: 'claude-opus-4-20250514', label: 'Claude Opus 4 (Most Capable)' },
        ],
        default: 'claude-sonnet-4-20250514',
      },
    ],
  },
];

// ============================================================================
// Plugin Registry
// ============================================================================

export class PluginRegistry {
  private plugins: Map<string, PluginDefinition> = new Map();

  constructor() {
    // Register built-in plugins
    BUILTIN_PLUGINS.forEach((plugin) => {
      this.plugins.set(plugin.id, plugin);
    });
  }

  /**
   * Register a custom plugin
   */
  register(plugin: PluginDefinition): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin with ID "${plugin.id}" already exists`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): boolean {
    return this.plugins.delete(pluginId);
  }

  /**
   * Get a plugin by ID
   */
  get(pluginId: string): PluginDefinition | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all plugins
   */
  getAll(): PluginDefinition[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by category
   */
  getByCategory(category: PluginCategory): PluginDefinition[] {
    return this.getAll().filter((p) => p.category === category);
  }

  /**
   * Validate plugin configuration
   */
  async validateConfig(pluginId: string, config: PluginConfig): Promise<{ valid: boolean; errors?: string[] }> {
    const plugin = this.get(pluginId);
    if (!plugin) {
      return { valid: false, errors: [`Plugin "${pluginId}" not found`] };
    }

    const errors: string[] = [];

    // Check required fields
    for (const field of plugin.fields) {
      if (field.required && !config[field.name]) {
        errors.push(`${field.label} is required`);
      }
    }

    // Run custom validation if provided
    if (plugin.validateConfig && errors.length === 0) {
      const customValidation = await plugin.validateConfig(config);
      if (!customValidation.valid && customValidation.errors) {
        errors.push(...customValidation.errors);
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  /**
   * Test plugin connection
   */
  async testConnection(pluginId: string, config: PluginConfig): Promise<{ success: boolean; message?: string }> {
    const plugin = this.get(pluginId);
    if (!plugin) {
      return { success: false, message: `Plugin "${pluginId}" not found` };
    }

    if (!plugin.testConnection) {
      return { success: true, message: 'Connection test not available for this plugin' };
    }

    try {
      return await plugin.testConnection(config);
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Connection test failed' };
    }
  }
}

// Singleton instance
export const pluginRegistry = new PluginRegistry();

// ============================================================================
// Plugin Configuration Helpers
// ============================================================================

/**
 * Get environment variable names for a plugin
 */
export function getPluginEnvVars(pluginId: string): Record<string, string> {
  const plugin = pluginRegistry.get(pluginId);
  if (!plugin) return {};

  const prefix = pluginId.toUpperCase().replace(/-/g, '_');
  const envVars: Record<string, string> = {};

  for (const field of plugin.fields) {
    const envName = `${prefix}_${field.name.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    envVars[field.name] = envName;
  }

  return envVars;
}

/**
 * Load plugin config from environment variables
 */
export function loadPluginConfigFromEnv(pluginId: string): PluginConfig {
  const envVars = getPluginEnvVars(pluginId);
  const config: PluginConfig = {};

  for (const [fieldName, envName] of Object.entries(envVars)) {
    const value = process.env[envName];
    if (value !== undefined) {
      config[fieldName] = value;
    }
  }

  return config;
}
