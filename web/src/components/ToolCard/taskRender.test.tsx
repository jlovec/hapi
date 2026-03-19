import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ChatBlock, ToolCallBlock } from '@/chat/types'
import { TaskChildrenSection, splitTaskChildren } from './taskRender'

function makeToolBlock(id: string, state: ToolCallBlock['tool']['state'], permissionStatus?: 'pending' | 'approved' | 'denied' | 'canceled'): ToolCallBlock {
    return {
        kind: 'tool-call',
        id,
        localId: null,
        createdAt: 0,
        tool: {
            id,
            name: id === 'task' ? 'Task' : 'Read',
            state,
            input: {},
            createdAt: 0,
            startedAt: 0,
            completedAt: 0,
            description: null,
            permission: permissionStatus ? { id: `${id}-perm`, status: permissionStatus } : undefined,
        },
        children: [],
    }
}

describe('splitTaskChildren', () => {
    it('keeps pending permission children visible and moves the rest into collapsible details', () => {
        const task = makeToolBlock('task', 'running')
        task.children = [
            makeToolBlock('pending-read', 'pending', 'pending'),
            makeToolBlock('completed-read', 'completed'),
        ]

        const parts = splitTaskChildren(task)

        expect(parts.pending).toHaveLength(1)
        expect(parts.rest).toHaveLength(1)
        expect((parts.pending[0] as ToolCallBlock).id).toBe('pending-read')
        expect((parts.rest[0] as ToolCallBlock).id).toBe('completed-read')
    })
})

describe('TaskChildrenSection', () => {
    it('renders pending children inline and remaining children under task details', () => {
        const task = makeToolBlock('task', 'running')
        task.children = [
            makeToolBlock('pending-read', 'pending', 'pending'),
            makeToolBlock('completed-read', 'completed'),
        ]

        render(
            <TaskChildrenSection
                block={task}
                renderBlocks={(blocks: ChatBlock[]) => (
                    <div>
                        {blocks.map((block) => (
                            <div key={block.id}>{block.id}</div>
                        ))}
                    </div>
                )}
            />
        )

        expect(screen.getByText('pending-read')).toBeInTheDocument()
        expect(screen.getByText('Task details (1)')).toBeInTheDocument()
        expect(screen.getByText('completed-read')).toBeInTheDocument()
    })
})
