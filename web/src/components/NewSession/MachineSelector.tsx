import { useEffect, useMemo, useRef, useState } from 'react'
import type { Machine } from '@/types/api'
import { HostBadge } from '@/components/HostBadge'
import { getHostDisplayName } from '@/shared/lib/host-utils'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/use-translation'

function getMachineTitle(machine: Machine): string {
    return getHostDisplayName({
        displayName: machine.metadata?.displayName,
        host: machine.metadata?.host,
        platform: machine.metadata?.platform,
        machineId: machine.id,
    }) ?? machine.id.slice(0, 8)
}

function ChevronDownIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
            aria-hidden="true"
        >
            <polyline points="6 9 12 15 18 9" />
        </svg>
    )
}

function MachineOption(props: {
    machine: Machine
    isSelected: boolean
    onSelect: (machineId: string) => void
}) {
    const title = getMachineTitle(props.machine)

    return (
        <button
            type="button"
            role="option"
            aria-selected={props.isSelected}
            className={cn(
                'flex w-full items-center rounded-md px-2 py-2 text-left transition-colors',
                props.isSelected ? 'bg-[var(--app-secondary-bg)]' : 'hover:bg-[var(--app-subtle-bg)]'
            )}
            onClick={() => props.onSelect(props.machine.id)}
        >
            <HostBadge
                displayName={props.machine.metadata?.displayName}
                host={props.machine.metadata?.host}
                platform={props.machine.metadata?.platform}
                machineId={props.machine.id}
                className="max-w-full"
            />
            <span className="sr-only">{title}</span>
        </button>
    )
}

function MachineSelectValue(props: { machine: Machine | null; placeholder: string }) {
    if (!props.machine) {
        return <span className="truncate text-[var(--app-hint)]">{props.placeholder}</span>
    }

    return (
        <HostBadge
            displayName={props.machine.metadata?.displayName}
            host={props.machine.metadata?.host}
            platform={props.machine.metadata?.platform}
            machineId={props.machine.id}
            className="max-w-full"
        />
    )
}

type MachineSelectorProps = {
    machines: Machine[]
    machineId: string | null
    isLoading?: boolean
    isDisabled: boolean
    onChange: (machineId: string) => void
}

export function MachineSelector(props: MachineSelectorProps) {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const selectedMachine = useMemo(
        () => (props.machineId ? props.machines.find((machine) => machine.id === props.machineId) ?? null : null),
        [props.machineId, props.machines]
    )

    useEffect(() => {
        if (props.isDisabled) {
            setOpen(false)
        }
    }, [props.isDisabled])

    useEffect(() => {
        if (!open) return

        const handlePointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        window.addEventListener('pointerdown', handlePointerDown)
        return () => window.removeEventListener('pointerdown', handlePointerDown)
    }, [open])

    const placeholder = props.isLoading
        ? t('loading.machines')
        : props.machines.length === 0
            ? t('misc.noMachines')
            : t('newSession.machine')

    return (
        <div className="flex flex-col gap-1.5 px-3 py-3">
            <label className="text-xs font-medium text-[var(--app-hint)]">
                {t('newSession.machine')}
            </label>
            <div ref={containerRef} className="relative">
                <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-label={t('newSession.machine')}
                    disabled={props.isDisabled || props.machines.length === 0}
                    onClick={() => setOpen((value) => !value)}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-50"
                >
                    <span className="min-w-0 flex-1 text-left">
                        <MachineSelectValue machine={selectedMachine} placeholder={placeholder} />
                    </span>
                    <ChevronDownIcon className={cn('h-4 w-4 shrink-0 text-[var(--app-hint)] transition-transform', open && 'rotate-180')} />
                </button>
                {open ? (
                    <div
                        role="listbox"
                        aria-label={t('newSession.machine')}
                        className="absolute z-10 mt-1 flex max-h-72 w-full flex-col gap-1 overflow-auto rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] p-1 shadow-lg"
                    >
                        {props.machines.map((machine) => (
                            <MachineOption
                                key={machine.id}
                                machine={machine}
                                isSelected={machine.id === props.machineId}
                                onSelect={(machineId) => {
                                    props.onChange(machineId)
                                    setOpen(false)
                                }}
                            />
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    )
}
