'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, ExternalLink, Plus, X, Check, AlertCircle, Copy, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Plugin {
  id: string;
  name: string;
  description: string;
  category: string;
  installed: boolean;
  enabled: boolean;
  website: string;
}

interface PluginActionsProps {
  plugin: Plugin;
}

// Plugin configuration fields by plugin ID
// Field keys must match the camelCase names in the plugin registry (packages/services/src/plugins.ts)
const pluginConfigFields: Record<string, { key: string; label: string; type: string; placeholder: string; required: boolean }[]> = {
  stripe: [
    { key: 'publishableKey', label: 'Publishable Key', type: 'text', placeholder: 'pk_live_...', required: true },
    { key: 'secretKey', label: 'Secret Key', type: 'password', placeholder: 'sk_live_...', required: true },
    { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', placeholder: 'whsec_...', required: false },
  ],
  twilio: [
    { key: 'accountSid', label: 'Account SID', type: 'text', placeholder: 'AC...', required: true },
    { key: 'authToken', label: 'Auth Token', type: 'password', placeholder: 'Your auth token', required: true },
    { key: 'phoneNumber', label: 'Phone Number', type: 'text', placeholder: '+15551234567', required: true },
  ],
  'google-calendar': [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'Google OAuth Client ID', required: true },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'Google OAuth Client Secret', required: true },
  ],
  'google-maps': [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'AIza...', required: true },
  ],
  square: [
    { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'Square access token', required: true },
    { key: 'locationId', label: 'Location ID', type: 'text', placeholder: 'Square location ID', required: true },
  ],
  sendgrid: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'SG...', required: true },
    { key: 'fromEmail', label: 'From Email', type: 'email', placeholder: 'noreply@yourdomain.com', required: true },
    { key: 'fromName', label: 'From Name', type: 'text', placeholder: 'Your Business Name', required: true },
  ],
  quickbooks: [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'QuickBooks App Client ID', required: true },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: 'QuickBooks App Client Secret', required: true },
    { key: 'realmId', label: 'Company ID (Realm ID)', type: 'text', placeholder: 'Your QuickBooks company ID', required: true },
  ],
  anthropic: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-ant-...', required: true },
  ],
  openai: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true },
  ],
};

export function PluginActions({ plugin }: PluginActionsProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const fields = pluginConfigFields[plugin.id] || [];

  const handleConfigure = () => {
    setShowModal(true);
    setError(null);
    setSuccess(false);
  };

  const handleInstall = () => {
    setShowModal(true);
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    setShowModal(false);
    setError(null);
    setSuccess(false);
    setFormData({});
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      for (const field of fields) {
        if (field.required && !formData[field.key]) {
          throw new Error(`${field.label} is required`);
        }
      }

      const response = await fetch('/api/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plugin_id: plugin.id,
          config: formData,
          enabled: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save plugin configuration');
      }

      setSuccess(true);
      setTimeout(() => {
        handleClose();
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDocs = () => {
    window.open(plugin.website, '_blank');
  };

  return (
    <>
      <div className="flex items-center gap-3 mt-3">
        {plugin.installed ? (
          <>
            <button
              onClick={handleConfigure}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <Settings className="w-3.5 h-3.5" />
              Configure
            </button>
            <button
              onClick={handleDocs}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Docs
            </button>
          </>
        ) : (
          <button
            onClick={handleInstall}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Install
          </button>
        )}
      </div>

      {/* Configuration Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {plugin.installed ? 'Configure' : 'Install'} {plugin.name}
              </h2>
              <button
                onClick={handleClose}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Configuration saved successfully!
                </div>
              )}

              {fields.length > 0 ? (
                fields.map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type={field.type}
                      value={formData[field.key] || ''}
                      onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={field.required}
                    />
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-slate-500">
                  <p>No configuration required for this plugin.</p>
                  <p className="text-sm mt-1">Click Save to enable the integration.</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" loading={loading} disabled={success}>
                  {plugin.installed ? 'Save Changes' : 'Install & Configure'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// Create API Key Button
export function CreateApiKeyButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    scopes: ['read:jobs', 'read:customers'],
  });

  const availableScopes = [
    { id: 'read:jobs', label: 'Read Jobs' },
    { id: 'write:jobs', label: 'Write Jobs' },
    { id: 'read:customers', label: 'Read Customers' },
    { id: 'write:customers', label: 'Write Customers' },
    { id: 'read:invoices', label: 'Read Invoices' },
    { id: 'write:invoices', label: 'Write Invoices' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create API key');
      }

      const data = await response.json();
      setNewKey(data.key);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setNewKey(null);
    setError(null);
    setFormData({ name: '', scopes: ['read:jobs', 'read:customers'] });
    if (newKey) {
      router.refresh();
    }
  };

  const toggleScope = (scope: string) => {
    setFormData(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Create API Key
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Create API Key</h2>
              <button onClick={handleClose} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {newKey ? (
              <div className="p-4 space-y-4">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                  <strong>Important:</strong> Copy this API key now. You won&apos;t be able to see it again.
                </div>
                <div className="p-3 bg-slate-100 rounded-lg font-mono text-sm break-all">
                  {newKey}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(newKey)}
                  className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy to Clipboard
                </button>
                <Button onClick={handleClose} className="w-full">
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Key Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Mobile App, Integration"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Permissions
                  </label>
                  <div className="space-y-2">
                    {availableScopes.map(scope => (
                      <label key={scope.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.scopes.includes(scope.id)}
                          onChange={() => toggleScope(scope.id)}
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">{scope.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={loading}>
                    Create Key
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Add Webhook Button
export function AddWebhookButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    url: '',
    events: ['job.completed'],
  });

  const availableEvents = [
    { id: 'job.created', label: 'Job Created' },
    { id: 'job.completed', label: 'Job Completed' },
    { id: 'job.cancelled', label: 'Job Cancelled' },
    { id: 'customer.created', label: 'Customer Created' },
    { id: 'invoice.paid', label: 'Invoice Paid' },
    { id: 'estimate.approved', label: 'Estimate Approved' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create webhook');
      }

      setIsOpen(false);
      setFormData({ url: '', events: ['job.completed'] });
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleEvent = (event: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Webhook
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Add Webhook</h2>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Webhook URL *
                </label>
                <input
                  type="url"
                  required
                  value={formData.url}
                  onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://your-server.com/webhook"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Events to Subscribe
                </label>
                <div className="space-y-2">
                  {availableEvents.map(event => (
                    <label key={event.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event.id)}
                        onChange={() => toggleEvent(event.id)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={loading}>
                  Add Webhook
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// API Key Actions (Copy, Delete)
export function ApiKeyActions({ keyId, keyPrefix }: { keyId: string; keyPrefix: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(keyPrefix + '...');
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke API key');
      }

      router.refresh();
    } catch (err) {
      console.error('Failed to delete API key:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleCopy}
        className="p-1.5 hover:bg-slate-100 rounded"
        title="Copy"
      >
        <Copy className="w-4 h-4 text-slate-400" />
      </button>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="p-1.5 hover:bg-slate-100 rounded"
        title="Revoke"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4 text-slate-400" />
        )}
      </button>
    </div>
  );
}

// Webhook Actions (Test, Settings, Delete)
export function WebhookActions({ webhookId }: { webhookId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await fetch(`/api/webhooks/${webhookId}/test`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Test failed');
      }

      // Test successful
    } catch (err) {
      console.error('Failed to send test webhook:', err);
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this webhook?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete webhook');
      }

      router.refresh();
    } catch (err) {
      console.error('Failed to delete webhook:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleTest}
        disabled={testing}
        className="p-1.5 hover:bg-slate-100 rounded"
        title="Test"
      >
        {testing ? (
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4 text-slate-400" />
        )}
      </button>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="p-1.5 hover:bg-slate-100 rounded"
        title="Delete"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4 text-slate-400" />
        )}
      </button>
    </div>
  );
}
