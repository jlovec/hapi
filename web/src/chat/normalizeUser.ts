import type { NormalizedMessage } from '@/chat/types'

export function normalizeUserRecord(
    messageId: string,
    localId: string | null,
    createdAt: number,
    content: unknown,
    meta?: unknown
): NormalizedMessage | null {
    if (typeof content !== 'string') {
        return null
    }

    return {
        id: messageId,
        localId,
        createdAt,
        role: 'user',
        content: { type: 'text', text: content },
        isSidechain: false,
        meta
    }
}
