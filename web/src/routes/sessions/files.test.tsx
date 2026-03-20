import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nContext } from '@/lib/i18n-context'
import { en } from '@/lib/locales'
import FilesPage from './files'

const navigateMock = vi.fn()
const invalidateQueriesMock = vi.fn()
const refetchGitMock = vi.fn()

let mockSearch = {} as { tab?: 'changes' | 'directories' }
let mockSessionResult = {
    session: {
        id: 'session-1',
        metadata: { path: '/tmp/project' },
    },
    isLoading: false,
    error: null as string | null,
}
let mockGitState = {
    status: {
        branch: 'main',
        totalStaged: 2,
        totalUnstaged: 1,
        stagedFiles: [
            {
                fileName: 'a.ts',
                filePath: 'src',
                fullPath: 'src/a.ts',
                status: 'added',
                linesAdded: 3,
                linesRemoved: 0,
                isStaged: true,
            },
        ],
        unstagedFiles: [
            {
                fileName: 'b.ts',
                filePath: 'src',
                fullPath: 'src/b.ts',
                status: 'modified',
                linesAdded: 1,
                linesRemoved: 1,
                isStaged: false,
            },
        ],
    },
    error: null,
    isLoading: false,
    refetch: refetchGitMock,
}
let mockSearchResults = {
    isLoading: false,
    error: null,
    files: [],
}

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => navigateMock,
    useParams: () => ({ sessionId: 'session-1' }),
    useSearch: () => mockSearch,
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: invalidateQueriesMock,
    }),
}))

vi.mock('@/lib/app-context', () => ({
    useAppContext: () => ({ api: null }),
}))

vi.mock('@/hooks/queries/useSession', () => ({
    useSession: () => mockSessionResult,
}))

vi.mock('@/hooks/queries/useGitStatusFiles', () => ({
    useGitStatusFiles: () => mockGitState,
}))

vi.mock('@/hooks/queries/useSessionFileSearch', () => ({
    useSessionFileSearch: () => mockSearchResults,
}))

vi.mock('@/components/SessionFiles/DirectoryTree', () => ({
    DirectoryTree: () => <div>Directory tree</div>,
}))

vi.mock('@/components/FileIcon', () => ({
    FileIcon: () => <span aria-hidden="true">F</span>,
}))

vi.mock('@/lib/utils', async () => {
    const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils')
    return {
        ...actual,
        encodeBase64: (value: string) => value,
    }
})

function renderWithI18n() {
    const translations = en as Record<string, string>
    const t = (key: string, vars?: Record<string, string | number>) => {
        let value = translations[key] ?? key
        if (vars) {
            for (const [varKey, varValue] of Object.entries(vars)) {
                value = value.replace(`{${varKey}}`, String(varValue))
            }
        }
        return value
    }

    return render(
        <I18nContext.Provider value={{ t, locale: 'en', setLocale: vi.fn() }}>
            <FilesPage />
        </I18nContext.Provider>
    )
}

describe('FilesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSearch = {}
        mockSessionResult = {
            session: {
                id: 'session-1',
                metadata: { path: '/tmp/project' },
            },
            isLoading: false,
            error: null,
        }
        mockGitState = {
            status: {
                branch: 'main',
                totalStaged: 2,
                totalUnstaged: 1,
                stagedFiles: [
                    {
                        fileName: 'a.ts',
                        filePath: 'src',
                        fullPath: 'src/a.ts',
                        status: 'added',
                        linesAdded: 3,
                        linesRemoved: 0,
                        isStaged: true,
                    },
                ],
                unstagedFiles: [
                    {
                        fileName: 'b.ts',
                        filePath: 'src',
                        fullPath: 'src/b.ts',
                        status: 'modified',
                        linesAdded: 1,
                        linesRemoved: 1,
                        isStaged: false,
                    },
                ],
            },
            error: null,
            isLoading: false,
            refetch: refetchGitMock,
        }
        mockSearchResults = {
            isLoading: false,
            error: null,
            files: [],
        }
    })

    it('keeps change groups but does not render duplicate git summary in changes tab', () => {
        renderWithI18n()

        expect(screen.getByText(en['session.files.stagedChanges'].replace('{n}', '1'))).toBeInTheDocument()
        expect(screen.getByText(en['session.files.unstagedChanges'].replace('{n}', '1'))).toBeInTheDocument()
        expect(screen.queryByText(en['session.git.staged'].replace('{n}', '2'))).toBeNull()
        expect(screen.queryByText(en['session.git.unstaged'].replace('{n}', '1'))).toBeNull()
        expect(screen.queryByText('main')).toBeNull()
    })

    it('shows loading state while session is loading', () => {
        mockSessionResult = {
            session: null,
            isLoading: true,
            error: null,
        }

        renderWithI18n()

        expect(screen.getByText(en['loading.session'])).toBeInTheDocument()
    })

    it('shows session error instead of file content when session fetch fails', () => {
        mockSessionResult = {
            session: null,
            isLoading: false,
            error: 'HTTP 404 Not Found',
        }

        renderWithI18n()

        expect(screen.getByText('HTTP 404 Not Found')).toBeInTheDocument()
        expect(screen.queryByText('Directory tree')).toBeNull()
    })
})
