import { describe, expect, it } from 'vitest'
import {
    buildMachineUpdate,
    buildNewMessageUpdate,
    buildSessionUpdate,
    UpdateSchema,
} from './socket'

describe('socket update builders', () => {
    it('builds new-message update payload', () => {
        const update = buildNewMessageUpdate({
            id: 'update-1',
            seq: 1,
            createdAt: 1000,
            sessionId: 'session-1',
            message: {
                id: 'msg-1',
                seq: 1,
                createdAt: 999,
                localId: 'local-1',
                content: { role: 'user' },
            },
        })

        expect(update).toEqual({
            id: 'update-1',
            seq: 1,
            createdAt: 1000,
            body: {
                t: 'new-message',
                sid: 'session-1',
                message: {
                    id: 'msg-1',
                    seq: 1,
                    createdAt: 999,
                    localId: 'local-1',
                    content: { role: 'user' },
                },
            },
        })
        expect(UpdateSchema.parse(update)).toEqual(update)
    })

    it('builds update-session payload', () => {
        const update = buildSessionUpdate({
            id: 'update-2',
            seq: 2,
            createdAt: 2000,
            sessionId: 'session-2',
            metadata: { version: 3, value: { foo: 'bar' } },
            agentState: null,
        })

        expect(update.body).toEqual({
            t: 'update-session',
            sid: 'session-2',
            metadata: { version: 3, value: { foo: 'bar' } },
            agentState: null,
        })
        expect(UpdateSchema.parse(update)).toEqual(update)
    })

    it('builds update-machine payload', () => {
        const update = buildMachineUpdate({
            id: 'update-3',
            seq: 3,
            createdAt: 3000,
            machineId: 'machine-1',
            metadata: null,
            runnerState: { version: 4, value: { active: true } },
        })

        expect(update.body).toEqual({
            t: 'update-machine',
            machineId: 'machine-1',
            metadata: null,
            runnerState: { version: 4, value: { active: true } },
        })
        expect(UpdateSchema.parse(update)).toEqual(update)
    })
})
