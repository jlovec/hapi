import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import type { ChatBlock } from '@/chat/types'
import type { ToolCallBlock } from '@/chat/types'
import { safeStringify } from '@zs/protocol'
import { getEventPresentation } from '@/chat/presentation'
import { CodeBlock } from '@/components/CodeBlock'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { LazyRainbowText } from '@/components/LazyRainbowText'
import { MessageStatusIndicator } from '@/components/AssistantChat/messages/MessageStatusIndicator'
import { ToolCard } from '@/components/ToolCard/ToolCard'
import { TaskChildrenSection, isToolCallBlock } from '@/components/ToolCard/taskRender'
import { useZhushenChatContext } from '@/components/AssistantChat/context'
import { CliOutputBlock } from '@/components/CliOutputBlock'

function detectParallelTasks(blocks: ChatBlock[]): Array<ChatBlock | ChatBlock[]> {
    const TIME_WINDOW = 5000
    const result: Array<ChatBlock | ChatBlock[]> = []
    let currentGroup: ToolCallBlock[] = []
    let lastTimestamp = 0

    for (const block of blocks) {
        const isTask = block.kind === 'tool-call' && block.tool.name === 'Task'

        if (isTask) {
            const timeDiff = block.createdAt - lastTimestamp

            if (currentGroup.length === 0 || timeDiff <= TIME_WINDOW) {
                currentGroup.push(block as ToolCallBlock)
                lastTimestamp = block.createdAt
            } else {
                if (currentGroup.length > 1) {
                    result.push([...currentGroup])
                } else if (currentGroup.length === 1) {
                    result.push(currentGroup[0])
                }
                currentGroup = [block as ToolCallBlock]
                lastTimestamp = block.createdAt
            }
        } else {
            if (currentGroup.length > 1) {
                result.push([...currentGroup])
            } else if (currentGroup.length === 1) {
                result.push(currentGroup[0])
            }
            currentGroup = []
            lastTimestamp = 0
            result.push(block)
        }
    }

    if (currentGroup.length > 1) {
        result.push([...currentGroup])
    } else if (currentGroup.length === 1) {
        result.push(currentGroup[0])
    }

    return result
}

function TaskToolBlock(props: { block: ToolCallBlock }) {
    const ctx = useZhushenChatContext()

    return (
        <div className="py-1 min-w-0 max-w-full overflow-x-hidden">
            <ToolCard
                api={ctx.api}
                sessionId={ctx.sessionId}
                metadata={ctx.metadata}
                disabled={ctx.disabled}
                onDone={ctx.onRefresh}
                block={props.block}
            />
            <TaskChildrenSection
                block={props.block}
                renderBlocks={(blocks) => <ZhushenNestedBlockList blocks={blocks} />}
            />
        </div>
    )
}

function ParallelTasksGrid(props: { tasks: ToolCallBlock[] }) {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {props.tasks.map((task) => (
                <div key={task.id} className="min-w-0 flex flex-col">
                    <TaskToolBlock block={task} />
                </div>
            ))}
        </div>
    )
}

function ZhushenNestedBlockList(props: { blocks: ChatBlock[] }) {
    const ctx = useZhushenChatContext()
    const groupedBlocks = detectParallelTasks(props.blocks)

    return (
        <div className="flex flex-col gap-3">
            {groupedBlocks.map((item, groupIndex) => {
                if (Array.isArray(item)) {
                    return (
                        <div key={`parallel-group:${groupIndex}`} className="py-1">
                            <ParallelTasksGrid tasks={item as ToolCallBlock[]} />
                        </div>
                    )
                }

                const block = item

                if (block.kind === 'user-text') {
                    const userBubbleClass = 'w-fit max-w-[92%] ml-auto rounded-xl bg-[var(--app-secondary-bg)] px-3 py-2 text-[var(--app-fg)] shadow-sm'
                    const status = block.status
                    const canRetry = status === 'failed' && typeof block.localId === 'string' && Boolean(ctx.onRetryMessage)
                    const onRetry = canRetry ? () => ctx.onRetryMessage!(block.localId!) : undefined

                    return (
                        <div key={`user:${block.id}`} className={userBubbleClass}>
                            <div className="flex items-end gap-2">
                                <div className="flex-1">
                                    <LazyRainbowText text={block.text} />
                                </div>
                                {status ? (
                                    <div className="shrink-0 self-end pb-0.5">
                                        <MessageStatusIndicator status={status} onRetry={onRetry} />
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )
                }

                if (block.kind === 'agent-text') {
                    return (
                        <div key={`agent:${block.id}`} className="px-1">
                            <MarkdownRenderer content={block.text} />
                        </div>
                    )
                }

                if (block.kind === 'cli-output') {
                    const alignClass = block.source === 'user' ? 'ml-auto w-full max-w-[92%]' : ''
                    return (
                        <div key={`cli:${block.id}`} className="px-1 min-w-0 max-w-full overflow-x-hidden">
                            <div className={alignClass}>
                                <CliOutputBlock text={block.text} />
                            </div>
                        </div>
                    )
                }

                if (block.kind === 'agent-event') {
                    const presentation = getEventPresentation(block.event)
                    return (
                        <div key={`event:${block.id}`} className="py-1">
                            <div className="mx-auto w-fit max-w-[92%] px-2 text-center text-xs text-[var(--app-hint)] opacity-80">
                                <span className="inline-flex items-center gap-1">
                                    {presentation.icon ? <span aria-hidden="true">{presentation.icon}</span> : null}
                                    <span>{presentation.text}</span>
                                </span>
                            </div>
                        </div>
                    )
                }

                if (block.kind === 'tool-call') {
                    return block.tool.name === 'Task' ? (
                        <TaskToolBlock key={`tool:${block.id}`} block={block} />
                    ) : (
                        <div key={`tool:${block.id}`} className="py-1">
                            <ToolCard
                                api={ctx.api}
                                sessionId={ctx.sessionId}
                                metadata={ctx.metadata}
                                disabled={ctx.disabled}
                                onDone={ctx.onRefresh}
                                block={block}
                            />
                            {block.children.length > 0 ? (
                                <div className="mt-2 pl-3">
                                    <ZhushenNestedBlockList blocks={block.children} />
                                </div>
                            ) : null}
                        </div>
                    )
                }

                return null
            })}
        </div>
    )
}

export function ZhushenToolMessage(props: ToolCallMessagePartProps) {
    const ctx = useZhushenChatContext()
    const artifact = props.artifact

    if (!isToolCallBlock(artifact)) {
        const argsText = typeof props.argsText === 'string' ? props.argsText.trim() : ''
        const hasArgsText = argsText.length > 0
        const hasResult = props.result !== undefined
        const resultText = hasResult ? safeStringify(props.result) : ''

        return (
            <div className="py-1 min-w-0 max-w-full overflow-x-hidden">
                <div className="rounded-xl bg-[var(--app-secondary-bg)] p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs">
                        <div className="font-mono text-[var(--app-hint)]">
                            Tool: {props.toolName}
                        </div>
                        {props.isError ? <span className="text-red-500">Error</span> : null}
                        {props.status.type === 'running' && !hasResult ? <span className="text-[var(--app-hint)]">Running…</span> : null}
                    </div>

                    {hasArgsText ? (
                        <div className="mt-2">
                            <CodeBlock code={argsText} language="json" />
                        </div>
                    ) : null}

                    {hasResult ? (
                        <div className="mt-2">
                            <CodeBlock code={resultText} language={typeof props.result === 'string' ? 'text' : 'json'} />
                        </div>
                    ) : null}
                </div>
            </div>
        )
    }

    const block = artifact

    return block.tool.name === 'Task' ? (
        <TaskToolBlock block={block} />
    ) : (
        <div className="py-1 min-w-0 max-w-full overflow-x-hidden">
            <ToolCard
                api={ctx.api}
                sessionId={ctx.sessionId}
                metadata={ctx.metadata}
                disabled={ctx.disabled}
                onDone={ctx.onRefresh}
                block={block}
            />
            {block.children.length > 0 ? (
                <div className="mt-2 pl-3">
                    <ZhushenNestedBlockList blocks={block.children} />
                </div>
            ) : null}
        </div>
    )
}
