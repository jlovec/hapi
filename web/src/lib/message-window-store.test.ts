import { describe, expect, it, beforeEach } from 'vitest'
import type { DecryptedMessage } from '@/types/api'
import {
    clearMessageWindow,
    flushPendingMessages,
    getMessageWindowState,
    ingestIncomingMessages,
    setAtBottom,
} from './message-window-store'

function createCanonicalUserMessage(overrides: Partial<DecryptedMessage> = {}): DecryptedMessage {
    return {
        id: 'user-msg',
        seq: 1,
        localId: null,
        createdAt: 1000,
        content: {
            role: 'user',
            content: {
                type: 'text',
                text: 'hello',
            },
        },
        ...overrides,
    } as DecryptedMessage
}

function createAgentMessage(overrides: Partial<DecryptedMessage> = {}): DecryptedMessage {
    return {
        id: 'agent-msg',
        seq: 2,
        localId: null,
        createdAt: 1001,
        content: {
            role: 'agent',
            content: {
                type: 'text',
                text: 'world',
            },
        },
        ...overrides,
    } as DecryptedMessage
}

describe('message-window-store', () => {
    const sessionId = 'session-123'

    beforeEach(() => {
        clearMessageWindow(sessionId)
        setAtBottom(sessionId, true)
    })

    it('routes canonical user messages into pending when not at bottom', () => {
        setAtBottom(sessionId, false)

        ingestIncomingMessages(sessionId, [createCanonicalUserMessage()])

        const state = getMessageWindowState(sessionId)
        expect(state.messages).toHaveLength(0)
        expect(state.pending).toHaveLength(1)
        expect(state.pendingCount).toBe(1)
        expect(state.pending[0]?.id).toBe('user-msg')
    })

    it('keeps agent messages visible immediately when not at bottom', () => {
        setAtBottom(sessionId, false)

        ingestIncomingMessages(sessionId, [createAgentMessage()])

        const state = getMessageWindowState(sessionId)
        expect(state.messages).toHaveLength(1)
        expect(state.messages[0]?.id).toBe('agent-msg')
        expect(state.pending).toHaveLength(0)
        expect(state.pendingCount).toBe(0)
    })

    it('flushes pending canonical user messages into visible messages', () => {
        setAtBottom(sessionId, false)
        ingestIncomingMessages(sessionId, [createCanonicalUserMessage()])

        const needsRefresh = flushPendingMessages(sessionId)

        const state = getMessageWindowState(sessionId)
        expect(needsRefresh).toBe(false)
        expect(state.messages).toHaveLength(1)
        expect(state.messages[0]?.id).toBe('user-msg')
        expect(state.pending).toHaveLength(0)
        expect(state.pendingCount).toBe(0)
    })

    it('shows both visible agent and pending canonical user messages when mixed incoming arrives away from bottom', () => {
        setAtBottom(sessionId, false)

        ingestIncomingMessages(sessionId, [
            createAgentMessage(),
            createCanonicalUserMessage({ id: 'user-msg-2', seq: 3, createdAt: 1002 }),
        ])

        const state = getMessageWindowState(sessionId)
        expect(state.messages.map((message) => message.id)).toEqual(['agent-msg'])
        expect(state.pending.map((message) => message.id)).toEqual(['user-msg-2'])
        expect(state.pendingCount).toBe(1)
    })
})
