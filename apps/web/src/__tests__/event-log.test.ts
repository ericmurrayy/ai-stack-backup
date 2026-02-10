/**
 * Tests: Event Logging Helpers
 * ============================
 * Validates the event-log.ts helper functions:
 * 1. logJobEvent inserts correct shape
 * 2. logActionEvent inserts correct shape
 * 3. Errors are caught and logged, never thrown
 * 4. Default values are applied correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logJobEvent, logActionEvent } from '../lib/event-log'

// ── Mock Supabase Client ─────────────────────────────────────────

function createMockSupabase(insertResult: { error: any } = { error: null }) {
  const insertFn = vi.fn().mockResolvedValue(insertResult)
  const fromFn = vi.fn().mockReturnValue({ insert: insertFn })
  return {
    from: fromFn,
    _insertFn: insertFn,
    _fromFn: fromFn,
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('Event Logging Helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Suppress console.error in tests
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('logJobEvent', () => {
    it('inserts a job event with all fields', async () => {
      const mock = createMockSupabase()
      await logJobEvent(mock as any, {
        job_id: 'job-uuid-123',
        owner_id: 'owner-uuid-456',
        event_type: 'status_changed',
        actor_type: 'user',
        actor_id: 'user-uuid-789',
        old_value: { status: 'pending' },
        new_value: { status: 'in_progress' },
        metadata: { source: 'web' },
      })

      expect(mock._fromFn).toHaveBeenCalledWith('job_events')
      expect(mock._insertFn).toHaveBeenCalledWith({
        job_id: 'job-uuid-123',
        owner_id: 'owner-uuid-456',
        event_type: 'status_changed',
        actor_type: 'user',
        actor_id: 'user-uuid-789',
        old_value: { status: 'pending' },
        new_value: { status: 'in_progress' },
        metadata: { source: 'web' },
      })
    })

    it('applies defaults for optional fields', async () => {
      const mock = createMockSupabase()
      await logJobEvent(mock as any, {
        job_id: 'job-uuid-123',
        owner_id: 'owner-uuid-456',
        event_type: 'created',
      })

      expect(mock._insertFn).toHaveBeenCalledWith({
        job_id: 'job-uuid-123',
        owner_id: 'owner-uuid-456',
        event_type: 'created',
        actor_type: 'system',
        actor_id: null,
        old_value: null,
        new_value: null,
        metadata: {},
      })
    })

    it('catches Supabase errors without throwing', async () => {
      const mock = createMockSupabase({ error: { message: 'DB connection lost' } })
      // Should NOT throw
      await expect(logJobEvent(mock as any, {
        job_id: 'job-uuid',
        owner_id: 'owner-uuid',
        event_type: 'created',
      })).resolves.toBeUndefined()

      expect(console.error).toHaveBeenCalledWith(
        '[EventLog] Failed to log job event:',
        'DB connection lost'
      )
    })

    it('catches unexpected exceptions without throwing', async () => {
      const mock = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockRejectedValue(new Error('Network timeout')),
        }),
      }

      await expect(logJobEvent(mock as any, {
        job_id: 'job-uuid',
        owner_id: 'owner-uuid',
        event_type: 'created',
      })).resolves.toBeUndefined()

      expect(console.error).toHaveBeenCalledWith(
        '[EventLog] Job event logging error:',
        'Network timeout'
      )
    })
  })

  describe('logActionEvent', () => {
    it('inserts an action event with all fields', async () => {
      const mock = createMockSupabase()
      await logActionEvent(mock as any, {
        action_id: 'action-uuid-001',
        owner_id: 'owner-uuid-456',
        event_type: 'approved',
        actor_type: 'user',
        actor_id: 'user-uuid-789',
        old_status: 'pending',
        new_status: 'approved',
        metadata: { correlation_id: 'corr-123' },
      })

      expect(mock._fromFn).toHaveBeenCalledWith('action_events')
      expect(mock._insertFn).toHaveBeenCalledWith({
        action_id: 'action-uuid-001',
        owner_id: 'owner-uuid-456',
        event_type: 'approved',
        actor_type: 'user',
        actor_id: 'user-uuid-789',
        old_status: 'pending',
        new_status: 'approved',
        metadata: { correlation_id: 'corr-123' },
      })
    })

    it('applies defaults for optional fields', async () => {
      const mock = createMockSupabase()
      await logActionEvent(mock as any, {
        action_id: 'action-uuid-001',
        owner_id: 'owner-uuid-456',
        event_type: 'created',
      })

      expect(mock._insertFn).toHaveBeenCalledWith({
        action_id: 'action-uuid-001',
        owner_id: 'owner-uuid-456',
        event_type: 'created',
        actor_type: 'system',
        actor_id: null,
        old_status: null,
        new_status: null,
        metadata: {},
      })
    })

    it('catches Supabase errors without throwing', async () => {
      const mock = createMockSupabase({ error: { message: 'RLS violation' } })

      await expect(logActionEvent(mock as any, {
        action_id: 'action-uuid',
        owner_id: 'owner-uuid',
        event_type: 'approved',
      })).resolves.toBeUndefined()

      expect(console.error).toHaveBeenCalledWith(
        '[EventLog] Failed to log action event:',
        'RLS violation'
      )
    })

    it('catches unexpected exceptions without throwing', async () => {
      const mock = {
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockRejectedValue(new Error('Socket closed')),
        }),
      }

      await expect(logActionEvent(mock as any, {
        action_id: 'action-uuid',
        owner_id: 'owner-uuid',
        event_type: 'approved',
      })).resolves.toBeUndefined()

      expect(console.error).toHaveBeenCalledWith(
        '[EventLog] Action event logging error:',
        'Socket closed'
      )
    })

    it('logs webhook event types correctly', async () => {
      const mock = createMockSupabase()
      await logActionEvent(mock as any, {
        action_id: 'action-uuid-001',
        owner_id: 'owner-uuid-456',
        event_type: 'webhook_failed',
        actor_type: 'system',
        metadata: { attempts: 3, error: 'All retries failed' },
      })

      expect(mock._insertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'webhook_failed',
          actor_type: 'system',
          metadata: { attempts: 3, error: 'All retries failed' },
        })
      )
    })
  })
})
