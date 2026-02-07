import type { Config } from 'tailwindcss';
import { tokenColors, tokenBorderRadius, tokenBoxShadow } from '../../packages/shared/dist/tailwind-tokens';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Legacy numeric scale (primary-50 through primary-950)
        // Keep for backward compat until all components are migrated to semantic tokens.
        // After Phase 4 migration, these can be removed.
        primary: {
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
          // Semantic overrides (token-based) — these take priority for:
          //   bg-primary  → var(--color-primary)
          //   bg-primary-hover → var(--color-primary-hover)
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          text: 'var(--color-primary-text)',
          light: 'var(--color-primary-light)',
        },

        // Semantic token colors from the design system
        background: tokenColors.background,
        surface: tokenColors.surface,
        surfaceRaised: tokenColors.surfaceRaised,
        muted: tokenColors.muted,
        border: tokenColors.border,
        borderSubtle: tokenColors.borderSubtle,
        borderStrong: tokenColors.borderStrong,
        foreground: tokenColors.foreground,
        accent: tokenColors.accent,
        success: tokenColors.success,
        warning: tokenColors.warning,
        danger: tokenColors.danger,
        info: tokenColors.info,
        overlay: tokenColors.overlay,
        ring: tokenColors.ring,
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        ...tokenBorderRadius,
      },
      boxShadow: {
        ...tokenBoxShadow,
      },
    },
  },
  plugins: [],
};

export default config;
