import type { ChatBlock, NormalizedMessage } from './types'
import type { DecryptedMessage } from '@/types/api'

type NormalizedCacheEntry = {
    source: DecryptedMessage
    normalized: NormalizedMessage | null
}

export function syncChatBlockSessionScope(
    sessionId: string,
    scopeRef: { current: string | null },
    normalizedCache: Map<string, NormalizedCacheEntry>,
    blocksById: Map<string, ChatBlock>
): void {
    if (scopeRef.current === sessionId) {
        return
    }

    normalizedCache.clear()
    blocksById.clear()
    scopeRef.current = sessionId
}
