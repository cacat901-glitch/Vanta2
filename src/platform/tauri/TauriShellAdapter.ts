import type { ShellAdapter } from '../adapters/ShellAdapter'

export class TauriShellAdapter implements ShellAdapter {
  async openUrl(url: string): Promise<void> {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  }

  async openFile(path: string): Promise<void> {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(path)
  }

  async revealFile(path: string): Promise<void> {
    const parentPath = path.replace(/[/\\][^/\\]*$/, '')
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(parentPath)
  }

  async runCommand(
    command: string,
    args: string[] = [],
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { Command } = await import('@tauri-apps/plugin-shell')
    const child = await Command.create(command, args).execute()
    return {
      stdout: child.stdout,
      stderr: child.stderr,
      exitCode: child.code ?? 0,
    }
  }

  async commandExists(command: string): Promise<boolean> {
    try {
      const result = await this.runCommand('which', [command])
      return result.exitCode === 0
    } catch {
      try {
        const result = await this.runCommand('where', [command])
        return result.exitCode === 0
      } catch {
        return false
      }
    }
  }

  async isOllamaRunning(baseUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  openSettings(): void {
    window.dispatchEvent(new CustomEvent('studyos:navigate', { detail: '/settings' }))
  }
}
