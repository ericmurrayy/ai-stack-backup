import { describe, it, expect } from 'vitest';
import {
  generateApiKey,
  hashApiKey,
  isValidApiKeyFormat,
  hasScope,
  hasAnyScope,
  hasAllScopes,
  createInMemoryRateLimiter,
  API_SCOPE_DESCRIPTIONS,
  SCOPE_CATEGORIES,
  API_KEY_PRESETS,
  type ApiKeyScope,
} from './api-keys';

// ============================================================================
// API Key Generation
// ============================================================================

describe('generateApiKey', () => {
  it('generates key with mfsm_ prefix', () => {
    const { key } = generateApiKey();
    expect(key).toMatch(/^mfsm_/);
  });

  it('generates key of correct length', () => {
    const { key } = generateApiKey();
    // mfsm_ (5) + 64 hex chars = 69
    expect(key.length).toBe(69);
  });

  it('generates unique keys', () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1.key).not.toBe(key2.key);
    expect(key1.keyHash).not.toBe(key2.keyHash);
  });

  it('returns keyPrefix as first 12 chars', () => {
    const { key, keyPrefix } = generateApiKey();
    expect(keyPrefix).toBe(key.substring(0, 12));
  });

  it('returns a valid hash', () => {
    const { key, keyHash } = generateApiKey();
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 = 64 hex chars
    expect(keyHash).toBe(hashApiKey(key));
  });
});

describe('hashApiKey', () => {
  it('produces consistent hash', () => {
    const key = 'mfsm_test123';
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  it('produces different hashes for different keys', () => {
    expect(hashApiKey('mfsm_a')).not.toBe(hashApiKey('mfsm_b'));
  });
});

describe('isValidApiKeyFormat', () => {
  it('accepts valid format', () => {
    const { key } = generateApiKey();
    expect(isValidApiKeyFormat(key)).toBe(true);
  });

  it('rejects wrong prefix', () => {
    expect(isValidApiKeyFormat('wrong_' + 'a'.repeat(64))).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidApiKeyFormat('mfsm_tooshort')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidApiKeyFormat('')).toBe(false);
  });
});

// ============================================================================
// Scope Management
// ============================================================================

describe('hasScope', () => {
  it('grants exact scope', () => {
    expect(hasScope(['read:jobs'], 'read:jobs')).toBe(true);
  });

  it('denies missing scope', () => {
    expect(hasScope(['read:jobs'], 'write:jobs')).toBe(false);
  });

  it('admin grants all scopes', () => {
    expect(hasScope(['admin'], 'read:jobs')).toBe(true);
    expect(hasScope(['admin'], 'write:customers')).toBe(true);
    expect(hasScope(['admin'], 'manage:settings')).toBe(true);
  });

  it('write implies read', () => {
    expect(hasScope(['write:jobs'], 'read:jobs')).toBe(true);
    expect(hasScope(['write:customers'], 'read:customers')).toBe(true);
  });

  it('read does not imply write', () => {
    expect(hasScope(['read:jobs'], 'write:jobs')).toBe(false);
  });
});

describe('hasAnyScope', () => {
  it('returns true if any scope matches', () => {
    expect(hasAnyScope(['read:jobs'], ['read:jobs', 'write:jobs'])).toBe(true);
  });

  it('returns false if no scopes match', () => {
    expect(hasAnyScope(['read:customers'], ['read:jobs', 'write:jobs'])).toBe(false);
  });
});

describe('hasAllScopes', () => {
  it('returns true if all scopes match', () => {
    expect(hasAllScopes(['read:jobs', 'read:customers'], ['read:jobs', 'read:customers'])).toBe(true);
  });

  it('returns false if any scope missing', () => {
    expect(hasAllScopes(['read:jobs'], ['read:jobs', 'read:customers'])).toBe(false);
  });

  it('admin satisfies all scopes', () => {
    expect(hasAllScopes(['admin'], ['read:jobs', 'write:customers', 'manage:settings'])).toBe(true);
  });
});

// ============================================================================
// Rate Limiter
// ============================================================================

describe('createInMemoryRateLimiter', () => {
  it('allows initial requests', async () => {
    const limiter = createInMemoryRateLimiter();
    const result = await limiter.check('test-key');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(100);
  });

  it('decrements remaining after increment', async () => {
    const limiter = createInMemoryRateLimiter();
    await limiter.increment('test-key');
    const result = await limiter.check('test-key');
    expect(result.remaining).toBe(99);
  });

  it('reset clears the counter', async () => {
    const limiter = createInMemoryRateLimiter();
    await limiter.increment('test-key');
    await limiter.increment('test-key');
    await limiter.reset('test-key');
    const result = await limiter.check('test-key');
    expect(result.remaining).toBe(100);
  });
});

// ============================================================================
// Constants
// ============================================================================

describe('API_SCOPE_DESCRIPTIONS', () => {
  it('has description for every scope', () => {
    const scopes: ApiKeyScope[] = [
      'read:jobs', 'write:jobs', 'read:customers', 'write:customers',
      'read:invoices', 'write:invoices', 'read:estimates', 'write:estimates',
      'read:team', 'write:team', 'read:analytics', 'manage:webhooks',
      'manage:settings', 'admin',
    ];
    for (const scope of scopes) {
      expect(API_SCOPE_DESCRIPTIONS[scope]).toBeTruthy();
    }
  });
});

describe('SCOPE_CATEGORIES', () => {
  it('categorizes all scopes', () => {
    const allScopes = Object.values(SCOPE_CATEGORIES).flat();
    expect(allScopes.length).toBeGreaterThan(0);
    // Every scope in categories should be in descriptions
    for (const scope of allScopes) {
      expect(API_SCOPE_DESCRIPTIONS[scope]).toBeTruthy();
    }
  });
});

describe('API_KEY_PRESETS', () => {
  it('has required presets', () => {
    expect(API_KEY_PRESETS['read-only']).toBeDefined();
    expect(API_KEY_PRESETS['technician-app']).toBeDefined();
    expect(API_KEY_PRESETS['full-access']).toBeDefined();
  });

  it('full-access uses admin scope', () => {
    expect(API_KEY_PRESETS['full-access'].scopes).toContain('admin');
  });

  it('read-only has no write scopes', () => {
    const writeScopes = API_KEY_PRESETS['read-only'].scopes.filter(s => s.startsWith('write:'));
    expect(writeScopes).toHaveLength(0);
  });
});
