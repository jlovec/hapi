import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SessionHeader } from './SessionHeader'

vi.mock('@/components/HostBadge', () => ({
    HostBadge: () => null,
}))

vi.mock('@/hooks/mutations/useSessionActions', () => ({
    useSessionActions: () => ({
        archiveSession: vi.fn(),
        renameSession: vi.fn(),
        deleteSession: vi.fn(async () => {}),
        isPending: false,
    }),
}))

vi.mock('@/components/SessionIcons', () => ({
    MoreVerticalIcon: () => <span aria-hidden="true">M</span>,
}))

vi.mock('@/components/SessionActionMenu', () => ({
    SessionActionMenu: () => null,
}))

vi.mock('@/components/RenameSessionDialog', () => ({
    RenameSessionDialog: () => null,
}))

vi.mock('@/components/ui/ConfirmDialog', () => ({
    ConfirmDialog: () => null,
}))

vi.mock('@/lib/sessionTitle', () => ({
    getSessionTitle: () => 'Session title',
}))

vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'button.close': 'Close',
                'session.more': 'More',
                'session.view.label': 'Session views',
                'session.view.chat': 'Chat',
                'session.view.terminal': 'Terminal',
                'session.view.files': 'Files',
                'session.item.modelMode': 'Mode',
                'session.item.worktree': 'Worktree',
                'session.git.loading': 'Loading Git status…',
                'session.git.unavailable': 'Git unavailable',
                'session.git.detached': 'Detached',
                'session.git.staged': 'Staged',
                'session.git.unstaged': 'Unstaged',
            }
            return map[key] ?? key
        },
    }),
}))

function buildSession(hasPath: boolean) {
    return {
        id: hasPath ? 'session-with-path' : 'session-without-path',
        active: true,
        metadata: {
            path: hasPath ? '/tmp/project' : null,
            flavor: 'claude',
            host: null,
            machineId: null,
            worktree: null,
        },
        modelMode: 'default',
    } as never
}

describe('SessionHeader', () => {
    it('shows Files tab only when session has a working path', () => {
        const { rerender } = render(
            <SessionHeader
                session={buildSession(true)}
                onBack={vi.fn()}
                api={null}
                currentView="chat"
                onSelectView={vi.fn()}
            />
        )

        expect(screen.getByRole('tab', { name: 'Chat' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Terminal' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Files' })).toBeInTheDocument()

        rerender(
            <SessionHeader
                session={buildSession(false)}
                onBack={vi.fn()}
                api={null}
                currentView="chat"
                onSelectView={vi.fn()}
            />
        )

        expect(screen.getByRole('tab', { name: 'Chat' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Terminal' })).toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'Files' })).toBeNull()
    })
})
