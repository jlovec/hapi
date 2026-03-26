import type { SyncEvent, Session } from '@zs/protocol/types'
import type { MachineCache } from './machineCache'
import type { SessionCache } from './sessionCache'
import type { EventPublisher } from './eventPublisher'

type GetSession = (sessionId: string) => Session | undefined

export class RealtimeEventCoordinator {
    constructor(
        private readonly sessionCache: SessionCache,
        private readonly machineCache: MachineCache,
        private readonly eventPublisher: EventPublisher,
        private readonly getSession: GetSession,
    ) {
    }

    handle(event: SyncEvent): void {
        if (event.type === 'session-updated' && event.sessionId) {
            this.sessionCache.refreshSession(event.sessionId)
            return
        }

        if (event.type === 'machine-updated' && event.machineId) {
            this.machineCache.refreshMachine(event.machineId)
            return
        }

        if (event.type === 'message-received' && event.sessionId) {
            if (!this.getSession(event.sessionId)) {
                this.sessionCache.refreshSession(event.sessionId)
            }
        }

        this.eventPublisher.emit(event)
    }
}
