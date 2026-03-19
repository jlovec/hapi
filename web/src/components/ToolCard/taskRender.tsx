import type { ChatBlock, ToolCallBlock } from '@/chat/types'
import type { ReactNode } from 'react'
import { isObject } from '@zs/protocol'

export function isToolCallBlock(value: unknown): value is ToolCallBlock {
    if (!isObject(value)) return false
    if (value.kind !== 'tool-call') return false
    if (typeof value.id !== 'string') return false
    if (value.localId !== null && typeof value.localId !== 'string') return false
    if (typeof value.createdAt !== 'number') return false
    if (!Array.isArray(value.children)) return false
    if (!isObject(value.tool)) return false
    if (typeof value.tool.name !== 'string') return false
    if (!('input' in value.tool)) return false
    if (value.tool.description !== null && typeof value.tool.description !== 'string') return false
    if (value.tool.state !== 'pending' && value.tool.state !== 'running' && value.tool.state !== 'completed' && value.tool.state !== 'error') return false
    return true
}

function isPendingPermissionBlock(block: ChatBlock): boolean {
    return block.kind === 'tool-call' && block.tool.permission?.status === 'pending'
}

export function splitTaskChildren(block: ToolCallBlock): { pending: ChatBlock[]; rest: ChatBlock[] } {
    const pending: ChatBlock[] = []
    const rest: ChatBlock[] = []

    for (const child of block.children) {
        if (isPendingPermissionBlock(child)) {
            pending.push(child)
        } else {
            rest.push(child)
        }
    }

    return { pending, rest }
}

type TaskChildrenSectionProps = {
    block: ToolCallBlock
    renderBlocks: (blocks: ChatBlock[]) => ReactNode
}

export function TaskChildrenSection({ block, renderBlocks }: TaskChildrenSectionProps) {
    const taskChildren = splitTaskChildren(block)

    if (block.children.length === 0) return null

    return (
        <>
            {taskChildren.pending.length > 0 ? (
                <div className="mt-2 pl-3">
                    {renderBlocks(taskChildren.pending)}
                </div>
            ) : null}
            {taskChildren.rest.length > 0 ? (
                <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-[var(--app-hint)]">
                        Task details ({taskChildren.rest.length})
                    </summary>
                    <div className="mt-2 pl-3">
                        {renderBlocks(taskChildren.rest)}
                    </div>
                </details>
            ) : null}
        </>
    )
}
