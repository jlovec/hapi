# State Management

> How state is managed in this project.

---

## Overview

HAPI Web uses a **hybrid state management approach**:

1. **Local component state** (`useState`, `useReducer`) for UI-only state
2. **TanStack Query** for server state (API data, caching, synchronization)
3. **Module-level stores** for cross-component state that doesn't fit React Query
4. **URL state** (TanStack Router) for navigation and shareable state
5. **Context** for dependency injection (API client, session context)

**No global state library** (Redux, Zustand, etc.) - state is kept as local as possible.

---

## State Categories

### 1. Local Component State

Use `useState` or `useReducer` for state that only affects one component:

```typescript
// UI-only state
const [isOpen, setIsOpen] = useState(false)
const [copied, setCopied] = useState(false)
const [autoScrollEnabled, setAutoScrollEnabled] = useState(true)
```

**When to use**:
- UI toggles (modals, dropdowns, expanded/collapsed)
- Form input values (before submission)
- Temporary UI state (loading spinners, animations)

### 2. Server State (TanStack Query)

Use TanStack Query for all server data:

```typescript
// Query for read operations
const { sessions, isLoading, error, refetch } = useSessions(api)

// Mutation for write operations
const { sendMessage, isSending } = useSendMessage(api, sessionId)
```

**When to use**:
- Any data from API endpoints
- Data that needs caching
- Data that needs background refetching
- Optimistic updates

**Configuration** (`lib/query-client.ts`):
```typescript
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5_000,           // Cache for 5 seconds
            refetchOnWindowFocus: false, // Don't refetch on tab focus
            retry: 1,                    // Retry failed queries once
        },
        mutations: {
            retry: 0,                    // Don't retry mutations
        },
    },
})
```

### 3. Module-Level Stores

For cross-component state that doesn't fit React Query, use module-level stores with subscription pattern:

```typescript
// lib/message-window-store.ts
const states = new Map<string, MessageWindowState>()
const listeners = new Map<string, Set<() => void>>()

export function getMessageWindowState(sessionId: string): MessageWindowState {
    return states.get(sessionId) ?? createInitialState(sessionId)
}

export function subscribeToMessageWindow(sessionId: string, listener: () => void): () => void {
    const sessionListeners = listeners.get(sessionId) ?? new Set()
    sessionListeners.add(listener)
    listeners.set(sessionId, sessionListeners)
    return () => sessionListeners.delete(listener)
}

export function updateMessageStatus(sessionId: string, localId: string, status: MessageStatus): void {
    const state = getMessageWindowState(sessionId)
    // ... update state
    notifyListeners(sessionId)
}
```

**When to use**:
- Real-time message windows (optimistic updates, pending messages)
- State that needs to persist across component unmounts
- State shared by multiple unrelated components
- Performance-critical state (avoid React re-renders)

**Pattern**: Expose getters, setters, and subscription functions. Components subscribe in `useEffect`.

### 4. URL State (TanStack Router)

Use URL parameters for shareable/bookmarkable state:

```typescript
// Route definition
export const Route = createFileRoute('/sessions/$sessionId')({
    component: SessionPage,
})

// Access in component
const { sessionId } = Route.useParams()
```

**When to use**:
- Current page/view (session ID, settings tab)
- Filters and search queries
- Any state that should be shareable via URL

### 5. Context (Dependency Injection)

Use Context for passing dependencies down the tree, not for state:

```typescript
// components/AssistantChat/context.tsx
export type HappyChatContextValue = {
    api: ApiClient
    sessionId: string
    metadata: SessionMetadataSummary | null
    disabled: boolean
    onRefresh: () => void
}

export function HappyChatProvider(props: { value: HappyChatContextValue; children: ReactNode }) {
    return <HappyChatContext.Provider value={props.value}>{props.children}</HappyChatContext.Provider>
}
```

**When to use**:
- Passing API client to deeply nested components
- Feature-scoped configuration (session context, theme)
- Callbacks that need to be accessible deep in the tree

**Don't use for**:
- Frequently changing state (causes re-renders of entire subtree)
- State that could be local or in React Query

---

## When to Use Global State

**Prefer local state by default.** Only promote to global when:

1. **Multiple unrelated components** need the same state
2. **State must persist** across component unmounts
3. **Performance critical** (avoiding prop drilling causes re-renders)
4. **Real-time updates** that don't fit React Query model

**Example**: Message window state is global because:
- Multiple components need it (thread, composer, status bar)
- Must persist when scrolling (component unmounts)
- Optimistic updates need immediate UI feedback
- Real-time messages arrive via WebSocket

---

## Server State Best Practices

### Query Keys

Centralize in `lib/query-keys.ts`:

```typescript
export const queryKeys = {
    sessions: ['sessions'] as const,
    session: (id: string) => ['session', id] as const,
    messages: (sessionId: string) => ['messages', sessionId] as const,
    machines: ['machines'] as const,
}
```

### Optimistic Updates

For mutations that need instant feedback:

```typescript
const mutation = useMutation({
    mutationFn: async (input) => {
        await api.sendMessage(input.sessionId, input.text, input.localId)
    },
    onMutate: async (input) => {
        // Add message to UI immediately
        appendOptimisticMessage(input.sessionId, {
            id: input.localId,
            content: { role: 'user', content: { type: 'text', text: input.text } },
            status: 'sending',
        })
    },
    onSuccess: (_, input) => {
        // Update status to 'sent'
        updateMessageStatus(input.sessionId, input.localId, 'sent')
    },
    onError: (_, input) => {
        // Update status to 'failed'
        updateMessageStatus(input.sessionId, input.localId, 'failed')
    },
})
```

### Cache Invalidation

Invalidate queries after mutations:

```typescript
const mutation = useMutation({
    mutationFn: async (sessionId) => {
        await api.deleteSession(sessionId)
    },
    onSuccess: () => {
        // Refetch sessions list
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
    },
})
```

---

## Derived State

### Compute in Render

For simple derived state, compute directly in render:

```typescript
function SessionList({ sessions }: { sessions: Session[] }) {
    const activeSessions = sessions.filter(s => s.active)
    const inactiveSessions = sessions.filter(s => !s.active)
    // ...
}
```

### useMemo for Expensive Computations

Only use `useMemo` when computation is expensive:

```typescript
const sortedSessions = useMemo(() => {
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
}, [sessions])
```

**Don't** use `useMemo` for cheap operations - it adds overhead.

---

## Common Mistakes

- ❌ Using Context for frequently changing state (causes re-renders)
- ❌ Lifting state too early (keep it local until you need to share)
- ❌ Not using TanStack Query for server data (reinventing caching/refetching)
- ❌ Storing derived state instead of computing it
- ❌ Using `useMemo` for cheap computations (premature optimization)
- ❌ Not invalidating queries after mutations
- ❌ Forgetting to clean up subscriptions in module-level stores
- ❌ Putting UI state in URL (only shareable state belongs there)
- ❌ Using global state when local state would work
- ❌ Not providing default values for optional query data (`?? []`)
- ❌ Treating composer draft text as global/thread state when product expectation is **session-scoped draft persistence**

---

## Session-Scoped Draft Contract (Chat Composer)

When chat input should survive session switches, follow this contract:

### Required Behavior

- Draft text is scoped by `session.id` (or equivalent stable session identity).
- Switching away from session A and returning to session A restores its previous draft.
- Switching to session B must not show session A's draft.
- Send success clears only the active session draft.
- Unsent draft must not be lost on in-app route/session tab switches.

### Implementation Pattern

- Keep a session-keyed draft store (`Map<sessionId, draft>` / module store / persistence layer).
- On active session change:
  - hydrate composer input from `draftStore.get(session.id) ?? ''`
  - persist edits to the same session key on each change/debounce.
- Never rely on a single unscoped `composer.text` value for multi-session UX.

### Test Cases (minimum)

- `A -> type "123" -> switch B -> switch A` => input is `123`.
- `A has "foo", B has "bar"` => switching sessions shows correct isolated draft.
- `A send message` => A draft clears; B draft remains unchanged.
- Route remount/re-entry still restores draft from session-scoped store.

---

## Terminal Session Resume Contract

### 1. Scope / Trigger

- Trigger: User leaves terminal page and re-enters within the same browser tab; terminal should resume the same session before Hub idle timeout expires.
- Why this needs code-spec depth:
  - This is a cross-layer state flow: Web session store -> terminal socket hook -> Hub terminal registry -> CLI terminal process.
  - If session identity, terminal identity, or disconnect semantics are unclear, regressions appear as “terminal resets after route re-entry”.

### 2. Signature

- Frontend session-scoped store:

```typescript
export type TerminalSessionState = {
    terminalId: string
    outputBuffer: string
    hasEverConnected: boolean
}

export function getTerminalSessionState(sessionId: string): TerminalSessionState
export function resetTerminalSessionState(sessionId: string): TerminalSessionState
export function clearTerminalSessionBuffer(sessionId: string): TerminalSessionState
export function appendTerminalSessionOutput(sessionId: string, chunk: string): TerminalSessionState
export function markTerminalSessionConnected(sessionId: string): TerminalSessionState
```

- Terminal socket hook:

```typescript
useTerminalSocket(options: {
    baseUrl: string
    token: string
    sessionId: string
    terminalId: string
    onTerminalNotFound?: () => void
}): {
    state:
        | { status: 'idle' }
        | { status: 'connecting' }
        | { status: 'connected' }
        | { status: 'reconnecting'; reason: string }
        | { status: 'error'; error: string }
    connect: (cols: number, rows: number) => void
    write: (data: string) => void
    resize: (cols: number, rows: number) => void
    disconnect: () => void
    onOutput: (handler: (data: string) => void) => void
    onExit: (handler: (code: number | null, signal: string | null) => void) => void
}
```

### 3. Contract

- Session identity contract:
  - `terminalId` is cached per `sessionId`.
  - Re-entering terminal route within the same tab must reuse the same `terminalId` if Hub has not timed it out yet.
  - Switching to another session must not reuse previous session's `terminalId` or output buffer.

- Output buffer contract:
  - `outputBuffer` belongs to session-scoped store, not component-local state.
  - When component remounts, it must replay cached `outputBuffer` before accepting new socket output.
  - **Replay must be reserved for recovery / remount-to-existing-buffer only, and must not be driven by every `outputBuffer` change.**
  - **Streaming socket output must append incrementally to the live terminal instance while also appending the chunk into the session store; it must not run `terminal.reset()` + full-buffer replay for each chunk.**
  - **Any replay gate/ref (such as `replayedBufferRef`) may only be cleared on `terminalId` switch, session switch, or explicit reset; never on ordinary output arrival.**
  - Buffer must have a max length cap to avoid unbounded growth.

- Expired-session recovery contract:
  - When hook receives `terminal:error` with message `Terminal not found.`, it must enter `reconnecting` state.
  - `onTerminalNotFound` must run: reset terminal store for current session, clear terminal UI, disconnect old socket, generate new `terminalId`, and reconnect.
  - After new terminal is created successfully, show a toast telling user old terminal expired and a new one was created automatically.

- Text contract:
  - All user-visible terminal status text must come from i18n keys, not hard-coded strings in hook/page.

### 4. Validation / Error Matrix

- `sessionId` changes -> page-level connection state must reset first, then switch to target session's `TerminalSessionState`.
- Same session re-entry while registry still has terminal -> must reuse old `terminalId` and restore buffer.
- Same session re-entry after Hub idle timeout deleted terminal -> must reset store, generate new `terminalId`, and reconnect.
- Hook receives normal `terminal:error` (not `Terminal not found.`) -> show error state, but do not silently recreate terminal.
- Missing `token/sessionId/terminalId` -> hook enters error state with localized error copy.
- Terminal process exit -> page shows exit state; only explicit reconnect/reset creates new terminal.
- **Streaming output chunk arrival -> only append new chunk; do not trigger a replay effect that clears the terminal and replays full history.**

### 5. Good / Base / Bad Cases

- Good:
  - User enters terminal page, leaves, and returns 10 seconds later; page reuses old `terminalId`, replays existing output, and CLI does not receive a second `terminal:open`.
  - After resume, terminal receives `first chunk`, then `second chunk`; UI appends both chunks without any reset.
- Base:
  - User enters terminal page for the first time; page creates a new terminal and future output appends to session store.
- Bad:
  - User only navigates away and back, but page generates a new `terminalId`, loses old output, and CLI creates a second terminal instance.
  - Every output chunk retriggers a replay effect via `outputBuffer` dependency, causing `terminal.reset()` and full-history redraw on each chunk.

### 6. Tests Required

- Unit (store):
  - Assert `getTerminalSessionState(sessionId)` returns stable isolated state per session.
  - Assert `resetTerminalSessionState(sessionId)` changes `terminalId` and clears buffer/connection marker.
  - Assert `appendTerminalSessionOutput` keeps only buffer tail and enforces max length.
- Hook / route integration:
  - Assert terminal page replay previous session buffer after remount.
  - Assert receiving `Terminal not found.` triggers reset + reconnect.
  - Assert reset success shows restart toast.
  - **Assert consecutive output chunks only cause incremental `write(chunk)` calls and never call `terminal.reset()` again.**
  - **For this streaming regression, tests must wait for React state/effect flush so synchronous assertions do not hide replay bugs.**
- Component:
  - Assert terminal page buttons/status banner text come from i18n keys.

### 7. Wrong vs Correct

#### Wrong

```typescript
useEffect(() => {
    replayedBufferRef.current = null
    replayStoredBuffer(terminalRef.current, terminalStateSnapshot.outputBuffer)
}, [terminalId, terminalStateSnapshot.outputBuffer, replayStoredBuffer])
```

#### Correct

```typescript
useEffect(() => {
    replayedBufferRef.current = null
    replayStoredBuffer(terminalRef.current, terminalStateSnapshot.outputBuffer)
}, [terminalId, replayStoredBuffer])

useEffect(() => {
    onOutput((data) => {
        const nextState = appendTerminalSessionOutput(sessionId, data)
        setTerminalStateSnapshot(nextState)
        terminalRef.current?.write(data)
    })
}, [onOutput, sessionId])
```

---

## State Flow Example

**Sending a message**:

1. User types in composer (local state: `useState`)
2. User clicks send → `useSendMessage` mutation
3. Mutation's `onMutate` adds optimistic message to module store
4. Module store notifies subscribers → UI updates immediately
5. API call completes → `onSuccess` updates message status
6. Real-time WebSocket receives confirmation → updates module store again

**Why this works**:
- Local state for input (no need to share)
- TanStack Query for API call (caching, retry, error handling)
- Module store for message window (cross-component, real-time, optimistic)
- No prop drilling, no unnecessary re-renders
