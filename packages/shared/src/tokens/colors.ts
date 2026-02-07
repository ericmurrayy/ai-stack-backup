// Murray's Design System — Color Tokens
// ========================================
// Source of truth for all colors across web, mobile, and marketing site.
// Primitives are the raw palette. Semantic tokens map meaning to colors.

export const primitives = {
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
  },
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
    950: '#3b0764',
  },
  white: '#ffffff',
  black: '#000000',
} as const;

export const semantic = {
  light: {
    // Backgrounds
    background: primitives.slate[50],
    surface: primitives.white,
    surfaceRaised: primitives.white,
    muted: primitives.slate[100],

    // Borders
    border: primitives.slate[200],
    borderSubtle: primitives.slate[100],
    borderStrong: primitives.slate[300],

    // Text
    foreground: primitives.slate[900],
    'foreground-secondary': primitives.slate[500],
    'foreground-tertiary': primitives.slate[400],

    // Primary (Murray's blue)
    primary: primitives.blue[800],
    'primary-hover': primitives.blue[900],
    'primary-text': primitives.white,
    'primary-light': primitives.blue[100],

    // Accent (amber)
    accent: primitives.amber[500],
    'accent-hover': primitives.amber[600],
    'accent-text': primitives.white,

    // Status: Success
    success: primitives.green[600],
    'success-bg': primitives.green[100],
    'success-text': primitives.green[800],

    // Status: Warning
    warning: primitives.amber[500],
    'warning-bg': primitives.amber[100],
    'warning-text': primitives.amber[800],

    // Status: Danger
    danger: primitives.red[600],
    'danger-bg': primitives.red[100],
    'danger-text': primitives.red[800],

    // Status: Info
    info: primitives.blue[600],
    'info-bg': primitives.blue[100],
    'info-text': primitives.blue[800],

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.5)',

    // Focus ring
    ring: primitives.blue[500],
  },
  dark: {
    // Backgrounds
    background: primitives.slate[950],
    surface: primitives.slate[900],
    surfaceRaised: primitives.slate[800],
    muted: primitives.slate[800],

    // Borders
    border: primitives.slate[700],
    borderSubtle: primitives.slate[800],
    borderStrong: primitives.slate[600],

    // Text
    foreground: primitives.slate[50],
    'foreground-secondary': primitives.slate[400],
    'foreground-tertiary': primitives.slate[500],

    // Primary
    primary: primitives.blue[500],
    'primary-hover': primitives.blue[400],
    'primary-text': primitives.white,
    'primary-light': primitives.blue[950],

    // Accent
    accent: primitives.amber[400],
    'accent-hover': primitives.amber[300],
    'accent-text': primitives.black,

    // Status: Success
    success: primitives.green[400],
    'success-bg': primitives.green[950],
    'success-text': primitives.green[300],

    // Status: Warning
    warning: primitives.amber[400],
    'warning-bg': primitives.amber[950],
    'warning-text': primitives.amber[300],

    // Status: Danger
    danger: primitives.red[400],
    'danger-bg': primitives.red[950],
    'danger-text': primitives.red[300],

    // Status: Info
    info: primitives.blue[400],
    'info-bg': primitives.blue[950],
    'info-text': primitives.blue[300],

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.7)',

    // Focus ring
    ring: primitives.blue[400],
  },
} as const;

export type SemanticColorKey = keyof typeof semantic.light;
