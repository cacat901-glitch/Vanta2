// ─── Audio Adapter Interface ──────────────────────────────────────────

export interface AudioDevice {
  id: string
  label: string
  kind: 'audioinput' | 'audiooutput'
}

export interface RecordingOptions {
  deviceId?: string
  sampleRate?: number
  channels?: number
  includeSystemAudio?: boolean
}

export interface RecordingSession {
  id: string
  startedAt: Date
  isPaused: boolean
}

export interface AudioBlob {
  blob: Blob
  duration: number // seconds
  mimeType: string
}

export interface AudioPlayback {
  play(): void
  pause(): void
  stop(): void
  seek(seconds: number): void
  onTimeUpdate(callback: (time: number) => void): void
  duration: number
}

export interface AudioAdapter {
  /** Start a new recording session */
  startRecording(options?: RecordingOptions): Promise<RecordingSession>
  /** Pause an active recording */
  pauseRecording(session: RecordingSession): Promise<void>
  /** Resume a paused recording */
  resumeRecording(session: RecordingSession): Promise<void>
  /** Stop recording and return the audio blob */
  stopRecording(session: RecordingSession): Promise<AudioBlob>
  /** Get the current amplitude level (0-1) for waveform display */
  getAmplitude(session: RecordingSession): number
  /** Play an audio file or blob */
  playAudio(src: string | Blob): Promise<AudioPlayback>
  /** List available audio input devices */
  getInputDevices(): Promise<AudioDevice[]>
  /** List available audio output devices */
  getOutputDevices(): Promise<AudioDevice[]>
  /** Check if recording is supported on this platform */
  isRecordingSupported(): boolean
}
