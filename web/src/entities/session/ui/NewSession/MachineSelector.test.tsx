import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MachineSelector } from './MachineSelector'
import type { Machine } from '@/types/api'

vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}))

afterEach(() => {
    cleanup()
})

describe('MachineSelector', () => {
    const machines: Machine[] = [
        {
            id: 'machine-1',
            active: true,
            metadata: {
                displayName: 'Alpha',
                host: 'alpha.local',
                platform: 'linux',
                zhushenCliVersion: '1.0.0',
            },
        },
        {
            id: 'machine-2',
            active: true,
            metadata: {
                displayName: 'Beta',
                host: 'beta.local',
                platform: 'darwin',
                zhushenCliVersion: '1.0.0',
            },
        },
    ]

    it('renders selected machine with host badge styling in trigger', () => {
        render(
            <MachineSelector
                machines={machines}
                machineId="machine-1"
                isDisabled={false}
                onChange={vi.fn()}
            />
        )

        const trigger = screen.getByRole('button', { name: 'newSession.machine' })
        expect(trigger.querySelector('span[role="status"]')).toBeInTheDocument()
        expect(screen.getByText('Alpha(linux:machine-)')).toBeInTheDocument()
    })

    it('renders host badges in dropdown options and calls onChange when selecting', () => {
        const onChange = vi.fn()

        render(
            <MachineSelector
                machines={machines}
                machineId="machine-1"
                isDisabled={false}
                onChange={onChange}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'newSession.machine' }))

        const listbox = screen.getByRole('listbox', { name: 'newSession.machine' })
        expect(listbox.querySelectorAll('span[role="status"]')).toHaveLength(2)

        fireEvent.click(screen.getByRole('option', { name: /Beta/ }))
        expect(onChange).toHaveBeenCalledWith('machine-2')
    })
})
