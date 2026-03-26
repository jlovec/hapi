import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { shouldRetryVisibilityUpdate } from './useVisibilityReporter'

describe('shouldRetryVisibilityUpdate', () => {
    it('returns false for classified subscription_not_found 404', () => {
        expect(shouldRetryVisibilityUpdate(new ApiError(
            'HTTP 404 Not Found',
            404,
            'Subscription not found',
            '{"error":"Subscription not found","reason":"subscription_not_found","trackedNamespace":null}',
            { error: 'Subscription not found', reason: 'subscription_not_found', trackedNamespace: null }
        ))).toBe(false)
    })

    it('returns false for namespace mismatch 404 because retry cannot self-heal', () => {
        expect(shouldRetryVisibilityUpdate(new ApiError(
            'HTTP 404 Not Found',
            404,
            'Subscription not found',
            '{"error":"Subscription not found","reason":"namespace_mismatch","trackedNamespace":"beta"}',
            { error: 'Subscription not found', reason: 'namespace_mismatch', trackedNamespace: 'beta' }
        ))).toBe(false)
    })

    it('returns true for generic network or non-404 failures', () => {
        expect(shouldRetryVisibilityUpdate(new Error('network error'))).toBe(true)
        expect(shouldRetryVisibilityUpdate(new Error('HTTP 500 Internal Server Error'))).toBe(true)
        expect(shouldRetryVisibilityUpdate({ message: 'HTTP 404' })).toBe(true)
    })
})
