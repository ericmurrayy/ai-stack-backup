# Murray's FSM Plugin Development Guide

## Overview

Murray's FSM supports a flexible plugin architecture that allows you to extend functionality with custom integrations. This guide explains how to create, register, and deploy custom plugins.

## Plugin Structure

Every plugin must implement the `PluginDefinition` interface:

```typescript
interface PluginDefinition {
  id: string;              // Unique identifier (e.g., 'my-custom-plugin')
  name: string;            // Display name
  description: string;     // Short description
  category: PluginCategory;// payment, communication, calendar, etc.
  version: string;         // Semantic version
  author: string;          // Author name
  website?: string;        // Plugin website
  documentationUrl?: string;
  icon?: string;           // Icon identifier
  fields: PluginField[];   // Configuration fields
  requiredScopes?: string[];
  webhookEvents?: string[];

  // Lifecycle hooks
  onInstall?: (config: PluginConfig) => Promise<void>;
  onUninstall?: (config: PluginConfig) => Promise<void>;
  onConfigUpdate?: (oldConfig: PluginConfig, newConfig: PluginConfig) => Promise<void>;

  // Validation
  validateConfig?: (config: PluginConfig) => Promise<ValidationResult>;
  testConnection?: (config: PluginConfig) => Promise<ConnectionResult>;
}
```

## Plugin Categories

| Category | Use Case |
|----------|----------|
| `payment` | Payment processors (Stripe, Square, PayPal) |
| `communication` | SMS/Email providers (Twilio, SendGrid) |
| `calendar` | Calendar integrations (Google, Outlook) |
| `accounting` | Accounting software (QuickBooks, Xero) |
| `crm` | CRM systems (Salesforce, HubSpot) |
| `marketing` | Marketing tools (Mailchimp, ActiveCampaign) |
| `storage` | Cloud storage (S3, GCS, Dropbox) |
| `maps` | Mapping/routing (Google Maps, Mapbox) |
| `ai` | AI providers (OpenAI, Anthropic) |
| `custom` | Custom integrations |

## Configuration Fields

Define the fields users need to configure:

```typescript
const fields: PluginField[] = [
  {
    name: 'apiKey',
    label: 'API Key',
    type: 'password',
    required: true,
    placeholder: 'Enter your API key',
    description: 'Your service API key'
  },
  {
    name: 'environment',
    label: 'Environment',
    type: 'select',
    required: true,
    options: [
      { value: 'sandbox', label: 'Sandbox (Testing)' },
      { value: 'production', label: 'Production' }
    ],
    default: 'sandbox'
  },
  {
    name: 'enableFeature',
    label: 'Enable Auto-Sync',
    type: 'boolean',
    required: false,
    default: true
  }
];
```

### Field Types

| Type | Description |
|------|-------------|
| `text` | Single-line text input |
| `password` | Masked password input |
| `number` | Numeric input |
| `boolean` | Toggle switch |
| `select` | Dropdown selection |
| `textarea` | Multi-line text input |

## Creating a Custom Plugin

### Example: Custom CRM Integration

```typescript
// plugins/my-crm.ts
import { PluginDefinition, PluginConfig } from '@murray-fsm/services';

export const myCrmPlugin: PluginDefinition = {
  id: 'my-crm',
  name: 'My CRM',
  description: 'Sync customers and jobs with My CRM',
  category: 'crm',
  version: '1.0.0',
  author: 'Your Company',
  website: 'https://mycrm.com',
  documentationUrl: 'https://docs.mycrm.com/integrations/murray-fsm',

  fields: [
    {
      name: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      description: 'Found in My CRM Settings > API'
    },
    {
      name: 'syncCustomers',
      label: 'Sync Customers',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Automatically sync customers to My CRM'
    },
    {
      name: 'syncJobs',
      label: 'Sync Jobs',
      type: 'boolean',
      required: false,
      default: true,
      description: 'Automatically sync completed jobs'
    }
  ],

  webhookEvents: ['customer.created', 'customer.updated', 'job.completed'],

  async validateConfig(config: PluginConfig) {
    const errors: string[] = [];

    if (!config.apiKey) {
      errors.push('API Key is required');
    }

    if (config.apiKey && typeof config.apiKey === 'string' && config.apiKey.length < 20) {
      errors.push('API Key appears to be invalid');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  },

  async testConnection(config: PluginConfig) {
    try {
      const response = await fetch('https://api.mycrm.com/v1/ping', {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return { success: true, message: 'Connected to My CRM successfully' };
      } else {
        return { success: false, message: 'Invalid API key' };
      }
    } catch (error) {
      return { success: false, message: 'Could not reach My CRM servers' };
    }
  },

  async onInstall(config: PluginConfig) {
    // Called when plugin is first installed
    console.log('My CRM plugin installed');

    // Register webhook endpoint with My CRM
    await fetch('https://api.mycrm.com/v1/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://your-app.com/api/webhooks/my-crm',
        events: ['contact.updated']
      })
    });
  },

  async onUninstall(config: PluginConfig) {
    // Called when plugin is uninstalled
    console.log('My CRM plugin uninstalled');

    // Clean up webhook registration
  },

  async onConfigUpdate(oldConfig: PluginConfig, newConfig: PluginConfig) {
    // Called when config changes
    if (oldConfig.apiKey !== newConfig.apiKey) {
      // Re-authenticate with new credentials
    }
  }
};
```

## Registering Custom Plugins

### Server-side Registration

```typescript
// In your server initialization
import { pluginRegistry } from '@murray-fsm/services';
import { myCrmPlugin } from './plugins/my-crm';

// Register custom plugins
pluginRegistry.register(myCrmPlugin);
```

### Dynamic Plugin Loading

```typescript
// Load plugins from a directory
import { readdirSync } from 'fs';
import { join } from 'path';

const pluginsDir = join(__dirname, 'plugins');
const pluginFiles = readdirSync(pluginsDir).filter(f => f.endsWith('.ts'));

for (const file of pluginFiles) {
  const plugin = await import(join(pluginsDir, file));
  if (plugin.default?.id) {
    pluginRegistry.register(plugin.default);
  }
}
```

## Handling Webhook Events

When your plugin subscribes to webhook events, implement handlers:

```typescript
// api/webhooks/plugins/my-crm/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const payload = await request.json();

  switch (payload.event) {
    case 'customer.created':
      await syncCustomerToCRM(payload.data);
      break;
    case 'job.completed':
      await syncJobToCRM(payload.data);
      break;
  }

  return NextResponse.json({ received: true });
}

async function syncCustomerToCRM(customer: Customer) {
  // Get plugin config
  const config = await getPluginConfig('my-crm');

  // Sync to CRM
  await fetch('https://api.mycrm.com/v1/contacts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      external_id: customer.id
    })
  });
}
```

## Environment Variables

Plugins can load configuration from environment variables:

```typescript
import { loadPluginConfigFromEnv } from '@murray-fsm/services';

// Load config from environment
const config = loadPluginConfigFromEnv('my-crm');
// Looks for: MY_CRM_API_KEY, MY_CRM_SYNC_CUSTOMERS, etc.
```

## Security Best Practices

1. **Never log sensitive data** - API keys, secrets, tokens
2. **Validate all input** - Use the `validateConfig` hook
3. **Use HTTPS** - All external API calls should use HTTPS
4. **Encrypt stored secrets** - Use Supabase Vault for sensitive config
5. **Rate limit API calls** - Respect third-party rate limits
6. **Handle errors gracefully** - Don't expose internal errors to users

## Testing Plugins

```typescript
import { describe, it, expect } from 'vitest';
import { myCrmPlugin } from './my-crm';

describe('My CRM Plugin', () => {
  it('validates required fields', async () => {
    const result = await myCrmPlugin.validateConfig?.({});
    expect(result?.valid).toBe(false);
    expect(result?.errors).toContain('API Key is required');
  });

  it('accepts valid config', async () => {
    const result = await myCrmPlugin.validateConfig?.({
      apiKey: 'valid-api-key-12345678901234567890'
    });
    expect(result?.valid).toBe(true);
  });

  it('tests connection successfully', async () => {
    // Mock the fetch call
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' })
    });

    const result = await myCrmPlugin.testConnection?.({
      apiKey: 'valid-key'
    });

    expect(result?.success).toBe(true);
  });
});
```

## Plugin Marketplace (Coming Soon)

We're building a plugin marketplace where you can:

- Publish and share your plugins
- Discover community plugins
- Monetize premium plugins
- Get verified publisher status

Stay tuned for more details!

## Support

- **Documentation:** https://docs.murraysfsm.com/plugins
- **Community Forum:** https://community.murraysfsm.com
- **Developer Discord:** https://discord.gg/murraysfsm
- **Email:** developers@murraysfsm.com
