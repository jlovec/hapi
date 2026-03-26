import { describe, expect, it } from 'vitest'
import { buildCanonicalUserMessage, parseCanonicalUserMessage } from './chat-protocol-user-message'

describe('chat-protocol-user-message', () => {
    it('builds canonical user message with sentFrom metadata', () => {
        expect(buildCanonicalUserMessage({
            text: 'hello',
            attachments: [{
                id: 'att-1',
                filename: 'a.txt',
                mimeType: 'text/plain',
                size: 1,
                path: '/tmp/a.txt',
            }],
            sentFrom: 'webapp',
        })).toEqual({
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
        })
    })

    it('parses canonical user message from wrapped content', () => {
        expect(parseCanonicalUserMessage({
            message: {
                role: 'user',
                content: {
                    type: 'text',
                    text: 'hello',
                },
                meta: {
                    sentFrom: 'webapp',
                },
            },
        })).toEqual({
            role: 'user',
            content: {
                type: 'text',
                text: 'hello',
                attachments: undefined,
            },
            meta: {
                sentFrom: 'webapp',
            },
        })
    })

    it('parses canonical user message with cli sentFrom metadata', () => {
        expect(parseCanonicalUserMessage({
            role: 'user',
            content: {
                type: 'text',
                text: 'hello from cli',
            },
            meta: {
                sentFrom: 'cli',
            },
        })).toEqual({
            role: 'user',
            content: {
                type: 'text',
                text: 'hello from cli',
                attachments: undefined,
            },
            meta: {
                sentFrom: 'cli',
            },
        })
    })

    it('returns null for malformed attachment items', () => {
        expect(parseCanonicalUserMessage({
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
        })).toBeNull()
    })

    it('returns null for non canonical user payload', () => {
        expect(parseCanonicalUserMessage({
            role: 'user',
            content: 'hello',
        })).toBeNull()
    })
})
