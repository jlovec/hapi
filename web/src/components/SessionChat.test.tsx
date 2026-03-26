import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SessionChat } from './SessionChat'

const zhushenThreadMock = vi.fn((props?: any) => <div data-testid="zhushen-thread" data-props={JSON.stringify(props ?? {})} />)
const zhushenComposerMock = vi.fn((props?: any) => <div data-testid="zhushen-composer" data-props={JSON.stringify(props ?? {})} />)
const useChatBlocksMock = vi.fn<(...args: [unknown, unknown, unknown]) => {
    blocks: unknown[]
    latestUsage: null
    normalizedMessagesCount: number
}>(() => ({
    blocks: [],
    latestUsage: null,
    normalizedMessagesCount: 0,
}))

vi.mock('@/components/TeamPanel', () => ({
    TeamPanel: () => null,
}))

vi.mock('@/components/AssistantChat/ZhushenComposer', () => ({
    ZhushenComposer: (props: any) => zhushenComposerMock(props),
}))

vi.mock('@/components/AssistantChat/ZhushenThread', () => ({
    ZhushenThread: (props: any) => zhushenThreadMock(props),
}))

vi.mock('@/lib/assistant-runtime', () => ({
    useZhushenRuntime: () => ({}),
}))

vi.mock('@/lib/attachmentAdapter', () => ({
    createAttachmentAdapter: () => null,
}))

vi.mock('@/hooks/usePlatform', () => ({
    usePlatform: () => ({
        haptic: {
            notification: vi.fn(),
        }
    })
}))

vi.mock('@/hooks/mutations/useSessionActions', () => ({
    useSessionActions: () => ({
        abortSession: vi.fn(),
        switchSession: vi.fn(),
        setPermissionMode: vi.fn(),
        setModelMode: vi.fn(),
    })
}))

vi.mock('@/chat/useChatBlocks', () => ({
    useChatBlocks: (messages: unknown, sessionId: unknown, agentState: unknown) =>
        useChatBlocksMock(messages, sessionId, agentState),
}))

vi.mock('@assistant-ui/react', async () => {
    const ReactModule = await import('react')
    return {
        AssistantRuntimeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    }
})

const baseProps = {
    api: {} as never,
    messages: [],
    messagesWarning: null,
    hasMoreMessages: false,
    isLoadingMessages: false,
    isLoadingMoreMessages: false,
    isSending: false,
    pendingCount: 0,
    messagesVersion: 0,
    onRefresh: vi.fn(),
    onLoadMore: vi.fn(async () => ({})),
    onSend: vi.fn(),
    onFlushPending: vi.fn(),
    onAtBottomChange: vi.fn(),
}

function buildSession(active: boolean) {
    return {
        id: active ? 'active-session' : 'inactive-session',
        active,
        metadata: { path: '/tmp/project', flavor: 'claude' },
        agentState: {},
        permissionMode: 'ask',
        modelMode: 'default',
        thinking: false,
        teamState: null,
    } as never
}

describe('SessionChat', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useChatBlocksMock.mockReturnValue({
            blocks: [],
            latestUsage: null,
            normalizedMessagesCount: 0,
        })
    })

    it('shows inactive hint only for inactive sessions', () => {
        const { rerender } = render(
            <SessionChat
                {...baseProps}
                session={buildSession(false)}
            />
        )

        expect(screen.getByText('Session is inactive. Sending will resume it automatically.')).toBeInTheDocument()
        expect(screen.getByTestId('zhushen-thread')).toBeInTheDocument()
        expect(screen.getByTestId('zhushen-composer')).toBeInTheDocument()

        rerender(
            <SessionChat
                {...baseProps}
                session={buildSession(true)}
            />
        )

        expect(screen.queryByText('Session is inactive. Sending will resume it automatically.')).toBeNull()
    })

    it('passes thread contract props through the unified chat container', () => {
        const onRefresh = vi.fn()
        const onLoadMore = vi.fn(async () => ({}))
        const onFlushPending = vi.fn()
        const onAtBottomChange = vi.fn()
        const messages = [
            {
                id: 'msg-1',
                seq: 1,
                localId: null,
                content: { role: 'user', content: { type: 'text', text: 'hello' } },
                createdAt: 1,
            },
            {
                id: 'msg-2',
                seq: 2,
                localId: null,
                content: { role: 'agent', content: { type: 'text', text: 'world' } },
                createdAt: 2,
            },
        ] as never

        render(
            <SessionChat
                {...baseProps}
                session={buildSession(true)}
                messages={messages}
                messagesWarning="warning-text"
                hasMoreMessages
                isLoadingMessages
                isLoadingMoreMessages
                pendingCount={3}
                messagesVersion={7}
                onRefresh={onRefresh}
                onLoadMore={onLoadMore}
                onFlushPending={onFlushPending}
                onAtBottomChange={onAtBottomChange}
            />
        )

        expect(useChatBlocksMock).toHaveBeenCalledWith(messages, 'active-session', {})

        const threadProps = zhushenThreadMock.mock.lastCall?.[0]
        expect(threadProps).toEqual(expect.objectContaining({
            sessionId: 'active-session',
            disabled: false,
            onRefresh,
            onLoadMore,
            onFlushPending,
            onAtBottomChange,
            isLoadingMessages: true,
            messagesWarning: 'warning-text',
            hasMoreMessages: true,
            isLoadingMoreMessages: true,
            pendingCount: 3,
            rawMessagesCount: 2,
            messagesVersion: 7,
        }))
    })

    it('passes derived normalized message count into thread props', () => {
        const messages = [
            {
                id: 'msg-1',
                seq: 1,
                localId: null,
                content: { role: 'user', content: { type: 'text', text: 'hello' } },
                createdAt: 1,
            },
            {
                id: 'msg-2',
                seq: 2,
                localId: null,
                content: { role: 'agent', content: { type: 'text', text: 'hidden' } },
                createdAt: 2,
            },
        ] as never

        useChatBlocksMock.mockReturnValue({
            blocks: [],
            latestUsage: null,
            normalizedMessagesCount: 1,
        })

        render(
            <SessionChat
                {...baseProps}
                session={buildSession(true)}
                messages={messages}
            />
        )

        const threadProps = zhushenThreadMock.mock.lastCall?.[0]
        expect(threadProps).toEqual(expect.objectContaining({
            rawMessagesCount: 2,
            normalizedMessagesCount: 1,
        }))
    })
})
