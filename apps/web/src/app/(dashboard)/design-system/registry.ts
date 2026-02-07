// Murray's Design System — Component Registry
// ==============================================
// Maps each UI component to its props schema for the interactive playground.

export interface PropDef {
  type: 'select' | 'boolean' | 'text' | 'number';
  options?: string[];
  default: unknown;
  label?: string;
}

export interface ComponentEntry {
  name: string;
  category: 'core' | 'form' | 'overlay' | 'layout' | 'data';
  description: string;
  props: Record<string, PropDef>;
  tokens: string[];
}

export const componentRegistry: ComponentEntry[] = [
  // ── Core ──
  {
    name: 'Button',
    category: 'core',
    description: 'Primary action trigger with multiple variants and loading state.',
    props: {
      variant: { type: 'select', options: ['primary', 'secondary', 'danger', 'success', 'outline', 'ghost'], default: 'primary' },
      size: { type: 'select', options: ['sm', 'md', 'lg'], default: 'md' },
      loading: { type: 'boolean', default: false },
      disabled: { type: 'boolean', default: false },
      children: { type: 'text', default: 'Click me' },
    },
    tokens: ['primary', 'primary-hover', 'primary-text', 'danger', 'success', 'surface', 'foreground', 'muted', 'ring'],
  },
  {
    name: 'Badge',
    category: 'core',
    description: 'Status label for categorizing and highlighting information.',
    props: {
      variant: { type: 'select', options: ['default', 'success', 'warning', 'danger', 'error', 'info'], default: 'default' },
      size: { type: 'select', options: ['sm', 'md', 'lg'], default: 'md' },
      children: { type: 'text', default: 'Status' },
    },
    tokens: ['muted', 'foreground', 'success-bg', 'success-text', 'warning-bg', 'warning-text', 'danger-bg', 'danger-text', 'info-bg', 'info-text'],
  },
  {
    name: 'Card',
    category: 'core',
    description: 'Container with border, shadow, and optional header/footer.',
    props: {
      padding: { type: 'select', options: ['none', 'sm', 'md', 'lg'], default: 'md' },
    },
    tokens: ['surface', 'border'],
  },
  {
    name: 'EmptyState',
    category: 'core',
    description: 'Placeholder when no data is available.',
    props: {
      title: { type: 'text', default: 'No items found' },
      description: { type: 'text', default: 'Try adjusting your filters or create a new item.' },
    },
    tokens: ['muted', 'foreground', 'foreground-tertiary'],
  },

  // ── Form ──
  {
    name: 'Input',
    category: 'form',
    description: 'Text input with label, error, and icon support.',
    props: {
      label: { type: 'text', default: 'Email address' },
      placeholder: { type: 'text', default: 'you@example.com' },
      error: { type: 'text', default: '' },
      hint: { type: 'text', default: '' },
      disabled: { type: 'boolean', default: false },
    },
    tokens: ['surface', 'border', 'foreground', 'foreground-secondary', 'danger', 'ring'],
  },
  {
    name: 'Select',
    category: 'form',
    description: 'Dropdown select input.',
    props: {
      disabled: { type: 'boolean', default: false },
    },
    tokens: ['surface', 'border', 'foreground'],
  },
  {
    name: 'Switch',
    category: 'form',
    description: 'Toggle on/off control.',
    props: {
      checked: { type: 'boolean', default: false },
      disabled: { type: 'boolean', default: false },
    },
    tokens: ['primary', 'muted'],
  },
  {
    name: 'Textarea',
    category: 'form',
    description: 'Multi-line text input.',
    props: {
      placeholder: { type: 'text', default: 'Enter description...' },
      disabled: { type: 'boolean', default: false },
    },
    tokens: ['surface', 'border', 'foreground'],
  },

  // ── Data ──
  {
    name: 'Stats',
    category: 'data',
    description: 'Metric cards for dashboards with trend indicators.',
    props: {
      title: { type: 'text', default: 'Total Revenue' },
      value: { type: 'text', default: '$12,450' },
    },
    tokens: ['surface', 'foreground', 'foreground-secondary', 'success', 'danger'],
  },
  {
    name: 'Table',
    category: 'data',
    description: 'Data table with sortable columns.',
    props: {},
    tokens: ['surface', 'border', 'foreground', 'foreground-secondary', 'muted'],
  },
  {
    name: 'Tabs',
    category: 'data',
    description: 'Tab navigation for switching between views.',
    props: {},
    tokens: ['muted', 'surface', 'foreground', 'primary'],
  },

  // ── Overlay ──
  {
    name: 'Modal',
    category: 'overlay',
    description: 'Dialog overlay for focused content.',
    props: {
      title: { type: 'text', default: 'Confirm Action' },
      size: { type: 'select', options: ['sm', 'md', 'lg', 'xl', 'full'], default: 'md' },
    },
    tokens: ['surface', 'overlay', 'border', 'foreground', 'foreground-secondary'],
  },
  {
    name: 'DropdownMenu',
    category: 'overlay',
    description: 'Context menu triggered by a button.',
    props: {},
    tokens: ['surface', 'border', 'foreground', 'muted'],
  },
  {
    name: 'CommandPalette',
    category: 'overlay',
    description: 'Keyboard-driven search and command interface (Ctrl+K).',
    props: {},
    tokens: ['surface', 'border', 'foreground', 'foreground-secondary', 'muted', 'primary'],
  },

  // ── Layout ──
  {
    name: 'Label',
    category: 'form',
    description: 'Accessible form field label.',
    props: {},
    tokens: ['foreground'],
  },
  {
    name: 'Separator',
    category: 'layout',
    description: 'Visual divider between content sections.',
    props: {},
    tokens: ['border'],
  },
  {
    name: 'NotificationBadge',
    category: 'core',
    description: 'Numeric count indicator for alerts and notifications.',
    props: {
      count: { type: 'number', default: 5 },
    },
    tokens: ['danger'],
  },
  {
    name: 'Dialog',
    category: 'overlay',
    description: 'Accessible dialog with trigger, content, header, and footer.',
    props: {},
    tokens: ['surface', 'overlay', 'foreground', 'foreground-secondary', 'muted'],
  },
];
