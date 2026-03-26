import { useEffect, useMemo, useRef } from 'react'
import { normalizeDecryptedMessage } from './normalize'
import { reduceChatBlocks } from './reducer'
import { reconcileChatBlocks } from './reconcile'
import { syncChatBlockSessionScope } from './sessionScope'
import type { ChatBlock, NormalizedMessage } from './types'
import type { AgentState, DecryptedMessage } from '@/types/api'

type NormalizedCacheEntry = {
    source: DecryptedMessage
    normalized: NormalizedMessage | null
}

function normalizeMessagesWithCache(
    messages: DecryptedMessage[],
    cache: Map<string, NormalizedCacheEntry>
): NormalizedMessage[] {
    const normalized: NormalizedMessage[] = []
    const seen = new Set<string>()

    for (const message of messages) {
        seen.add(message.id)
        const cached = cache.get(message.id)
        if (cached && cached.source === message) {
            if (cached.normalized) normalized.push(cached.normalized)
            continue
        }

        const next = normalizeDecryptedMessage(message)
        cache.set(message.id, { source: message, normalized: next })
        if (next) normalized.push(next)
    }

    for (const id of cache.keys()) {
        if (!seen.has(id)) {
            cache.delete(id)
        }
    }

    return normalized
}

export function useChatBlocks(messages: DecryptedMessage[], sessionId: string, agentState: AgentState | null | undefined) {
    const normalizedCacheRef = useRef<Map<string, NormalizedCacheEntry>>(new Map())
    const blocksByIdRef = useRef<Map<string, ChatBlock>>(new Map())
    const sessionScopeRef = useRef<string | null>(null)

    const normalizedMessages: NormalizedMessage[] = useMemo(() => {
        syncChatBlockSessionScope(
            sessionId,
            sessionScopeRef,
            normalizedCacheRef.current,
            blocksByIdRef.current
        )

        return normalizeMessagesWithCache(messages, normalizedCacheRef.current)
    }, [messages, sessionId])

    const reduced = useMemo(
        () => reduceChatBlocks(normalizedMessages, agentState),
        [normalizedMessages, agentState]
    )
    const reconciled = useMemo(
        () => reconcileChatBlocks(reduced.blocks, blocksByIdRef.current),
        [reduced.blocks]
    )

    useEffect(() => {
        blocksByIdRef.current = reconciled.byId
    }, [reconciled.byId])

    return {
        blocks: reconciled.blocks,
        latestUsage: reduced.latestUsage,
        normalizedMessagesCount: normalizedMessages.length,
    }
}
