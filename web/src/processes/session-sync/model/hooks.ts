import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSSE } from '@/hooks/useSSE'
import { useSyncingState } from '@/hooks/useSyncingState'
import { useVisibilityReporter } from '@/hooks/useVisibilityReporter'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { buildEventSubscription } from '../lib/subscriptionBuilder'
import { createSseConnectHandler, createSseDisconnectHandler, createSseEventHandler, createToastHandler } from '../lib/sseCallbacks'
import { usePushNotificationsFirstTime } from '../lib/pushNotificationsHandler'


export interface UseSessionSyncOptions {
  /** SSE 是否启用 */
  enabled: boolean
  /** 认证 token */
  token: string
  /** 基础 URL */
  baseUrl: string
  /** 当前选中的会话 ID */
  selectedSessionId: string | null
  /** API 客户端 */
  api: import('@/api/client').ApiClient | null
  /** Toast 添加方法 */
  addToast: (toast: {
    title: string
    body?: string
    sessionId?: string
    url?: string
  }) => void
}

export interface SessionSyncState {
  /** 是否正在同步 */
  isSyncing: boolean
  /** SSE 是否已断开 */
  sseDisconnected: boolean
  /** SSE 断开原因 */
  sseDisconnectReason: string | null
  /** SSE 订阅 ID */
  subscriptionId: string | null
  /** 开始同步（内部使用） */
  startSync: () => void
  /** 结束同步（内部使用） */
  endSync: () => void
}

/**
 * 会话同步流程 Hook
 *
 * 负责：
 * 1. SSE 连接管理和事件处理
 * 2. Query invalidation 触发
 * 3. Visibility reporter 上报
 * 4. Push notification 首次授权/订阅
 * 5. Toast 消息分发
 *
 * 边界约定：
 * - useSessionSync 只负责选择和装配唯一主 callback 实现
 * - SSE connect/disconnect/toast 的具体行为统一收敛在 ../lib/sseCallbacks
 * - 消息窗口刷新不得在 hook 内再维护第二套内联语义
 */
export function useSessionSync(options: UseSessionSyncOptions): SessionSyncState {
  const {
    enabled,
    token,
    baseUrl,
    selectedSessionId,
    api,
    addToast
  } = options

  const queryClient = useQueryClient()
  const { isSyncing, startSync, endSync } = useSyncingState()

  // SSE 连接状态
  const [sseDisconnected, setSseDisconnected] = useState(false)
  const [sseDisconnectReason, setSseDisconnectReason] = useState<string | null>(null)

  // 连接追踪
  const isFirstConnectRef = useRef(true)
  const baseUrlRef = useRef(baseUrl)

  // 当 baseUrl 改变时重置连接状态
  useEffect(() => {
    if (baseUrlRef.current === baseUrl) {
      return
    }
    baseUrlRef.current = baseUrl
    isFirstConnectRef.current = true
    queryClient.clear()
  }, [baseUrl, queryClient])

  const handleSseConnect = useMemo(() => createSseConnectHandler({
    queryClient,
    startSync,
    endSync,
    api,
    selectedSessionId,
    setSseDisconnected,
    setSseDisconnectReason,
    isFirstConnectRef,
  }), [queryClient, startSync, endSync, api, selectedSessionId])

  const handleSseDisconnect = useMemo(() => createSseDisconnectHandler(
    isFirstConnectRef,
    setSseDisconnected,
    setSseDisconnectReason
  ), [])

  const handleSseEvent = useMemo(() => createSseEventHandler(), [])

  const handleToast = useMemo(() => createToastHandler(addToast), [addToast])

  // SSE 订阅配置
  const eventSubscription = useMemo(() => {
    return buildEventSubscription(selectedSessionId)
  }, [selectedSessionId])

  const { subscriptionId } = useSSE({
    enabled,
    token,
    baseUrl,
    subscription: eventSubscription,
    onConnect: handleSseConnect,
    onDisconnect: handleSseDisconnect,
    onEvent: handleSseEvent,
    onToast: handleToast
  })

  // Visibility reporter
  useVisibilityReporter({
    api,
    subscriptionId,
    enabled: Boolean(api && token)
  })

  // Push notifications 首次订阅
  const pushNotifications = usePushNotifications(api)
  usePushNotificationsFirstTime({
    api,
    token,
    isPushSupported: pushNotifications.isSupported,
    pushPermission: pushNotifications.permission,
    requestPermission: pushNotifications.requestPermission,
    subscribe: pushNotifications.subscribe
  })

  return {
    isSyncing,
    sseDisconnected,
    sseDisconnectReason,
    subscriptionId,
    startSync,
    endSync
  }
}
