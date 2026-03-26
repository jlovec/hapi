import { useCallback, useMemo, useState } from 'react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import type { ApiClient } from '@/api/client'
import type { AttachmentMetadata, DecryptedMessage, ModelMode, PermissionMode, Session } from '@/types/api'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import { useChatBlocks } from '@/chat/useChatBlocks'
import { ZhushenComposer } from '@/components/AssistantChat/ZhushenComposer'
import { ZhushenThread } from '@/components/AssistantChat/ZhushenThread'
import { useZhushenRuntime } from '@/lib/assistant-runtime'
import { createAttachmentAdapter } from '@/lib/attachmentAdapter'
import { TeamPanel } from '@/components/TeamPanel'
import { usePlatform } from '@/shared/hooks/usePlatform'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'

export type SessionChatProps = {
    api: ApiClient
    session: Session
    messages: DecryptedMessage[]
    messagesWarning: string | null
    hasMoreMessages: boolean
    isLoadingMessages: boolean
    isLoadingMoreMessages: boolean
    isSending: boolean
    pendingCount: number
    messagesVersion: number
    onRefresh: () => void
    onLoadMore: () => Promise<unknown>
    onSend: (text: string, attachments?: AttachmentMetadata[]) => void
    onFlushPending: () => void
    onAtBottomChange: (atBottom: boolean) => void
    onRetryMessage?: (localId: string) => void
    autocompleteSuggestions?: (query: string) => Promise<Suggestion[]>
    onSlashEntry?: () => void
    isFetchingSlashCommands?: boolean
}

/**
 * 聊天页面唯一主容器。
 * 聊天主容器统一收敛在 `SessionChat`，不再维护 `SessionChatPanel` 兼容导出。
 */
export function SessionChat(props: SessionChatProps) {
    const { haptic } = usePlatform()
    const sessionInactive = !props.session.active
    const [forceScrollToken, setForceScrollToken] = useState(0)
    const agentFlavor = props.session.metadata?.flavor ?? null
    const { abortSession, switchSession, setPermissionMode, setModelMode } = useSessionActions(
        props.api,
        props.session.id,
        agentFlavor
    )

    const { blocks, latestUsage, normalizedMessagesCount } = useChatBlocks(
        props.messages,
        props.session.id,
        props.session.agentState,
    )

    const handlePermissionModeChange = useCallback(async (mode: PermissionMode) => {
        try {
            await setPermissionMode(mode)
            haptic.notification('success')
            props.onRefresh()
        } catch (e) {
            haptic.notification('error')
            console.error('Failed to set permission mode:', e)
        }
    }, [setPermissionMode, props.onRefresh, haptic])

    const handleModelModeChange = useCallback(async (mode: ModelMode) => {
        try {
            await setModelMode(mode)
            haptic.notification('success')
            props.onRefresh()
        } catch (e) {
            haptic.notification('error')
            console.error('Failed to set model mode:', e)
        }
    }, [setModelMode, props.onRefresh, haptic])

    const handleAbort = useCallback(async () => {
        await abortSession()
        props.onRefresh()
    }, [abortSession, props.onRefresh])

    const handleSwitchToRemote = useCallback(async () => {
        await switchSession()
        props.onRefresh()
    }, [switchSession, props.onRefresh])

    const handleSend = useCallback((text: string, attachments?: AttachmentMetadata[]) => {
        props.onSend(text, attachments)
        setForceScrollToken((token) => token + 1)
    }, [props.onSend])

    const attachmentAdapter = useMemo(() => {
        if (!props.session.active) {
            return undefined
        }
        return createAttachmentAdapter(props.api, props.session.id)
    }, [props.api, props.session.id, props.session.active])

    const runtime = useZhushenRuntime({
        session: props.session,
        blocks,
        isSending: props.isSending,
        onSendMessage: handleSend,
        onAbort: handleAbort,
        attachmentAdapter,
        allowSendWhenInactive: true
    })

    return (
        <div className="flex h-full flex-col">
            {props.session.teamState ? <TeamPanel teamState={props.session.teamState} /> : null}

            {sessionInactive ? (
                <div className="px-3 pt-3">
                    <div className="mx-auto w-full max-w-content rounded-md bg-[var(--app-subtle-bg)] p-3 text-sm text-[var(--app-hint)]">
                        Session is inactive. Sending will resume it automatically.
                    </div>
                </div>
            ) : null}

            <AssistantRuntimeProvider runtime={runtime}>
                <div className="relative flex min-h-0 flex-1 flex-col">
                    <ZhushenThread
                        key={props.session.id}
                        api={props.api}
                        sessionId={props.session.id}
                        metadata={props.session.metadata}
                        disabled={sessionInactive}
                        onRefresh={props.onRefresh}
                        onRetryMessage={props.onRetryMessage}
                        onFlushPending={props.onFlushPending}
                        onAtBottomChange={props.onAtBottomChange}
                        isLoadingMessages={props.isLoadingMessages}
                        messagesWarning={props.messagesWarning}
                        hasMoreMessages={props.hasMoreMessages}
                        isLoadingMoreMessages={props.isLoadingMoreMessages}
                        onLoadMore={props.onLoadMore}
                        pendingCount={props.pendingCount}
                        rawMessagesCount={props.messages.length}
                        normalizedMessagesCount={normalizedMessagesCount}
                        messagesVersion={props.messagesVersion}
                        forceScrollToken={forceScrollToken}
                    />

                    <ZhushenComposer
                        disabled={props.isSending}
                        permissionMode={props.session.permissionMode}
                        modelMode={props.session.modelMode}
                        agentFlavor={agentFlavor}
                        active={props.session.active}
                        allowSendWhenInactive
                        thinking={props.session.thinking}
                        agentState={props.session.agentState}
                        contextSize={latestUsage?.contextSize}
                        controlledByUser={props.session.agentState?.controlledByUser === true}
                        onPermissionModeChange={handlePermissionModeChange}
                        onModelModeChange={handleModelModeChange}
                        onSwitchToRemote={handleSwitchToRemote}
                        sessionId={props.session.id}
                        autocompleteSuggestions={props.autocompleteSuggestions}
                        onSlashEntry={props.onSlashEntry}
                        isFetchingSlashCommands={props.isFetchingSlashCommands}
                    />
                </div>
            </AssistantRuntimeProvider>
        </div>
    )
}
