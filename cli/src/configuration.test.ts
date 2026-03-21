import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

function resolveRuntimeExecutable(): string {
  const bunFromEnv = process.env.BUN_BIN
  if (bunFromEnv && existsSync(bunFromEnv)) {
    return bunFromEnv
  }

  try {
    execFileSync('bun', ['--version'], { stdio: 'ignore' })
    return 'bun'
  } catch {
    if (existsSync(process.execPath)) {
      return process.execPath
    }
    throw new Error('No runnable Bun executable found for test probe')
  }
}

const runtimeExecutable = resolveRuntimeExecutable()

function currentCliRoot(): string {
  return process.cwd()
}

function probeArgv0(): string {
  return runtimeExecutable === 'bun' ? 'bun' : runtimeExecutable
}

function probeCwd(): string {
  return currentCliRoot()
}

function createTempHome(): string {
  const home = join(tmpdir(), `zs-config-test-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(home, { recursive: true })
  return home
}

function readRunnerLogDestination(tempHome: string, extraEnv: NodeJS.ProcessEnv = {}): string {
  return execFileSync(runtimeExecutable, ['--eval', `
    import('./src/configuration.ts').then(({ configuration }) => {
      console.log(configuration.runnerLogDestination)
    })
  `], {
    cwd: probeCwd(),
    env: {
      ...process.env,
      ...extraEnv,
      ZS_HOME: tempHome,
    },
    encoding: 'utf8'
  }).trim()
}

describe('runner logging configuration', () => {
  let tempHome: string
  const originalZsHome = process.env.ZS_HOME
  const originalRunnerLogDestination = process.env.ZS_RUNNER_LOG_DESTINATION

  beforeEach(() => {
    tempHome = createTempHome()
    delete process.env.ZS_RUNNER_LOG_DESTINATION
  })

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true })
    if (originalZsHome === undefined) {
      delete process.env.ZS_HOME
    } else {
      process.env.ZS_HOME = originalZsHome
    }
    if (originalRunnerLogDestination === undefined) {
      delete process.env.ZS_RUNNER_LOG_DESTINATION
    } else {
      process.env.ZS_RUNNER_LOG_DESTINATION = originalRunnerLogDestination
    }
  })

  it('reads runnerLogDestination from settings.json', () => {
    writeFileSync(join(tempHome, 'settings.json'), JSON.stringify({ runnerLogDestination: 'stdio' }, null, 2))
    expect(readRunnerLogDestination(tempHome)).toBe('stdio')
  })

  it('prefers ZS_RUNNER_LOG_DESTINATION env var over settings.json', () => {
    writeFileSync(join(tempHome, 'settings.json'), JSON.stringify({ runnerLogDestination: 'file' }, null, 2))
    expect(readRunnerLogDestination(tempHome, { ZS_RUNNER_LOG_DESTINATION: 'stdio' })).toBe('stdio')
  })

  it('falls back to settings/default when env var is invalid', () => {
    writeFileSync(join(tempHome, 'settings.json'), JSON.stringify({ runnerLogDestination: 'file' }, null, 2))
    expect(readRunnerLogDestination(tempHome, { ZS_RUNNER_LOG_DESTINATION: 'invalid-value' })).toBe('file')
  })

  it('defaults to file when neither env nor settings specify it', () => {
    expect(readRunnerLogDestination(tempHome)).toBe('file')
  })
})
