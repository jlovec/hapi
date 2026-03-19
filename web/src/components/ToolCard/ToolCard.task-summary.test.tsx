import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ToolCallBlock } from '@/chat/types'
import { ToolCard } from './ToolCard'

vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('@/shared/hooks/usePointerFocusRing', () => ({
    usePointerFocusRing: () => ({
        suppressFocusRing: false,
        onTriggerPointerDown: undefined,
        onTriggerKeyDown: undefined,
        onTriggerBlur: undefined,
    })
}))

function makeChild(id: string, state: ToolCallBlock['tool']['state'], description: string): ToolCallBlock {
    return {
        kind: 'tool-call',
        id,
        localId: null,
        createdAt: 0,
        tool: {
            id,
            name: 'Read',
            state,
            input: { file_path: `/tmp/${id}.txt` },
            createdAt: 0,
            startedAt: 0,
            completedAt: 0,
            description,
        },
        children: [],
    }
}

function makeTaskBlock(): ToolCallBlock {
    return {
        kind: 'tool-call',
        id: 'task-1',
        localId: null,
        createdAt: 0,
        tool: {
            id: 'task-1',
            name: 'Task',
            state: 'running',
            input: { prompt: 'Investigate task UI' },
            createdAt: 0,
            startedAt: 0,
            completedAt: null,
            description: 'task description',
        },
        children: [
            makeChild('child-1', 'completed', 'first child'),
            makeChild('child-2', 'running', 'second child'),
            makeChild('child-3', 'completed', 'third child'),
            makeChild('child-4', 'pending', 'fourth child'),
        ],
    }
}

describe('ToolCard Task summary', () => {
    it('shows the latest three task children and overflow count without modal affordance', () => {
        render(
            <ToolCard
                api={{} as never}
                sessionId="session-1"
                metadata={null}
                disabled={false}
                onDone={() => {}}
                block={makeTaskBlock()}
            />
        )

        expect(screen.queryByText('first child')).not.toBeInTheDocument()
        expect(screen.getByText('/tmp/child-2.txt')).toBeInTheDocument()
        expect(screen.getByText('/tmp/child-3.txt')).toBeInTheDocument()
        expect(screen.getByText('/tmp/child-4.txt')).toBeInTheDocument()
        expect(screen.getByText('(+1 more)')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /child-2/i })).not.toBeInTheDocument()
    })
})
