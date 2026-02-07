'use client';

// Murray's Design System — Live Component Playground
// ====================================================
// This IS the design system. Not a Figma file. Not Storybook.
// Real components, real tokens, interactive props, live preview.

import { useState } from 'react';
import { componentRegistry, type ComponentEntry, type PropDef } from './registry';
import { useTheme } from '@/components/providers/ThemeProvider';
import { semantic, primitives, typography, spacing, radii, shadows } from '@murray-fsm/shared';

// Import all UI components for live rendering
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/Stats';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { NotificationBadge } from '@/components/ui/NotificationBadge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import {
  Sun, Moon, Palette, Type, Maximize, Layers, Grid3x3,
  Briefcase, DollarSign,
} from 'lucide-react';

// ============================================================================
// Component Renderer — renders the actual component with current props
// ============================================================================
function renderComponent(entry: ComponentEntry, propValues: Record<string, unknown>) {
  switch (entry.name) {
    case 'Button':
      return (
        <Button
          variant={propValues.variant as any}
          size={propValues.size as any}
          loading={propValues.loading as boolean}
          disabled={propValues.disabled as boolean}
        >
          {propValues.children as string}
        </Button>
      );
    case 'Badge':
      return (
        <Badge
          variant={propValues.variant as any}
          size={propValues.size as any}
        >
          {propValues.children as string}
        </Badge>
      );
    case 'Card':
      return (
        <Card padding={propValues.padding as any}>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>This is a description of the card content.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-foreground-secondary text-sm">Card body content goes here.</p>
          </CardContent>
        </Card>
      );
    case 'Input':
      return (
        <div className="w-full max-w-sm">
          <Input
            label={propValues.label as string}
            placeholder={propValues.placeholder as string}
            error={propValues.error as string || undefined}
            hint={propValues.hint as string || undefined}
            disabled={propValues.disabled as boolean}
          />
        </div>
      );
    case 'EmptyState':
      return (
        <EmptyState
          title={propValues.title as string}
          description={propValues.description as string}
        />
      );
    case 'Stats':
      return (
        <StatCard
          title={propValues.title as string}
          value={propValues.value as string}
          icon={DollarSign}
          trend={{ value: 12, label: 'vs last month' }}
        />
      );
    case 'Switch':
      return (
        <div className="flex items-center gap-3">
          <Switch checked={propValues.checked as boolean} disabled={propValues.disabled as boolean} />
          <Label>{propValues.checked ? 'On' : 'Off'}</Label>
        </div>
      );
    case 'Textarea':
      return (
        <div className="w-full max-w-sm">
          <Textarea placeholder={propValues.placeholder as string} disabled={propValues.disabled as boolean} />
        </div>
      );
    case 'Tabs':
      return (
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Overview</TabsTrigger>
            <TabsTrigger value="tab2">Details</TabsTrigger>
            <TabsTrigger value="tab3">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1"><p className="text-foreground-secondary text-sm">Overview content</p></TabsContent>
          <TabsContent value="tab2"><p className="text-foreground-secondary text-sm">Details content</p></TabsContent>
          <TabsContent value="tab3"><p className="text-foreground-secondary text-sm">Settings content</p></TabsContent>
        </Tabs>
      );
    case 'Modal':
      return (
        <div className="w-full max-w-lg border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">{propValues.title as string}</h2>
            <p className="mt-1 text-sm text-foreground-secondary">Modal body description goes here.</p>
          </div>
          <div className="px-6 py-4">
            <p className="text-foreground-secondary text-sm">This is a static preview. The real Modal component renders as an overlay.</p>
          </div>
          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
            <Button variant="outline" size="sm">Cancel</Button>
            <Button variant="primary" size="sm">Confirm</Button>
          </div>
        </div>
      );
    case 'Label':
      return <Label>Form field label</Label>;
    case 'Separator':
      return (
        <div className="w-full space-y-4">
          <p className="text-sm text-foreground">Content above</p>
          <Separator />
          <p className="text-sm text-foreground">Content below</p>
        </div>
      );
    case 'NotificationBadge':
      return (
        <div className="flex items-center gap-4">
          <NotificationBadge count={3} />
          <NotificationBadge count={42} />
          <NotificationBadge count={100} />
        </div>
      );
    default:
      return <div className="text-foreground-secondary italic">Preview not available for {entry.name}</div>;
  }
}

// ============================================================================
// Prop Control Panel
// ============================================================================
function PropControls({
  props,
  values,
  onChange,
}: {
  props: Record<string, PropDef>;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-3">
      {Object.entries(props).map(([key, def]) => (
        <div key={key}>
          <label className="block text-xs font-medium text-foreground-secondary mb-1">
            {def.label || key}
          </label>
          {def.type === 'select' && (
            <select
              className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-surface text-foreground"
              value={values[key] as string}
              onChange={(e) => onChange(key, e.target.value)}
            >
              {def.options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}
          {def.type === 'boolean' && (
            <button
              className={`px-3 py-1 text-xs rounded-md border ${
                values[key] ? 'bg-primary text-primary-text border-primary' : 'bg-surface text-foreground border-border'
              }`}
              onClick={() => onChange(key, !values[key])}
            >
              {values[key] ? 'true' : 'false'}
            </button>
          )}
          {def.type === 'text' && (
            <input
              type="text"
              className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-surface text-foreground"
              value={values[key] as string}
              onChange={(e) => onChange(key, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Code Snippet Generator
// ============================================================================
function CodeSnippet({ entry, values }: { entry: ComponentEntry; values: Record<string, unknown> }) {
  const propsStr = Object.entries(values)
    .filter(([key, val]) => {
      const def = entry.props[key];
      return val !== def?.default;
    })
    .map(([key, val]) => {
      if (key === 'children') return null;
      if (typeof val === 'boolean') return val ? key : null;
      return `${key}="${val}"`;
    })
    .filter(Boolean)
    .join(' ');

  const children = values.children as string || '';
  const hasChildren = 'children' in entry.props;
  const code = hasChildren
    ? `<${entry.name}${propsStr ? ' ' + propsStr : ''}>${children}</${entry.name}>`
    : `<${entry.name}${propsStr ? ' ' + propsStr : ''} />`;

  return (
    <pre className="bg-muted rounded-lg p-3 text-xs text-foreground overflow-x-auto font-mono">
      <code>{code}</code>
    </pre>
  );
}

// ============================================================================
// Token Swatch Grid
// ============================================================================
function TokenSwatches() {
  const colorEntries = Object.entries(semantic.light);
  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Palette className="w-5 h-5" /> Semantic Colors
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {colorEntries.map(([name, value]) => (
          <div key={name} className="space-y-1">
            <div
              className="w-full h-12 rounded-lg border border-border shadow-sm"
              style={{ backgroundColor: value }}
            />
            <p className="text-xs font-medium text-foreground truncate">{name}</p>
            <p className="text-xs text-foreground-tertiary font-mono">{value}</p>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-semibold text-foreground mt-8 mb-4 flex items-center gap-2">
        <Palette className="w-5 h-5" /> Blue Palette
      </h3>
      <div className="flex gap-1 rounded-lg overflow-hidden">
        {Object.entries(primitives.blue).map(([shade, hex]) => (
          <div key={shade} className="flex-1 text-center">
            <div className="h-16" style={{ backgroundColor: hex }} />
            <p className="text-xs text-foreground-secondary mt-1">{shade}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Typography Reference
// ============================================================================
function TypographyReference() {
  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Type className="w-5 h-5" /> Typography Scale
      </h3>
      <div className="space-y-3">
        {Object.entries(typography.fontSize).map(([name, size]) => (
          <div key={name} className="flex items-baseline gap-4 border-b border-borderSubtle pb-2">
            <span className="text-xs text-foreground-tertiary w-12 font-mono">{name}</span>
            <span className="text-xs text-foreground-tertiary w-20 font-mono">{size}</span>
            <span style={{ fontSize: size }} className="text-foreground">
              The quick brown fox jumps over the lazy dog
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Spacing Reference
// ============================================================================
function SpacingReference() {
  const displayEntries = Object.entries(spacing).filter(([k]) => !k.includes('.'));
  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Maximize className="w-5 h-5" /> Spacing Scale (4px grid)
      </h3>
      <div className="space-y-2">
        {displayEntries.map(([name, value]) => (
          <div key={name} className="flex items-center gap-4">
            <span className="text-xs text-foreground-tertiary w-8 font-mono text-right">{name}</span>
            <span className="text-xs text-foreground-tertiary w-12 font-mono">{value}</span>
            <div
              className="h-4 bg-primary rounded-sm"
              style={{ width: value }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Shadows + Radii Reference
// ============================================================================
function ShadowsRadiiReference() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5" /> Shadows
        </h3>
        <div className="space-y-4">
          {Object.entries(shadows).map(([name, value]) => (
            <div key={name} className="flex items-center gap-4">
              <div
                className="w-24 h-16 bg-surface rounded-lg"
                style={{ boxShadow: value }}
              />
              <div>
                <p className="text-sm font-medium text-foreground">{name}</p>
                <p className="text-xs text-foreground-tertiary font-mono max-w-xs truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Grid3x3 className="w-5 h-5" /> Border Radii
        </h3>
        <div className="space-y-4">
          {Object.entries(radii).map(([name, value]) => (
            <div key={name} className="flex items-center gap-4">
              <div
                className="w-16 h-16 bg-primary"
                style={{ borderRadius: value }}
              />
              <div>
                <p className="text-sm font-medium text-foreground">{name}</p>
                <p className="text-xs text-foreground-tertiary font-mono">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================
type Tab = 'components' | 'tokens' | 'typography' | 'spacing' | 'shadows';

export default function DesignSystemPage() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('components');
  const [selectedComponent, setSelectedComponent] = useState<ComponentEntry>(componentRegistry[0]);
  const [propValues, setPropValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(componentRegistry[0].props)) {
      initial[key] = def.default;
    }
    return initial;
  });

  const selectComponent = (entry: ComponentEntry) => {
    setSelectedComponent(entry);
    const initial: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(entry.props)) {
      initial[key] = def.default;
    }
    setPropValues(initial);
  };

  const categories = Array.from(new Set(componentRegistry.map((c) => c.category)));

  const tabs: { id: Tab; label: string }[] = [
    { id: 'components', label: 'Components' },
    { id: 'tokens', label: 'Colors' },
    { id: 'typography', label: 'Typography' },
    { id: 'spacing', label: 'Spacing' },
    { id: 'shadows', label: 'Shadows & Radii' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-surface sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Murray&apos;s Design System</h1>
            <p className="text-sm text-foreground-secondary">Live component playground &amp; token reference</p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-border bg-surface hover:bg-muted transition-colors"
            title={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
          >
            {resolvedTheme === 'light' ? <Moon className="w-5 h-5 text-foreground" /> : <Sun className="w-5 h-5 text-foreground" />}
          </button>
        </div>

        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-background text-foreground border-t border-l border-r border-border -mb-px'
                  : 'text-foreground-secondary hover:text-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* ── Components Tab ── */}
        {activeTab === 'components' && (
          <div className="grid grid-cols-12 gap-6">
            {/* Left: Component list */}
            <div className="col-span-3">
              <div className="sticky top-32 space-y-4">
                {categories.map((cat) => (
                  <div key={cat}>
                    <h4 className="text-xs font-semibold text-foreground-tertiary uppercase tracking-wider mb-2">
                      {cat}
                    </h4>
                    <div className="space-y-0.5">
                      {componentRegistry
                        .filter((c) => c.category === cat)
                        .map((entry) => (
                          <button
                            key={entry.name}
                            onClick={() => selectComponent(entry)}
                            className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
                              selectedComponent.name === entry.name
                                ? 'bg-primary text-primary-text font-medium'
                                : 'text-foreground hover:bg-muted'
                            }`}
                          >
                            {entry.name}
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Center: Live preview */}
            <div className="col-span-6 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{selectedComponent.name}</h2>
                <p className="text-sm text-foreground-secondary mt-1">{selectedComponent.description}</p>
              </div>

              {/* Preview area */}
              <div className="bg-surface border border-border rounded-xl p-8 flex items-center justify-center min-h-[200px]">
                {renderComponent(selectedComponent, propValues)}
              </div>

              {/* Code snippet */}
              <div>
                <h4 className="text-xs font-semibold text-foreground-tertiary uppercase tracking-wider mb-2">Code</h4>
                <CodeSnippet entry={selectedComponent} values={propValues} />
              </div>

              {/* Tokens used */}
              <div>
                <h4 className="text-xs font-semibold text-foreground-tertiary uppercase tracking-wider mb-2">
                  Design Tokens Used
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedComponent.tokens.map((token) => (
                    <span
                      key={token}
                      className="px-2 py-1 text-xs font-mono rounded-md bg-muted text-foreground-secondary border border-borderSubtle"
                    >
                      --color-{token}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Props panel */}
            <div className="col-span-3">
              <div className="sticky top-32">
                <h4 className="text-xs font-semibold text-foreground-tertiary uppercase tracking-wider mb-3">
                  Props
                </h4>
                {Object.keys(selectedComponent.props).length > 0 ? (
                  <PropControls
                    props={selectedComponent.props}
                    values={propValues}
                    onChange={(key, value) => setPropValues((prev) => ({ ...prev, [key]: value }))}
                  />
                ) : (
                  <p className="text-sm text-foreground-tertiary italic">No configurable props</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Tokens Tab ── */}
        {activeTab === 'tokens' && <TokenSwatches />}

        {/* ── Typography Tab ── */}
        {activeTab === 'typography' && <TypographyReference />}

        {/* ── Spacing Tab ── */}
        {activeTab === 'spacing' && <SpacingReference />}

        {/* ── Shadows Tab ── */}
        {activeTab === 'shadows' && <ShadowsRadiiReference />}
      </div>
    </div>
  );
}
