import { describe, expect, it } from 'bun:test'
import type { Session, SyncEvent } from '@zs/protocol/types'
import { RealtimeEventCoordinator } from './realtimeEventCoordinator'

describe('RealtimeEventCoordinator', () => {
    it('refreshes session cache for session-updated events without re-publishing', () => {
        const calls: string[] = []
        const coordinator = new RealtimeEventCoordinator(
            {
                refreshSession: (sessionId: string) => {
                    calls.push(`session:${sessionId}`)
                    return null
                },
            } as never,
            {} as never,
            {
                emit: () => {
                    calls.push('emit')
                },
            } as never,
            () => undefined,
        )

        coordinator.handle({ type: 'session-updated', sessionId: 'session-1' })

        expect(calls).toEqual(['session:session-1'])
    })

    it('refreshes machine cache for machine-updated events without re-publishing', () => {
        const calls: string[] = []
        const coordinator = new RealtimeEventCoordinator(
            {} as never,
            {
                refreshMachine: (machineId: string) => {
                    calls.push(`machine:${machineId}`)
                    return null
                },
            } as never,
            {
                emit: () => {
                    calls.push('emit')
                },
            } as never,
            () => undefined,
        )

        coordinator.handle({ type: 'machine-updated', machineId: 'machine-1' })

        expect(calls).toEqual(['machine:machine-1'])
    })

    it('refreshes missing session before publishing message-received', () => {
        const calls: string[] = []
        const event: SyncEvent = {
            type: 'message-received',
            sessionId: 'session-2',
            message: {
                id: 'msg-1',
                seq: 1,
                localId: null,
                createdAt: 1000,
                content: { role: 'user' },
            },
        }
        const coordinator = new RealtimeEventCoordinator(
            {
                refreshSession: (sessionId: string) => {
                    calls.push(`session:${sessionId}`)
                    return null
                },
            } as never,
            {} as never,
            {
                emit: (input: SyncEvent) => {
                    calls.push(`emit:${input.type}`)
                },
            } as never,
            () => undefined,
        )

        coordinator.handle(event)

        expect(calls).toEqual(['session:session-2', 'emit:message-received'])
    })

    it('publishes message-received directly when session already exists', () => {
        const calls: string[] = []
        const existingSession = { id: 'session-3' } as Session
        const coordinator = new RealtimeEventCoordinator(
            {
                refreshSession: (sessionId: string) => {
                    calls.push(`session:${sessionId}`)
                    return null
                },
            } as never,
            {} as never,
            {
                emit: (event: SyncEvent) => {
                    calls.push(`emit:${event.type}`)
                },
            } as never,
            () => existingSession,
        )

        coordinator.handle({
            type: 'message-received',
            sessionId: 'session-3',
            message: {
                id: 'msg-2',
                seq: 2,
                localId: null,
                createdAt: 1001,
                content: { role: 'user' },
            },
        })

        expect(calls).toEqual(['emit:message-received'])
    })
})
