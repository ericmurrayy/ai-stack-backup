// Murray's FSM - Branding Settings
// ===================================
// Customer-facing portal colors, logo, and email template customization

'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Palette,
  ArrowLeft,
  Save,
  CheckCircle,
  Mail,
  Globe,
  Eye,
  Type,
  Upload,
} from 'lucide-react';
import Link from 'next/link';

export default function BrandingPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#1e40af');
  const [accentColor, setAccentColor] = useState('#059669');
  const [logoText, setLogoText] = useState("Murray's Garage Doors");
  const [tagline, setTagline] = useState('Professional Service You Can Trust');
  const [emailHeader, setEmailHeader] = useState('Thanks for choosing us!');
  const [emailFooter, setEmailFooter] = useState('Murray\'s Garage Door Service · Atlanta, GA · (404) 555-0199');

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
  };

  return (
    <div>
      <Header title="Branding & Appearance" />

      <div className="p-6 space-y-6 max-w-4xl">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        {/* Brand Colors */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-pink-50 rounded-xl">
                <Palette className="w-5 h-5 text-pink-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Brand Colors</h2>
                <p className="text-sm text-slate-500">Used on booking page, portal, and emails</p>
              </div>
            </div>
            <Button onClick={handleSave} loading={saving} size="sm">
              {saved ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Primary Color</label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  aria-label="Primary brand color"
                  className="w-12 h-12 rounded-lg border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  aria-label="Primary color hex"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono w-32"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Accent Color</label>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  aria-label="Accent brand color"
                  className="w-12 h-12 rounded-lg border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  aria-label="Accent color hex"
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono w-32"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-6 p-4 border border-slate-200 rounded-xl bg-slate-50">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Preview</div>
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-4" style={{ backgroundColor: primaryColor }}>
                <span className="text-white font-bold text-lg">{logoText || "Murray's Garage Doors"}</span>
              </div>
              <div className="p-4 text-center">
                <p className="text-slate-600">Your estimate is ready</p>
                <button
                  className="mt-3 px-6 py-2 text-white rounded-lg font-medium"
                  style={{ backgroundColor: accentColor }}
                >
                  View Estimate
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Logo & Identity */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Type className="w-5 h-5 text-slate-600" />
            Logo & Identity
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="logoText" className="block text-sm font-medium text-slate-700 mb-1">
                Business Name
              </label>
              <input
                id="logoText"
                type="text"
                value={logoText}
                onChange={(e) => setLogoText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="tagline" className="block text-sm font-medium text-slate-700 mb-1">
                Tagline
              </label>
              <input
                id="tagline"
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Logo</label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Click to upload or drag and drop</p>
                <p className="text-xs text-slate-400 mt-1">PNG, SVG, or JPG (max 2MB)</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Email Templates */}
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-slate-600" />
            Email Templates
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="emailHeader" className="block text-sm font-medium text-slate-700 mb-1">
                Email Header Text
              </label>
              <input
                id="emailHeader"
                type="text"
                value={emailHeader}
                onChange={(e) => setEmailHeader(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="emailFooter" className="block text-sm font-medium text-slate-700 mb-1">
                Email Footer
              </label>
              <textarea
                id="emailFooter"
                value={emailFooter}
                onChange={(e) => setEmailFooter(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
