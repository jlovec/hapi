import type { AttachmentMetadata } from './types'
import { isObject } from './utils'
import { unwrapRoleWrappedRecordEnvelope } from './messages'

function isAttachmentMetadata(value: unknown): value is AttachmentMetadata {
    if (!isObject(value)) return false
    if (typeof value.id !== 'string') return false
    if (typeof value.filename !== 'string') return false
    if (typeof value.mimeType !== 'string') return false
    if (typeof value.size !== 'number' || !Number.isFinite(value.size)) return false
    if (typeof value.path !== 'string') return false
    if ('previewUrl' in value && value.previewUrl !== undefined && typeof value.previewUrl !== 'string') return false
    return true
}

type CanonicalUserMessageMeta = {
    sentFrom?: string
}

type CanonicalUserMessageTextContent = {
    type: 'text'
    text: string
    attachments?: AttachmentMetadata[]
}

export type CanonicalUserMessage = {
    role: 'user'
    content: CanonicalUserMessageTextContent
    meta?: CanonicalUserMessageMeta
}

export function buildCanonicalUserMessage(input: {
    text: string
    attachments?: AttachmentMetadata[]
    sentFrom?: string
}): CanonicalUserMessage {
    return {
        role: 'user',
        content: {
            type: 'text',
            text: input.text,
            attachments: input.attachments,
        },
        meta: input.sentFrom ? { sentFrom: input.sentFrom } : undefined,
    }
}

export function parseCanonicalUserMessage(value: unknown): CanonicalUserMessage | null {
    const record = unwrapRoleWrappedRecordEnvelope(value)
    if (!record || record.role !== 'user') return null
    if (!isCanonicalUserMessageTextContent(record.content)) return null
    if (!isCanonicalUserMessageMeta(record.meta)) return null

    return {
        role: 'user',
        content: {
            type: 'text',
            text: record.content.text,
            attachments: record.content.attachments,
        },
        meta: record.meta,
    }
}

function isCanonicalUserMessageTextContent(value: unknown): value is CanonicalUserMessageTextContent {
    if (!isObject(value)) return false
    if (value.type !== 'text') return false
    if (typeof value.text !== 'string') return false
    if ('attachments' in value && value.attachments !== undefined) {
        if (!Array.isArray(value.attachments)) return false
        if (!value.attachments.every(isAttachmentMetadata)) return false
    }
    return true
}

function isCanonicalUserMessageMeta(value: unknown): value is CanonicalUserMessageMeta | undefined {
    if (value === undefined) return true
    if (!isObject(value)) return false
    if ('sentFrom' in value && value.sentFrom !== undefined && typeof value.sentFrom !== 'string') return false
    return true
}
