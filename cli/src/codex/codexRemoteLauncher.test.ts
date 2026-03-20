import { afterEach, describe, expect, it, mock } from 'bun:test'

const harness = {
  notifications: [] as Array<{ method: string; params: unknown }>,
  registerRequestCalls: [] as string[]
}

type EnhancedMode = {
  permissionMode: 'default'
}

type FakeAgentState = {
  requests: Record<string, unknown>
  completedRequests: Record<string, unknown>
}

mock.module('react', () => ({
  default: {
    createElement: mock((_type: unknown, props: unknown) => ({ props }))
  }
}))

mock.module('chalk', () => ({
  default: {
    gray: mock((value: string) => value),
    red: mock((value: string) => value),
    blue: mock((value: string) => value),
    yellow: mock((value: string) => value)
  }
}))

mock.module('ink', () => ({
  render: mock(() => ({
    unmount: mock()
  }))
}))

mock.module('@/ui/logger', () => ({
  logger: {
    debug: mock(),
    warn: mock(),
    getLogPath: mock(() => '/tmp/zs-update/test.log')
  }
}))

mock.module('@/ui/terminalState', () => ({
  restoreTerminalState: mock()
}))

mock.module('@/ui/ink/CodexDisplay', () => ({
  CodexDisplay: mock(() => null)
}))

mock.module('@/persistence', () => ({
  readRunnerState: mock(async () => null)
}))

mock.module('./codexMcpClient', () => ({
  CodexMcpClient: class MockCodexMcpClient {
    async connect(): Promise<void> {}
    async disconnect(): Promise<void> {}
    setHandler(): void {}
    setPermissionHandler(): void {}
    getSessionId(): string | null {
      return null
    }
    clearSession(): void {}
    async startSession(): Promise<void> {}
    async continueSession(): Promise<void> {}
  }
}))

mock.module('./codexAppServerClient', () => {
  class MockCodexAppServerClient {
    private notificationHandler: ((method: string, params: unknown) => void) | null = null

    async connect(): Promise<void> {}

    async initialize(): Promise<{ protocolVersion: number }> {
      return { protocolVersion: 1 }
    }

    setNotificationHandler(handler: ((method: string, params: unknown) => void) | null): void {
      this.notificationHandler = handler
    }

    registerRequestHandler(method: string): void {
      harness.registerRequestCalls.push(method)
    }

    async startThread(): Promise<{ thread: { id: string } }> {
      return { thread: { id: 'thread-anonymous' } }
    }

    async resumeThread(): Promise<{ thread: { id: string } }> {
      return { thread: { id: 'thread-anonymous' } }
    }

    async startTurn(): Promise<{ turn: Record<string, never> }> {
      const started = { turn: {} }
      harness.notifications.push({ method: 'turn/started', params: started })
      this.notificationHandler?.('turn/started', started)

      const completed = { status: 'Completed', turn: {} }
      harness.notifications.push({ method: 'turn/completed', params: completed })
      this.notificationHandler?.('turn/completed', completed)

      return { turn: {} }
    }

    async interruptTurn(): Promise<Record<string, never>> {
      return {}
    }

    async disconnect(): Promise<void> {}
  }

  return { CodexAppServerClient: MockCodexAppServerClient }
})

mock.module('./utils/buildZhushenMcpBridge', () => ({
  buildZhushenMcpBridge: async () => ({
    server: {
      stop: () => {}
    },
    mcpServers: {}
  })
}))

function createMode(): EnhancedMode {
  return {
    permissionMode: 'default'
  }
}

async function createSessionStub() {
  const { MessageQueue2 } = await import('@/utils/MessageQueue2')
  const queue = new MessageQueue2<EnhancedMode>((mode) => JSON.stringify(mode))
  queue.push('hello from launcher test', createMode())
  queue.close()

  const sessionEvents: Array<{ type: string; [key: string]: unknown }> = []
  const codexMessages: unknown[] = []
  const thinkingChanges: boolean[] = []
  const foundSessionIds: string[] = []
  let agentState: FakeAgentState = {
    requests: {},
    completedRequests: {}
  }

  const rpcHandlers = new Map<string, (params: unknown) => unknown>()
  const client = {
    rpcHandlerManager: {
      registerHandler(method: string, handler: (params: unknown) => unknown) {
        rpcHandlers.set(method, handler)
      }
    },
    updateAgentState(handler: (state: FakeAgentState) => FakeAgentState) {
      agentState = handler(agentState)
    },
    sendCodexMessage(message: unknown) {
      codexMessages.push(message)
    },
    sendUserMessage(_text: string) {},
    sendSessionEvent(event: { type: string; [key: string]: unknown }) {
      sessionEvents.push(event)
    }
  }

  const session = {
    path: '/tmp/zs-update',
    logPath: '/tmp/zs-update/test.log',
    client,
    queue,
    codexArgs: undefined,
    codexCliOverrides: undefined,
    sessionId: null as string | null,
    thinking: false,
    onThinkingChange(nextThinking: boolean) {
      session.thinking = nextThinking
      thinkingChanges.push(nextThinking)
    },
    onSessionFound(id: string) {
      session.sessionId = id
      foundSessionIds.push(id)
    },
    sendCodexMessage(message: unknown) {
      client.sendCodexMessage(message)
    },
    sendSessionEvent(event: { type: string; [key: string]: unknown }) {
      client.sendSessionEvent(event)
    },
    sendUserMessage(text: string) {
      client.sendUserMessage(text)
    }
  }

  return {
    session,
    sessionEvents,
    codexMessages,
    thinkingChanges,
    foundSessionIds,
    rpcHandlers,
    getAgentState: () => agentState
  }
}

describe('codexRemoteLauncher', () => {
  afterEach(() => {
    harness.notifications = []
    harness.registerRequestCalls = []
    delete process.env.CODEX_USE_MCP_SERVER
  })

  it('finishes a turn and emits ready when task lifecycle events omit turn_id', async () => {
    delete process.env.CODEX_USE_MCP_SERVER
    const { codexRemoteLauncher } = await import('./codexRemoteLauncher')
    const {
      session,
      sessionEvents,
      thinkingChanges,
      foundSessionIds
    } = await createSessionStub()

    const exitReason = await codexRemoteLauncher(session as never)

    expect(exitReason).toBe('exit')
    expect(foundSessionIds).toContain('thread-anonymous')
    expect(harness.notifications.map((entry) => entry.method)).toEqual(['turn/started', 'turn/completed'])
    expect(sessionEvents.filter((event) => event.type === 'ready').length).toBeGreaterThanOrEqual(1)
    expect(thinkingChanges).toContain(true)
    expect(session.thinking).toBe(false)
  })
})
