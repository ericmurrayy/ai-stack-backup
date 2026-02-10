// Murray's FSM - API Key Management
// ==================================
// Secure API key generation and validation

import crypto from 'crypto';

// ============================================================================
// API Key Types
// ============================================================================

export type ApiKeyScope =
  | 'read:jobs'
  | 'write:jobs'
  | 'read:customers'
  | 'write:customers'
  | 'read:invoices'
  | 'write:invoices'
  | 'read:estimates'
  | 'write:estimates'
  | 'read:leads'
  | 'write:leads'
  | 'read:team'
  | 'write:team'
  | 'read:analytics'
  | 'manage:webhooks'
  | 'manage:settings'
  | 'admin';

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string; // First 8 chars for display (e.g., "mfsm_abc...")
  key_hash: string; // SHA-256 hash of full key
  scopes: ApiKeyScope[];
  created_by: string;
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
  is_active: boolean;
  rate_limit_per_minute: number;
  allowed_ips?: string[];
  description?: string;
}

export interface ApiKeyUsage {
  id: string;
  api_key_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  ip_address: string;
  user_agent?: string;
  created_at: string;
}

export interface GeneratedApiKey {
  key: string; // Full key (only shown once)
  keyPrefix: string;
  keyHash: string;
}

// ============================================================================
// API Key Generation
// ============================================================================

const API_KEY_PREFIX = 'mfsm_'; // Murray's FSM prefix
const API_KEY_LENGTH = 32; // 32 random bytes = 64 hex chars

/**
 * Generate a new API key
 */
export function generateApiKey(): GeneratedApiKey {
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH);
  const key = `${API_KEY_PREFIX}${randomBytes.toString('hex')}`;
  const keyPrefix = key.substring(0, 12); // "mfsm_" + first 7 chars
  const keyHash = hashApiKey(key);

  return { key, keyPrefix, keyHash };
}

/**
 * Hash an API key for storage
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  return key.startsWith(API_KEY_PREFIX) && key.length === API_KEY_PREFIX.length + (API_KEY_LENGTH * 2);
}

// ============================================================================
// Scope Management
// ============================================================================

export const API_SCOPE_DESCRIPTIONS: Record<ApiKeyScope, string> = {
  'read:jobs': 'View jobs and job details',
  'write:jobs': 'Create and modify jobs',
  'read:customers': 'View customer information',
  'write:customers': 'Create and modify customers',
  'read:invoices': 'View invoices',
  'write:invoices': 'Create and modify invoices',
  'read:estimates': 'View estimates',
  'write:estimates': 'Create and modify estimates',
  'read:leads': 'View leads and pipeline',
  'write:leads': 'Create and modify leads',
  'read:team': 'View team members',
  'write:team': 'Manage team members',
  'read:analytics': 'View analytics and reports',
  'manage:webhooks': 'Manage webhook endpoints',
  'manage:settings': 'Manage business settings',
  'admin': 'Full administrative access',
};

export const SCOPE_CATEGORIES = {
  Jobs: ['read:jobs', 'write:jobs'] as ApiKeyScope[],
  Customers: ['read:customers', 'write:customers'] as ApiKeyScope[],
  Financial: ['read:invoices', 'write:invoices', 'read:estimates', 'write:estimates'] as ApiKeyScope[],
  Leads: ['read:leads', 'write:leads'] as ApiKeyScope[],
  Team: ['read:team', 'write:team'] as ApiKeyScope[],
  Other: ['read:analytics', 'manage:webhooks', 'manage:settings'] as ApiKeyScope[],
  Admin: ['admin'] as ApiKeyScope[],
};

/**
 * Check if scopes include required permission
 */
export function hasScope(userScopes: ApiKeyScope[], requiredScope: ApiKeyScope): boolean {
  // Admin scope has all permissions
  if (userScopes.includes('admin')) return true;

  // Check for exact scope
  if (userScopes.includes(requiredScope)) return true;

  // write:* implies read:*
  if (requiredScope.startsWith('read:')) {
    const writeScope = requiredScope.replace('read:', 'write:') as ApiKeyScope;
    if (userScopes.includes(writeScope)) return true;
  }

  return false;
}

/**
 * Check if scopes include any of required permissions
 */
export function hasAnyScope(userScopes: ApiKeyScope[], requiredScopes: ApiKeyScope[]): boolean {
  return requiredScopes.some(scope => hasScope(userScopes, scope));
}

/**
 * Check if scopes include all required permissions
 */
export function hasAllScopes(userScopes: ApiKeyScope[], requiredScopes: ApiKeyScope[]): boolean {
  return requiredScopes.every(scope => hasScope(userScopes, scope));
}

// ============================================================================
// Rate Limiting
// ============================================================================

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface RateLimiter {
  check(keyId: string): Promise<RateLimitInfo>;
  increment(keyId: string): Promise<void>;
  reset(keyId: string): Promise<void>;
}

/**
 * Create an in-memory rate limiter (use Redis in production)
 */
export function createInMemoryRateLimiter(): RateLimiter {
  const store = new Map<string, { count: number; resetAt: Date }>();

  function getOrCreate(keyId: string): { count: number; resetAt: Date } {
    const now = new Date();
    const existing = store.get(keyId);

    if (existing && existing.resetAt > now) {
      return existing;
    }

    const newEntry = {
      count: 0,
      resetAt: new Date(now.getTime() + 60000), // 1 minute window
    };
    store.set(keyId, newEntry);
    return newEntry;
  }

  return {
    async check(keyId: string): Promise<RateLimitInfo> {
      const entry = getOrCreate(keyId);
      // Default 100 requests per minute
      const limit = 100;
      return {
        allowed: entry.count < limit,
        remaining: Math.max(0, limit - entry.count),
        resetAt: entry.resetAt,
      };
    },

    async increment(keyId: string): Promise<void> {
      const entry = getOrCreate(keyId);
      entry.count++;
    },

    async reset(keyId: string): Promise<void> {
      store.delete(keyId);
    },
  };
}

// ============================================================================
// API Key Preset Templates
// ============================================================================

export const API_KEY_PRESETS = {
  'read-only': {
    name: 'Read Only',
    description: 'Read access to all resources',
    scopes: [
      'read:jobs',
      'read:customers',
      'read:invoices',
      'read:estimates',
      'read:leads',
      'read:team',
      'read:analytics',
    ] as ApiKeyScope[],
  },
  'technician-app': {
    name: 'Technician App',
    description: 'Access for mobile technician apps',
    scopes: [
      'read:jobs',
      'write:jobs',
      'read:customers',
      'read:invoices',
      'read:estimates',
    ] as ApiKeyScope[],
  },
  'accounting-integration': {
    name: 'Accounting Integration',
    description: 'For QuickBooks, Xero, etc.',
    scopes: [
      'read:customers',
      'read:invoices',
      'read:estimates',
    ] as ApiKeyScope[],
  },
  'webhook-manager': {
    name: 'Webhook Manager',
    description: 'Manage webhooks only',
    scopes: ['manage:webhooks'] as ApiKeyScope[],
  },
  'full-access': {
    name: 'Full Access',
    description: 'Complete access to all features',
    scopes: ['admin'] as ApiKeyScope[],
  },
};
