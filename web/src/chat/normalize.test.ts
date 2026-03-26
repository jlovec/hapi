import { describe, expect, it } from 'vitest'
import { normalizeDecryptedMessage } from './normalize'
import type { DecryptedMessage } from '@/types/api'

describe('normalizeDecryptedMessage', () => {
    it('prefers canonical user-message parsing', () => {
        const message: DecryptedMessage = {
            id: 'msg-1',
            seq: 1,
            localId: 'local-1',
            createdAt: 123,
            content: {
                role: 'user',
                content: {
                    type: 'text',
                    text: 'hello',
                    attachments: [{
                        id: 'att-1',
                        filename: 'a.txt',
                        mimeType: 'text/plain',
                        size: 1,
                        path: '/tmp/a.txt',
                    }],
                },
                meta: {
                    sentFrom: 'webapp',
                },
            },
        }

        expect(normalizeDecryptedMessage(message)).toEqual({
            id: 'msg-1',
            localId: 'local-1',
            createdAt: 123,
            role: 'user',
            isSidechain: false,
            content: {
                type: 'text',
                text: 'hello',
                attachments: [{
                    id: 'att-1',
                    filename: 'a.txt',
                    mimeType: 'text/plain',
                    size: 1,
                    path: '/tmp/a.txt',
                }],
            },
            meta: {
                sentFrom: 'webapp',
            },
            status: undefined,
            originalText: undefined,
        })
    })

    it('parses canonical user-message shape without metadata via the canonical path', () => {
        const message: DecryptedMessage = {
            id: 'msg-canonical-no-meta',
            seq: 2,
            localId: null,
            createdAt: 234,
            content: {
                role: 'user',
                content: {
                    type: 'text',
                    text: 'hello without meta',
                    attachments: [{
                        id: 'att-2',
                        filename: 'b.txt',
                        mimeType: 'text/plain',
                        size: 2,
                        path: '/tmp/b.txt',
                    }],
                },
            },
        }

        expect(normalizeDecryptedMessage(message)).toEqual({
            id: 'msg-canonical-no-meta',
            localId: null,
            createdAt: 234,
            role: 'user',
            isSidechain: false,
            content: {
                type: 'text',
                text: 'hello without meta',
                attachments: [{
                    id: 'att-2',
                    filename: 'b.txt',
                    mimeType: 'text/plain',
                    size: 2,
                    path: '/tmp/b.txt',
                }],
            },
            meta: undefined,
            status: undefined,
            originalText: undefined,
        })
    })


    it('keeps cli canonical user messages on the canonical user path', () => {
        const message: DecryptedMessage = {
            id: 'msg-cli-canonical',
            seq: 3,
            localId: null,
            createdAt: 345,
            content: {
                role: 'user',
                content: {
                    type: 'text',
                    text: 'hello from cli',
                },
                meta: {
                    sentFrom: 'cli',
                },
            },
        }

        expect(normalizeDecryptedMessage(message)).toEqual({
            id: 'msg-cli-canonical',
            localId: null,
            createdAt: 345,
            role: 'user',
            isSidechain: false,
            content: {
                type: 'text',
                text: 'hello from cli',
                attachments: undefined,
            },
            meta: {
                sentFrom: 'cli',
            },
            status: undefined,
            originalText: undefined,
        })
    })
    it('falls back to safe string output for malformed canonical attachments', () => {
        const message: DecryptedMessage = {
            id: 'msg-bad-canonical-attachments',
            seq: 4,
            localId: null,
            createdAt: 456,
            content: {
                role: 'user',
                content: {
                    type: 'text',
                    text: 'hello',
                    attachments: [{
                        id: 'att-1',
                        filename: 'bad.txt',
                        mimeType: 42,
                        size: 1,
                        path: '/tmp/bad.txt',
                    }],
                },
                meta: {
                    sentFrom: 'webapp',
                },
            },
        }

        expect(normalizeDecryptedMessage(message)).toEqual({
            id: 'msg-bad-canonical-attachments',
            localId: null,
            createdAt: 456,
            role: 'user',
            isSidechain: false,
            content: {
                type: 'text',
                text: JSON.stringify({
                    type: 'text',
                    text: 'hello',
                    attachments: [{
                        id: 'att-1',
                        filename: 'bad.txt',
                        mimeType: 42,
                        size: 1,
                        path: '/tmp/bad.txt',
                    }],
                }, null, 2),
            },
            meta: {
                sentFrom: 'webapp',
            },
            status: undefined,
            originalText: undefined,
        })
    })
    it('falls back to legacy user normalization', () => {
        const message: DecryptedMessage = {
            id: 'msg-2',
            seq: 2,
            localId: null,
            createdAt: 456,
            content: {
                role: 'user',
                content: 'legacy hello',
            },
        }

        expect(normalizeDecryptedMessage(message)).toEqual({
            id: 'msg-2',
            localId: null,
            createdAt: 456,
            role: 'user',
            isSidechain: false,
            content: {
                type: 'text',
                text: 'legacy hello',
            },
            meta: undefined,
            status: undefined,
            originalText: undefined,
        })
    })
})
