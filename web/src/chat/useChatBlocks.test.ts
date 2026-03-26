import { describe, expect, it } from 'vitest'
import { syncChatBlockSessionScope } from './sessionScope'

describe('syncChatBlockSessionScope', () => {
    it('clears both caches when switching to a new session scope', () => {
        const scopeRef = { current: 'session-a' }
        const normalizedCache = new Map([['m1', { source: { id: 'm1' } as never, normalized: null }]])
        const blocksById = new Map([['b1', { id: 'b1' } as never]])

        syncChatBlockSessionScope('session-b', scopeRef, normalizedCache, blocksById)

        expect(scopeRef.current).toBe('session-b')
        expect(normalizedCache.size).toBe(0)
        expect(blocksById.size).toBe(0)
    })

    it('keeps caches intact when session scope is unchanged', () => {
        const scopeRef = { current: 'session-a' }
        const normalizedCache = new Map([['m1', { source: { id: 'm1' } as never, normalized: null }]])
        const blocksById = new Map([['b1', { id: 'b1' } as never]])

        syncChatBlockSessionScope('session-a', scopeRef, normalizedCache, blocksById)

        expect(scopeRef.current).toBe('session-a')
        expect(normalizedCache.size).toBe(1)
        expect(blocksById.size).toBe(1)
    })

    it('treats first session bind as entering a new scope', () => {
        const scopeRef = { current: null as string | null }
        const normalizedCache = new Map([['m1', { source: { id: 'm1' } as never, normalized: null }]])
        const blocksById = new Map([['b1', { id: 'b1' } as never]])

        syncChatBlockSessionScope('session-a', scopeRef, normalizedCache, blocksById)

        expect(scopeRef.current).toBe('session-a')
        expect(normalizedCache.size).toBe(0)
        expect(blocksById.size).toBe(0)
    })
})

