// Murray's FSM - Integrations Settings
// =====================================
// Plugin management, API keys, and webhooks

import { createAdminClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Plug,
  Key,
  Webhook,
  Plus,
  Settings,
  ExternalLink,
  Check,
  AlertCircle,
  ChevronRight,
  Shield,
  Zap,
  CreditCard,
  MessageSquare,
  Calendar,
  BookOpen,
  Map as MapIcon,
  Bot,
  MoreVertical,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  PluginActions,
  CreateApiKeyButton,
  AddWebhookButton,
  ApiKeyActions,
  WebhookActions,
} from './PluginActions';

// Plugin categories and their icons
const categoryIcons: Record<string, typeof Plug> = {
  payment: CreditCard,
  communication: MessageSquare,
  calendar: Calendar,
  accounting: BookOpen,
  maps: MapIcon,
  ai: Bot,
  custom: Plug,
};

const categoryColors: Record<string, string> = {
  payment: 'bg-green-50 text-green-700',
  communication: 'bg-blue-50 text-blue-700',
  calendar: 'bg-purple-50 text-purple-700',
  accounting: 'bg-yellow-50 text-yellow-700',
  maps: 'bg-red-50 text-red-700',
  ai: 'bg-indigo-50 text-indigo-700',
  custom: 'bg-slate-50 text-slate-700',
};

// Available plugins that can be installed (static catalog)
const availablePluginsCatalog = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Accept credit card payments with Stripe',
    category: 'payment',
    website: 'https://stripe.com',
  },
  {
    id: 'square',
    name: 'Square',
    description: 'Accept payments with Square',
    category: 'payment',
    website: 'https://squareup.com',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'Send SMS and make calls with Twilio',
    category: 'communication',
    website: 'https://twilio.com',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Send transactional and marketing emails',
    category: 'communication',
    website: 'https://sendgrid.com',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync jobs to Google Calendar',
    category: 'calendar',
    website: 'https://calendar.google.com',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Sync invoices and payments to QuickBooks',
    category: 'accounting',
    website: 'https://quickbooks.intuit.com',
  },
  {
    id: 'google-maps',
    name: 'Google Maps',
    description: 'Route optimization and address autocomplete',
    category: 'maps',
    website: 'https://cloud.google.com/maps-platform',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'AI-powered features with Claude models',
    category: 'ai',
    website: 'https://anthropic.com',
  },
];

interface InstalledPlugin {
  id: string;
  owner_id: string;
  plugin_id: string;
  enabled: boolean;
  config: Record<string, any>;
  installed_at: string;
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  failure_count: number;
  last_triggered_at: string | null;
}

async function getIntegrationData() {
  const supabase = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { installedPlugins: [], apiKeys: [], webhooks: [] };
  }

  // Try to fetch from installed_plugins table (may not exist in all deployments)
  let installedPlugins: InstalledPlugin[] = [];
  try {
    const { data } = await supabase
      .from('installed_plugins')
      .select('*')
      .eq('owner_id', user.id);
    installedPlugins = data || [];
  } catch (e) {
    // Table may not exist
  }

  // Try to fetch API keys
  let apiKeys: ApiKey[] = [];
  try {
    const { data } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, is_active, last_used_at, created_at')
      .eq('owner_id', user.id)
      .eq('is_active', true);
    apiKeys = data || [];
  } catch (e) {
    // Table may not exist
  }

  // Try to fetch webhooks
  let webhooks: WebhookEndpoint[] = [];
  try {
    const { data } = await supabase
      .from('webhook_endpoints')
      .select('id, url, events, is_active, failure_count, last_triggered_at')
      .eq('owner_id', user.id);
    webhooks = data || [];
  } catch (e) {
    // Table may not exist
  }

  return { installedPlugins, apiKeys, webhooks };
}

function PluginCard({
  plugin,
  isInstalled,
  isEnabled,
}: {
  plugin: (typeof availablePluginsCatalog)[0];
  isInstalled: boolean;
  isEnabled: boolean;
}) {
  const Icon = categoryIcons[plugin.category] || Plug;

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-lg ${categoryColors[plugin.category]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">{plugin.name}</h3>
            {isInstalled && (
              <Badge className={isEnabled ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}>
                {isEnabled ? 'Active' : 'Disabled'}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">{plugin.description}</p>
          <PluginActions
            plugin={{
              ...plugin,
              installed: isInstalled,
              enabled: isEnabled,
            }}
          />
        </div>
      </div>
    </Card>
  );
}

export default async function IntegrationsPage() {
  const { installedPlugins, apiKeys, webhooks } = await getIntegrationData();

  // Create lookup object for installed plugins
  const installedLookup: Record<string, InstalledPlugin> = {};
  installedPlugins.forEach(p => { installedLookup[p.plugin_id] = p; });

  // Calculate real counts
  const installedCount = installedPlugins.length;
  const activeCount = installedPlugins.filter(p => p.enabled).length;

  return (
    <div>
      <Header title="Integrations & API" />

      <div className="p-6 space-y-8">
        {/* Quick Stats - Real Data */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Plug className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{installedCount}</div>
                <div className="text-sm text-slate-500">Installed Plugins</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <Zap className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{activeCount}</div>
                <div className="text-sm text-slate-500">Active Integrations</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Key className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{apiKeys.length}</div>
                <div className="text-sm text-slate-500">API Keys</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <Webhook className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{webhooks.length}</div>
                <div className="text-sm text-slate-500">Webhooks</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Plugins Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Available Plugins</h2>
              <p className="text-sm text-slate-500">Connect your favorite tools and services</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {availablePluginsCatalog.map((plugin) => {
              const installed = installedLookup[plugin.id];
              return (
                <PluginCard
                  key={plugin.id}
                  plugin={plugin}
                  isInstalled={!!installed}
                  isEnabled={installed?.enabled ?? false}
                />
              );
            })}
          </div>
        </div>

        {/* API Keys Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">API Keys</h2>
              <p className="text-sm text-slate-500">Manage access to the Murray&apos;s FSM API</p>
            </div>
            <CreateApiKeyButton />
          </div>
          <Card padding="none">
            {apiKeys.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                      Name
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                      Key
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                      Scopes
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                      Last Used
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {apiKeys.map((key) => (
                    <tr key={key.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{key.name}</td>
                      <td className="px-6 py-4">
                        <code className="text-sm bg-slate-100 px-2 py-1 rounded font-mono">
                          {key.key_prefix}...
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.slice(0, 2).map((scope) => (
                            <Badge key={scope} className="bg-slate-100 text-slate-600 text-xs">
                              {scope}
                            </Badge>
                          ))}
                          {key.scopes.length > 2 && (
                            <Badge className="bg-slate-100 text-slate-600 text-xs">
                              +{key.scopes.length - 2}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {key.last_used_at
                          ? new Date(key.last_used_at).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={key.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {key.is_active ? 'Active' : 'Revoked'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <ApiKeyActions keyId={key.id} keyPrefix={key.key_prefix} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center">
                <Key className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <div className="text-slate-500">No API keys yet</div>
                <div className="text-sm text-slate-400 mt-1">
                  Create an API key to integrate with external services
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Webhooks Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Webhooks</h2>
              <p className="text-sm text-slate-500">Receive real-time notifications for events</p>
            </div>
            <AddWebhookButton />
          </div>
          <Card padding="none">
            {webhooks.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                      URL
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                      Events
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                      Last Triggered
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {webhooks.map((webhook) => (
                    <tr key={webhook.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <code className="text-sm text-slate-700 font-mono">
                          {webhook.url.length > 40 ? webhook.url.slice(0, 40) + '...' : webhook.url}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {webhook.events.map((event) => (
                            <Badge key={event} className="bg-slate-100 text-slate-600 text-xs">
                              {event}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {webhook.last_triggered_at
                          ? new Date(webhook.last_triggered_at).toLocaleString()
                          : 'Never'}
                      </td>
                      <td className="px-6 py-4">
                        {webhook.failure_count > 0 ? (
                          <Badge className="bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Failing
                          </Badge>
                        ) : webhook.is_active ? (
                          <Badge className="bg-green-100 text-green-800">
                            <Check className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600">Disabled</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <WebhookActions webhookId={webhook.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center">
                <Webhook className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <div className="text-slate-500">No webhooks configured</div>
                <div className="text-sm text-slate-400 mt-1">
                  Add a webhook to receive notifications when events occur
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Developer Resources */}
        <Card className="p-6 bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Developer Resources</h2>
              <p className="text-slate-300 mt-1">
                Build custom integrations with our REST API and webhooks
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-lg hover:bg-white/20 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                API Docs
              </button>
              <button className="px-4 py-2 text-sm font-medium text-slate-900 bg-white rounded-lg hover:bg-slate-100 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Developer Portal
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
