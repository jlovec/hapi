import type { MarkdownTextPrimitiveProps } from '@assistant-ui/react-markdown'
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown'
import { TextMessagePartProvider } from '@assistant-ui/react'
import { getMarkdownPrimitiveProps } from '@/components/assistant-ui/markdown-text'

type MarkdownRendererProps = {
    content: string
    components?: MarkdownTextPrimitiveProps['components']
}

function MarkdownContent(props: MarkdownRendererProps) {
    const markdownProps = getMarkdownPrimitiveProps({
        components: props.components,
    })

    return (
        <TextMessagePartProvider text={props.content}>
            <MarkdownTextPrimitive {...markdownProps} />
        </TextMessagePartProvider>
    )
}

export function MarkdownRenderer(props: MarkdownRendererProps) {
    return <MarkdownContent {...props} />
}
