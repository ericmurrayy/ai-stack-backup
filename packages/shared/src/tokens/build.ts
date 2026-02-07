#!/usr/bin/env tsx
// Murray's Design System — Token Build Script
// =============================================
// Reads token source files, generates:
//   1. dist/tokens.css     — CSS custom properties (:root + .dark)
//   2. dist/tailwind-tokens.ts — Tailwind color config extension
//   3. dist/tokens-native.ts   — React Native token objects
//
// Run: pnpm tokens:build  (or: npx tsx packages/shared/src/tokens/build.ts)

import * as fs from 'fs';
import * as path from 'path';
import { semantic } from './colors';
import { typography } from './typography';
import { typographyNative } from './typography';
import { spacing, spacingNative } from './spacing';
import { radii, radiiNative } from './radii';
import { shadows, shadowsNative } from './shadows';
import { transitions, transitionsNative } from './transitions';

const distDir = path.resolve(__dirname, '../../dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// ============================================================================
// 1. Generate tokens.css
// ============================================================================
function buildCSS(): string {
  const lines: string[] = [
    '/* Murray\'s Design System — Generated Tokens */',
    '/* DO NOT EDIT — regenerate with: pnpm tokens:build */',
    '',
    ':root {',
  ];

  // Semantic colors (light mode)
  for (const [key, value] of Object.entries(semantic.light)) {
    lines.push(`  --color-${key}: ${value};`);
  }
  lines.push('');

  // Typography
  for (const [key, value] of Object.entries(typography.fontFamily)) {
    lines.push(`  --font-${key}: ${value};`);
  }
  for (const [key, value] of Object.entries(typography.fontSize)) {
    lines.push(`  --text-${key}: ${value};`);
  }
  lines.push('');

  // Spacing
  for (const [key, value] of Object.entries(spacing)) {
    lines.push(`  --space-${key}: ${value};`);
  }
  lines.push('');

  // Radii
  for (const [key, value] of Object.entries(radii)) {
    lines.push(`  --radius-${key}: ${value};`);
  }
  lines.push('');

  // Shadows
  for (const [key, value] of Object.entries(shadows)) {
    lines.push(`  --shadow-${key}: ${value};`);
  }
  lines.push('');

  // Transitions
  for (const [key, value] of Object.entries(transitions)) {
    lines.push(`  --transition-${key}: ${value};`);
  }

  lines.push('}');
  lines.push('');

  // Dark mode overrides
  lines.push('.dark {');
  for (const [key, value] of Object.entries(semantic.dark)) {
    lines.push(`  --color-${key}: ${value};`);
  }
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// 2. Generate tailwind-tokens.ts
// ============================================================================
function buildTailwindTokens(): string {
  const colorEntries: Record<string, string | Record<string, string>> = {};

  // Map semantic color names to CSS variables
  // Group by prefix (e.g., primary, primary-hover, primary-text → primary: { DEFAULT, hover, text })
  const groups: Record<string, Record<string, string>> = {};
  const standalone: Record<string, string> = {};

  for (const key of Object.keys(semantic.light)) {
    const parts = key.split('-');
    if (parts.length === 1) {
      // Standalone: background, surface, border, foreground, muted, etc.
      standalone[key] = `var(--color-${key})`;
    } else {
      // Grouped: primary-hover → primary.hover
      const group = parts[0];
      const sub = parts.slice(1).join('-');
      if (!groups[group]) groups[group] = {};
      groups[group][sub] = `var(--color-${key})`;
    }
  }

  // Merge standalone + groups
  for (const [key, value] of Object.entries(standalone)) {
    if (groups[key]) {
      // Has sub-values: add DEFAULT
      colorEntries[key] = { DEFAULT: value, ...groups[key] };
      delete groups[key];
    } else {
      colorEntries[key] = value;
    }
  }

  // Remaining groups that don't have a standalone entry
  for (const [key, subs] of Object.entries(groups)) {
    colorEntries[key] = subs;
  }

  const lines: string[] = [
    '// Murray\'s Design System — Tailwind Token Extension',
    '// DO NOT EDIT — regenerate with: pnpm tokens:build',
    '',
    'export const tokenColors = ' + JSON.stringify(colorEntries, null, 2)
      .replace(/"([^"]+)":/g, "'$1':") // single quotes for keys
      .replace(/"/g, "'") // single quotes for values
    + ' as const;',
    '',
    'export const tokenBorderRadius = {',
  ];

  for (const [key, value] of Object.entries(radii)) {
    lines.push(`  '${key}': '${value}',`);
  }
  lines.push('} as const;');
  lines.push('');

  lines.push('export const tokenBoxShadow = {');
  for (const [key, value] of Object.entries(shadows)) {
    lines.push(`  '${key}': '${value}',`);
  }
  lines.push('} as const;');
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// 3. Generate tokens-native.ts
// ============================================================================
function buildNativeTokens(): string {
  const lines: string[] = [
    '// Murray\'s Design System — React Native Tokens',
    '// DO NOT EDIT — regenerate with: pnpm tokens:build',
    '',
    'export const nativeTokens = {',
    '  colors: ' + JSON.stringify(semantic.light, null, 4).replace(/^/gm, '  ').trim() + ',',
    '  spacing: ' + JSON.stringify(spacingNative, null, 4).replace(/^/gm, '  ').trim() + ',',
    '  radii: ' + JSON.stringify(radiiNative, null, 4).replace(/^/gm, '  ').trim() + ',',
    '  fontSize: ' + JSON.stringify(typographyNative.fontSize, null, 4).replace(/^/gm, '  ').trim() + ',',
    '  fontWeight: ' + JSON.stringify(typographyNative.fontWeight, null, 4).replace(/^/gm, '  ').trim() + ',',
    '  fontFamily: ' + JSON.stringify(typographyNative.fontFamily, null, 4).replace(/^/gm, '  ').trim() + ',',
    '  shadows: ' + JSON.stringify(shadowsNative, null, 4).replace(/^/gm, '  ').trim() + ',',
    '  transitions: ' + JSON.stringify(transitionsNative, null, 4).replace(/^/gm, '  ').trim() + ',',
    '} as const;',
    '',
    '// Dark mode: only colors change. Spread nativeTokens for the rest.',
    '// Usage: const theme = isDark ? { ...nativeTokens, colors: nativeColorsDark } : nativeTokens;',
    'export const nativeColorsDark = ' + JSON.stringify(semantic.dark, null, 2) + ' as const;',
    '',
    'export type NativeTokens = typeof nativeTokens;',
    '',
  ];

  return lines.join('\n');
}

// ============================================================================
// Run all builds
// ============================================================================
function main() {
  console.log('Building Murray\'s Design System tokens...\n');

  // 1. CSS
  const css = buildCSS();
  fs.writeFileSync(path.join(distDir, 'tokens.css'), css, 'utf-8');
  console.log('  ✓ dist/tokens.css');

  // 2. Tailwind extension
  const tw = buildTailwindTokens();
  fs.writeFileSync(path.join(distDir, 'tailwind-tokens.ts'), tw, 'utf-8');
  console.log('  ✓ dist/tailwind-tokens.ts');

  // 3. React Native tokens
  const rn = buildNativeTokens();
  fs.writeFileSync(path.join(distDir, 'tokens-native.ts'), rn, 'utf-8');
  console.log('  ✓ dist/tokens-native.ts');

  console.log('\nDone! Token artifacts written to packages/shared/dist/');
}

main();
