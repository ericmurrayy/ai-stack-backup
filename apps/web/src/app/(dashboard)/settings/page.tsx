'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Separator } from '@/components/ui/separator';
import {
  Building2,
  DollarSign,
  Phone,
  Bot,
  Receipt,
  Star,
  Bell,
  Shield,
  Palette,
  Save,
  CheckCircle,
  RefreshCw
} from 'lucide-react';

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Business Settings
  const [businessSettings, setBusinessSettings] = useState({
    companyName: "Murray's Field Service",
    phone: '(555) 123-4567',
    email: 'contact@murrayfsm.com',
    address: '123 Service Way, Austin, TX 78701',
    website: 'https://murrayfsm.com',
    timezone: 'America/New_York',
  });

  // Pricing Settings
  const [pricingSettings, setPricingSettings] = useState({
    defaultLaborRate: 85,
    defaultTaxRate: 8.25,
    quoteValidityDays: 30,
    invoiceDueDays: 14,
    emergencyMultiplier: 1.5,
    urgentMultiplier: 1.25,
  });

  // AI Settings
  const [aiSettings, setAiSettings] = useState({
    phoneAiEnabled: true,
    aiQuoteGeneration: true,
    autoInvoice: true,
    autoReviewRequest: true,
    retellAgentId: '',
    ollamaModel: 'llama3.2',
  });

  // Notification Settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: true,
    whatsappNotifications: true,
    newJobAlert: true,
    paymentAlert: true,
    reviewAlert: true,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save settings to API
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business: businessSettings,
          pricing: pricingSettings,
          ai: aiSettings,
          notifications: notificationSettings,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure your business and AI settings
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="business" className="space-y-6">
        <TabsList>
          <TabsTrigger value="business" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Business
          </TabsTrigger>
          <TabsTrigger value="pricing" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Pricing
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Features
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Business Settings */}
        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>
                Your company details displayed on invoices and communications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={businessSettings.companyName}
                    onChange={(e) =>
                      setBusinessSettings({ ...businessSettings, companyName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={businessSettings.phone}
                    onChange={(e) =>
                      setBusinessSettings({ ...businessSettings, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={businessSettings.email}
                    onChange={(e) =>
                      setBusinessSettings({ ...businessSettings, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={businessSettings.website}
                    onChange={(e) =>
                      setBusinessSettings({ ...businessSettings, website: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Business Address</Label>
                <Input
                  id="address"
                  value={businessSettings.address}
                  onChange={(e) =>
                    setBusinessSettings({ ...businessSettings, address: e.target.value })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Settings */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Configuration</CardTitle>
              <CardDescription>
                Default rates used for quotes and invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="laborRate">Default Labor Rate ($/hr)</Label>
                  <Input
                    id="laborRate"
                    type="number"
                    value={pricingSettings.defaultLaborRate}
                    onChange={(e) =>
                      setPricingSettings({
                        ...pricingSettings,
                        defaultLaborRate: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxRate">Default Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    value={pricingSettings.defaultTaxRate}
                    onChange={(e) =>
                      setPricingSettings({
                        ...pricingSettings,
                        defaultTaxRate: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quoteValidity">Quote Validity (days)</Label>
                  <Input
                    id="quoteValidity"
                    type="number"
                    value={pricingSettings.quoteValidityDays}
                    onChange={(e) =>
                      setPricingSettings({
                        ...pricingSettings,
                        quoteValidityDays: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoiceDue">Invoice Due (days)</Label>
                  <Input
                    id="invoiceDue"
                    type="number"
                    value={pricingSettings.invoiceDueDays}
                    onChange={(e) =>
                      setPricingSettings({
                        ...pricingSettings,
                        invoiceDueDays: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-4">Urgency Multipliers</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="urgent">Urgent Jobs (multiplier)</Label>
                    <Input
                      id="urgent"
                      type="number"
                      step="0.05"
                      value={pricingSettings.urgentMultiplier}
                      onChange={(e) =>
                        setPricingSettings({
                          ...pricingSettings,
                          urgentMultiplier: parseFloat(e.target.value),
                        })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      +{Math.round((pricingSettings.urgentMultiplier - 1) * 100)}% for urgent jobs
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency">Emergency Jobs (multiplier)</Label>
                    <Input
                      id="emergency"
                      type="number"
                      step="0.05"
                      value={pricingSettings.emergencyMultiplier}
                      onChange={(e) =>
                        setPricingSettings({
                          ...pricingSettings,
                          emergencyMultiplier: parseFloat(e.target.value),
                        })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      +{Math.round((pricingSettings.emergencyMultiplier - 1) * 100)}% for emergencies
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>AI Features</CardTitle>
              <CardDescription>
                Configure AI-powered automation for your business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-blue-500" />
                    <div>
                      <div className="font-medium">Phone AI</div>
                      <div className="text-sm text-muted-foreground">
                        AI answers calls and books appointments
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={aiSettings.phoneAiEnabled}
                    onCheckedChange={(checked) =>
                      setAiSettings({ ...aiSettings, phoneAiEnabled: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bot className="h-5 w-5 text-purple-500" />
                    <div>
                      <div className="font-medium">AI Quote Generation</div>
                      <div className="text-sm text-muted-foreground">
                        Generate quotes from job descriptions
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={aiSettings.aiQuoteGeneration}
                    onCheckedChange={(checked) =>
                      setAiSettings({ ...aiSettings, aiQuoteGeneration: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Receipt className="h-5 w-5 text-green-500" />
                    <div>
                      <div className="font-medium">Auto Invoice</div>
                      <div className="text-sm text-muted-foreground">
                        Automatically send invoices when jobs complete
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={aiSettings.autoInvoice}
                    onCheckedChange={(checked) =>
                      setAiSettings({ ...aiSettings, autoInvoice: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <div>
                      <div className="font-medium">Auto Review Request</div>
                      <div className="text-sm text-muted-foreground">
                        Request Google reviews after job completion
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={aiSettings.autoReviewRequest}
                    onCheckedChange={(checked) =>
                      setAiSettings({ ...aiSettings, autoReviewRequest: checked })
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">API Configuration</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="retellAgent">Retell AI Agent ID</Label>
                    <Input
                      id="retellAgent"
                      placeholder="agent_xxxxxxxxxxxx"
                      value={aiSettings.retellAgentId}
                      onChange={(e) =>
                        setAiSettings({ ...aiSettings, retellAgentId: e.target.value })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      Get from retellai.com dashboard
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ollamaModel">Local AI Model</Label>
                    <Input
                      id="ollamaModel"
                      value={aiSettings.ollamaModel}
                      onChange={(e) =>
                        setAiSettings({ ...aiSettings, ollamaModel: e.target.value })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      Ollama model for quote generation
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium">Channels</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <span>Email</span>
                    <Switch
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          emailNotifications: checked,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <span>SMS</span>
                    <Switch
                      checked={notificationSettings.smsNotifications}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          smsNotifications: checked,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <span>WhatsApp</span>
                    <Switch
                      checked={notificationSettings.whatsappNotifications}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          whatsappNotifications: checked,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Alert Types</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">New Job Alerts</div>
                      <div className="text-sm text-muted-foreground">
                        Get notified when new jobs are created
                      </div>
                    </div>
                    <Switch
                      checked={notificationSettings.newJobAlert}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          newJobAlert: checked,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Payment Alerts</div>
                      <div className="text-sm text-muted-foreground">
                        Get notified when payments are received
                      </div>
                    </div>
                    <Switch
                      checked={notificationSettings.paymentAlert}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          paymentAlert: checked,
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Review Alerts</div>
                      <div className="text-sm text-muted-foreground">
                        Get notified when new reviews are received
                      </div>
                    </div>
                    <Switch
                      checked={notificationSettings.reviewAlert}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          reviewAlert: checked,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
