import { describe, expect, it } from 'bun:test'
import { Store } from '../store'
import { MessageService } from './messageService'
import type { SyncEvent } from '@zs/protocol/types'

type SocketUpdate = {
    room: string
    event: string
    payload: unknown
}

class FakeIo {
    readonly updates: SocketUpdate[] = []

    of(_namespace: string): { to: (room: string) => { emit: (event: string, payload: unknown) => void } } {
        return {
            to: (room: string) => ({
                emit: (event: string, payload: unknown) => {
                    this.updates.push({ room, event, payload })
                }
            })
        }
    }
}

class FakePublisher {
    readonly events: SyncEvent[] = []

    emit(event: SyncEvent): void {
        this.events.push(event)
    }
}

describe('MessageService', () => {
    it('stores canonical user messages and emits transport-compatible events', async () => {
        const store = new Store(':memory:')
        const io = new FakeIo()
        const publisher = new FakePublisher()
        const service = new MessageService(
            store,
            io as never,
            publisher as never
        )

        const session = store.sessions.getOrCreateSession('test-session', null, null, 'default')
        const attachments = [{
            id: 'att-1',
            filename: 'hello.txt',
            mimeType: 'text/plain',
            size: 5,
            path: '/tmp/hello.txt'
        }]

        await service.sendMessage(session.id, {
            text: 'hello world',
            localId: 'local-1',
            attachments,
        })

        const stored = store.messages.getMessages(session.id)
        expect(stored).toHaveLength(1)
        expect(stored[0]?.localId).toBe('local-1')
        expect(stored[0]?.content).toEqual({
            role: 'user',
            content: {
                type: 'text',
                text: 'hello world',
                attachments,
            },
            meta: {
                sentFrom: 'webapp'
            }
        })

        expect(io.updates).toHaveLength(1)
        expect(io.updates[0]).toEqual({
            room: `session:${session.id}`,
            event: 'update',
            payload: expect.objectContaining({
                body: {
                    t: 'new-message',
                    sid: session.id,
                    message: expect.objectContaining({
                        localId: 'local-1',
                        content: {
                            role: 'user',
                            content: {
                                type: 'text',
                                text: 'hello world',
                                attachments,
                            },
                            meta: {
                                sentFrom: 'webapp'
                            }
                        }
                    })
                }
            })
        })

        expect(publisher.events).toHaveLength(1)
        expect(publisher.events[0]).toEqual({
            type: 'message-received',
            sessionId: session.id,
            message: expect.objectContaining({
                localId: 'local-1',
                content: {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: 'hello world',
                        attachments,
                    },
                    meta: {
                        sentFrom: 'webapp'
                    }
                }
            })
        })
    })

    it('reuses the stored message when localId already exists', async () => {
        const store = new Store(':memory:')
        const io = new FakeIo()
        const publisher = new FakePublisher()
        const service = new MessageService(
            store,
            io as never,
            publisher as never
        )

        const session = store.sessions.getOrCreateSession('test-session', null, null, 'default')

        await service.sendMessage(session.id, {
            text: 'hello world',
            localId: 'local-1',
        })
        await service.sendMessage(session.id, {
            text: 'hello world changed',
            localId: 'local-1',
        })

        const stored = store.messages.getMessages(session.id)
        expect(stored).toHaveLength(1)
        expect(stored[0]?.content).toEqual({
            role: 'user',
            content: {
                type: 'text',
                text: 'hello world',
                attachments: undefined,
            },
            meta: {
                sentFrom: 'webapp'
            }
        })
    })
})
