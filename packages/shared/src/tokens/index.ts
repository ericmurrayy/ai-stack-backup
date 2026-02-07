// Murray's Design System — Token Index
// ======================================
// Re-exports all tokens as a unified object.

export { primitives, semantic, type SemanticColorKey } from './colors';
export { typography, typographyNative } from './typography';
export { spacing, spacingNative } from './spacing';
export { radii, radiiNative } from './radii';
export { shadows, shadowsNative } from './shadows';
export { transitions, transitionsNative } from './transitions';

// Convenience: all tokens in one object
import { primitives, semantic } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { radii } from './radii';
import { shadows } from './shadows';
import { transitions } from './transitions';

export const tokens = {
  colors: { primitives, semantic },
  typography,
  spacing,
  radii,
  shadows,
  transitions,
} as const;
