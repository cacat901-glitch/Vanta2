// ─── Shell Adapter Interface ──────────────────────────────────────────

export interface ShellAdapter {
  /** Open a URL in the system's default browser */
  openUrl(url: string): Promise<void>
  /** Open a file in the system's default app */
  openFile(path: string): Promise<void>
  /** Reveal a file in the system file manager (Finder, Explorer, Nautilus) */
  revealFile(path: string): Promise<void>
  /** Run a subprocess and return its stdout */
  runCommand(command: string, args?: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }>
  /** Check if a command exists on the system */
  commandExists(command: string): Promise<boolean>
  /** Check if Ollama is running */
  isOllamaRunning(baseUrl: string): Promise<boolean>
  /** Open app settings */
  openSettings(): void
}
