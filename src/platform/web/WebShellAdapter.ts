import type { ShellAdapter } from '../adapters/ShellAdapter'

/**
 * Web / PWA implementation of ShellAdapter.
 * Native system calls are not available in browser.
 */
export class WebShellAdapter implements ShellAdapter {
  async openUrl(url: string): Promise<void> {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async openFile(_path: string): Promise<void> {
    console.warn('Opening local files is not supported in browser mode')
  }

  async revealFile(_path: string): Promise<void> {
    console.warn('Revealing files in file manager is not supported in browser mode')
  }

  async runCommand(_command: string, _args?: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    console.warn('Shell commands are not supported in browser mode')
    return { stdout: '', stderr: 'Not available in browser mode', exitCode: 1 }
  }

  async commandExists(_command: string): Promise<boolean> {
    return false
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
    // In browser mode, navigate to the settings route
    window.location.hash = '/settings'
  }
}
