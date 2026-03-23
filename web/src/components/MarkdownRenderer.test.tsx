import type { ComponentPropsWithoutRef } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n-context'
import {
    defaultComponents,
    markdownComponentsByLanguage,
    MARKDOWN_REHYPE_PLUGINS,
    MARKDOWN_REMARK_PLUGINS,
} from '@/components/assistant-ui/markdown-text'

const { mermaidRenderMock, initializeMock } = vi.hoisted(() => ({
    mermaidRenderMock: vi.fn(),
    initializeMock: vi.fn(),
}))

vi.mock('mermaid', () => ({
    default: {
        initialize: initializeMock,
        render: mermaidRenderMock,
    },
}))

function renderWithI18n(ui: React.ReactElement) {
    return render(<I18nProvider>{ui}</I18nProvider>)
}

describe('shared markdown components', () => {
    beforeEach(() => {
        cleanup()
        vi.clearAllMocks()
        localStorage.setItem('zs-lang', 'en')
        mermaidRenderMock.mockResolvedValue({
            svg: '<svg data-testid="mermaid-svg"><text>diagram</text></svg>',
        })
    })

    it('styles shared safe html containers through shared block components', () => {
        const Figure = defaultComponents.figure as (props: ComponentPropsWithoutRef<'figure'>) => React.ReactElement
        const Figcaption = defaultComponents.figcaption as (props: ComponentPropsWithoutRef<'figcaption'>) => React.ReactElement

        const { container } = renderWithI18n(
            <Figure className="safe-figure">
                <img src="/demo.png" alt="demo" />
                <Figcaption>caption</Figcaption>
            </Figure>
        )

        expect(container.querySelector('figure.safe-figure')).toBeTruthy()
        expect(screen.getByText('caption')).toBeInTheDocument()
    })

    it('exports markdown plugin chains for math and sanitize support', () => {
        expect(MARKDOWN_REMARK_PLUGINS).toHaveLength(2)
        expect(MARKDOWN_REHYPE_PLUGINS).toHaveLength(3)
    })

    it('keeps safe html attributes in shared image component', () => {
        const Image = defaultComponents.img as (props: ComponentPropsWithoutRef<'img'>) => React.ReactElement
        const { container } = renderWithI18n(<Image src="/demo.png" alt="demo" className="safe" />)

        const image = container.querySelector('img')
        expect(image).toHaveAttribute('src', '/demo.png')
        expect(image?.className).toContain('aui-md-img')
        expect(image?.className).toContain('safe')
    })

    it('renders mermaid fenced blocks via the shared mermaid renderer', async () => {
        const MermaidHighlighter = markdownComponentsByLanguage.mermaid?.SyntaxHighlighter
        if (!MermaidHighlighter) {
            throw new Error('Mermaid highlighter is missing')
        }

        const { container } = renderWithI18n(
            <MermaidHighlighter
                code={'graph TD\nA-->B'}
                language="mermaid"
                components={{ Pre: 'pre' as never, Code: 'code' as never }}
            />
        )

        await waitFor(() => {
            expect(mermaidRenderMock).toHaveBeenCalledTimes(1)
        })

        expect(initializeMock).toHaveBeenCalled()
        expect(container.querySelector('[data-testid="mermaid-svg"]')).toBeTruthy()
    })

    it('falls back to source when shared mermaid renderer fails', async () => {
        mermaidRenderMock.mockRejectedValueOnce(new Error('bad diagram'))
        const MermaidHighlighter = markdownComponentsByLanguage.mermaid?.SyntaxHighlighter
        if (!MermaidHighlighter) {
            throw new Error('Mermaid highlighter is missing')
        }

        renderWithI18n(
            <MermaidHighlighter
                code={'graph TD\nA-->B'}
                language="mermaid"
                components={{ Pre: 'pre' as never, Code: 'code' as never }}
            />
        )

        await waitFor(() => {
            expect(screen.getByText('Unable to render Mermaid diagram. Showing source instead.')).toBeInTheDocument()
        })

        expect(screen.getByText((content) => content.includes('graph TD'))).toBeInTheDocument()
    })
})
