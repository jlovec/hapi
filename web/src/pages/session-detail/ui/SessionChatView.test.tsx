import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionChatView } from './SessionChatView'

const mockSession = {
    id: 'test-session-id',
    name: 'Test Session',
    active: true,
    metadata: { path: '/test/path', flavor: 'claude' },
}

const mockApi = {
    resumeSession: vi.fn(),
    getSession: vi.fn(),
}

const mockNavigate = vi.fn()
const mockUseMessages = vi.fn()
const mockUseSendMessage = vi.fn()
const mockHydrateResumedMessageWindow = vi.fn()

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => mockNavigate,
    useParams: () => ({ sessionId: 'test-session-id' }),
}))

vi.mock('@/lib/app-context', () => ({
    useAppContext: () => ({ api: mockApi }),
}))

vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@/lib/toast-context', () => ({
    useToast: () => ({
        addToast: vi.fn(),
    }),
}))

vi.mock('@/entities/session', () => ({
    useSession: () => ({
        session: mockSession,
        refetch: vi.fn(),
    }),
}))

vi.mock('@/entities/message', () => ({
    useMessages: (...args: unknown[]) => mockUseMessages(...args),
    useSendMessage: (...args: unknown[]) => mockUseSendMessage(...args),
}))

vi.mock('@/hooks/queries/useSlashCommands', () => ({
    useSlashCommands: () => ({
        getSuggestions: vi.fn(),
        refetchCommands: vi.fn(),
        isFetchingCommands: false,
    }),
}))

vi.mock('@/hooks/queries/useSkills', () => ({
    useSkills: () => ({
        getSuggestions: vi.fn(),
    }),
}))

vi.mock('@/components/SessionChat', () => ({
    SessionChat: () => <div data-testid="session-chat">Session Chat</div>,
}))

vi.mock('@/components/LoadingState', () => ({
    LoadingState: ({ label }: { label: string }) => <div data-testid="loading-state">{label}</div>,
}))

vi.mock('@/lib/query-keys', () => ({
    queryKeys: {
        session: (id: string) => ['session', id],
    },
}))

vi.mock('@/lib/message-window-store', () => ({
    hydrateResumedMessageWindow: (...args: unknown[]) => mockHydrateResumedMessageWindow(...args),
}))

function renderWithProviders(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            {ui}
        </QueryClientProvider>
    )
}

describe('SessionChatView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseMessages.mockReturnValue({
            messages: [],
            warning: null,
            isLoading: false,
            isLoadingMore: false,
            hasMore: false,
            loadMore: vi.fn(),
            refetch: vi.fn(),
            pendingCount: 0,
            messagesVersion: 1,
            flushPending: vi.fn(),
            setAtBottom: vi.fn(),
        })
        mockUseSendMessage.mockReturnValue({
            sendMessage: vi.fn(),
            retryMessage: vi.fn(),
            isSending: false,
        })
        mockSession.active = true
    })

    it('renders the chat view', () => {
        renderWithProviders(<SessionChatView />)
        expect(screen.getByTestId('session-chat')).toBeInTheDocument()
    })

    it('hydrates resumed message window through the store action', async () => {
        mockSession.active = false
        mockApi.resumeSession.mockResolvedValue('resumed-session-id')
        mockApi.getSession.mockResolvedValue({ session: { ...mockSession, id: 'resumed-session-id', active: true } })

        let triggerSend: ((text: string) => void) | undefined
        mockUseSendMessage.mockImplementation((_api, _sessionId, options) => {
            triggerSend = () => {
                void (async () => {
                    const resolved = await options.resolveSessionId('test-session-id')
                    options.onSessionResolved?.(resolved)
                })()
            }
            return {
                sendMessage: triggerSend,
                retryMessage: vi.fn(),
                isSending: false,
            }
        })

        renderWithProviders(<SessionChatView />)
        expect(triggerSend).toBeDefined()
        triggerSend?.('hello')

        await vi.waitFor(() => {
            expect(mockHydrateResumedMessageWindow).toHaveBeenCalledWith(
                mockApi,
                'test-session-id',
                'resumed-session-id'
            )
            expect(mockNavigate).toHaveBeenCalledWith({
                to: '/sessions/$sessionId',
                params: { sessionId: 'resumed-session-id' },
                replace: true,
            })
        })
    })
})
